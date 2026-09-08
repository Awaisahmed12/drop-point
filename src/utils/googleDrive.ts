import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_PICKER_API_KEY } from '../../constants';

/**
 * Import from Google Drive, entirely in the browser: Google's own picker
 * chooses the files, the Drive API hands us the bytes, and they go through
 * the normal upload path. The drive.file scope only ever grants access to
 * the files the user picks, so no broad Drive permission is requested.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveDoc { id: string; name: string; mimeType: string }

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(opts?: { prompt?: string }): void }
interface DocsView { setIncludeFolders(b: boolean): DocsView }
interface Picker { setVisible(visible: boolean): void }
interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  enableFeature(feature: unknown): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (data: { action: string; docs?: DriveDoc[] }) => void): PickerBuilder;
  build(): Picker;
}
interface GoogleGlobals {
  google?: {
    accounts?: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: TokenResponse) => void;
          error_callback?: (error: { type: string }) => void;
        }): TokenClient;
      };
    };
    picker?: {
      PickerBuilder: new () => PickerBuilder;
      DocsView: new () => DocsView;
      Feature: { MULTISELECT_ENABLED: unknown };
      Action: { PICKED: string; CANCEL: string };
    };
  };
  gapi?: { load(name: string, done: () => void): void };
}

const globals = () => window as unknown as GoogleGlobals;

export const googleDriveAvailable = Boolean(GOOGLE_OAUTH_CLIENT_ID);

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;
  const loading = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scripts.delete(src);
      reject(new Error('Couldn’t reach Google. Check your connection and try again.'));
    };
    document.head.appendChild(el);
  });
  scripts.set(src, loading);
  return loading;
}

/** Fetch Google's scripts ahead of the tap so the picker opens without a wait. */
export async function preloadGoogleDrive(): Promise<void> {
  if (!googleDriveAvailable || typeof window === 'undefined') return;
  try {
    await Promise.all([loadScript(GSI_SRC), loadScript(GAPI_SRC)]);
  } catch {
    // The import itself will report the problem.
  }
}

let token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  await loadScript(GSI_SRC);
  const oauth = globals().google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google sign-in is unavailable right now.');
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error === 'access_denied' ? 'Google Drive access was declined.' : 'Couldn’t connect to Google Drive.'));
          return;
        }
        token = { value: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 };
        resolve(response.access_token);
      },
      error_callback: error => {
        reject(new Error(error.type === 'popup_closed' ? 'Google sign-in was closed.' : 'Couldn’t connect to Google Drive.'));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function pickDriveFiles(accessToken: string): Promise<DriveDoc[]> {
  await loadScript(GAPI_SRC);
  const { gapi } = globals();
  if (!gapi) throw new Error('Google Drive is unavailable right now.');
  await new Promise<void>(done => gapi.load('picker', done));
  const picker = globals().google?.picker;
  if (!picker) throw new Error('Google Drive is unavailable right now.');
  return new Promise(resolve => {
    new picker.PickerBuilder()
      .addView(new picker.DocsView().setIncludeFolders(true))
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_PICKER_API_KEY)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setTitle('Import to DropPoint')
      .setCallback(data => {
        if (data.action === picker.Action.PICKED) resolve(data.docs ?? []);
        else if (data.action === picker.Action.CANCEL) resolve([]);
      })
      .build()
      .setVisible(true);
  });
}

// Google-native formats have no bytes of their own; export them as something
// any viewer can open.
const EXPORTS: Record<string, { mime: string; ext: string }> = {
  'application/vnd.google-apps.document': { mime: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  'application/vnd.google-apps.drawing': { mime: 'image/png', ext: 'png' },
};

async function downloadDriveFile(accessToken: string, doc: DriveDoc): Promise<File | null> {
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}`;
  let url = `${base}?alt=media`;
  let name = doc.name;
  let type = doc.mimeType;
  if (doc.mimeType.startsWith('application/vnd.google-apps.')) {
    const exported = EXPORTS[doc.mimeType];
    if (!exported) return null; // folders, forms, sites: nothing to import
    url = `${base}/export?mimeType=${encodeURIComponent(exported.mime)}`;
    type = exported.mime;
    if (!name.toLowerCase().endsWith(`.${exported.ext}`)) name = `${name}.${exported.ext}`;
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Couldn’t download “${doc.name}” from Google Drive.`);
  return new File([await response.blob()], name, { type });
}

export interface DriveImportResult {
  files: File[];
  /** Picked items that couldn't be imported (folders, forms, failed downloads). */
  skipped: number;
}

/** Let the user pick Drive files and return them ready to upload. */
export async function importFromGoogleDrive(): Promise<DriveImportResult> {
  if (!googleDriveAvailable) throw new Error('Google Drive import isn’t set up yet.');
  const accessToken = await getAccessToken();
  const docs = await pickDriveFiles(accessToken);
  const results = await Promise.allSettled(docs.map(doc => downloadDriveFile(accessToken, doc)));
  const files = results.flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  return { files, skipped: docs.length - files.length };
}
