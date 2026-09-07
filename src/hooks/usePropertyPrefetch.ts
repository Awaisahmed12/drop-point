import { supabase } from '../utils/supabaseClient';
import { isMobileDevice } from './useMobileViewport';
import { GOOGLE_MAPS_API_KEY, SIGNED_URL_EXPIRY_SEC, THUMBNAIL_BATCH_MAX, THUMBNAIL_BATCH_WINDOW_MS } from '../../constants';
import type { PropertyFile, PropertyFolder } from '../../types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Images: the hero photo and file thumbnails. URLs are built here so every
// screen asks for exactly the same bytes and the browser cache can serve them.
// ---------------------------------------------------------------------------

const PREVIEW_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);

/** Raster images get real previews; everything else keeps its icon. */
export const isPreviewableImage = (fileName: string): boolean =>
  PREVIEW_EXTENSIONS.has(fileName.split('.').pop()?.toLowerCase() || '');

/** The property sheet's hero: Street View on a phone, satellite on desktop. */
export const heroImageUrls = (lat: number, lng: number) => ({
  streetView: `https://maps.googleapis.com/maps/api/streetview?size=800x480&location=${lat},${lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`,
  satellite: `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=1200x600&maptype=satellite&markers=color:blue%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
});

const warmedUrls = new Set<string>();

/** Pull an image into the browser cache ahead of time. Skipped under Data Saver. */
export function warmImage(url: string): void {
  if (typeof window === 'undefined' || !url || warmedUrls.has(url)) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  warmedUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

export function warmHeroImage(lat: number, lng: number): void {
  const urls = heroImageUrls(lat, lng);
  warmImage(isMobileDevice() ? urls.streetView : urls.satellite);
}

// Signed thumbnail URLs, batched into one storage call and cached for just
// under their lifetime so a stale link is never handed out.
const THUMB_TTL = (SIGNED_URL_EXPIRY_SEC - 300) * 1000;
const THUMB_FAIL_TTL = 60 * 1000;
const thumbStore = new Map<string, { url: string | false; expiresAt: number }>();
const thumbQueue: Array<{ key: string; resolve: (url: string | false) => void }> = [];
let thumbFlushTimer: ReturnType<typeof setTimeout> | null = null;

const thumbKey = (propertyId: string, fileName: string) => `${propertyId}/${fileName}`;

/** Synchronous read: the URL if it's cached and still valid, else null. */
export function peekThumbnailUrl(propertyId: string, fileName: string): string | null {
  const entry = thumbStore.get(thumbKey(propertyId, fileName));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return typeof entry.url === 'string' ? entry.url : null;
}

/** Forget a URL that stopped working (expired, file renamed) so it gets re-signed. */
export function dropThumbnailUrl(propertyId: string, fileName: string): void {
  thumbStore.delete(thumbKey(propertyId, fileName));
}

function scheduleThumbFlush() {
  if (thumbFlushTimer !== null) return;
  thumbFlushTimer = setTimeout(flushThumbQueue, THUMBNAIL_BATCH_WINDOW_MS);
}

async function flushThumbQueue() {
  thumbFlushTimer = null;
  if (thumbQueue.length === 0) return;
  const batch = thumbQueue.splice(0, THUMBNAIL_BATCH_MAX);
  if (thumbQueue.length > 0) scheduleThumbFlush();

  const settle = (key: string, url: string | false) => {
    thumbStore.set(key, { url, expiresAt: Date.now() + (url ? THUMB_TTL : THUMB_FAIL_TTL) });
  };
  try {
    const { data, error } = await supabase.storage
      .from('property-files')
      .createSignedUrls(batch.map(item => item.key), SIGNED_URL_EXPIRY_SEC);
    batch.forEach((item, i) => {
      const url = !error && data ? data[i]?.signedUrl ?? false : false;
      settle(item.key, url);
      item.resolve(url);
    });
  } catch {
    batch.forEach(item => { settle(item.key, false); item.resolve(false); });
  }
}

/** A signed URL for a thumbnail, from cache or the next batched request. */
export function requestThumbnailUrl(propertyId: string, fileName: string): Promise<string | false> {
  const key = thumbKey(propertyId, fileName);
  const entry = thumbStore.get(key);
  if (entry && Date.now() <= entry.expiresAt) return Promise.resolve(entry.url);
  return new Promise(resolve => {
    thumbQueue.push({ key, resolve });
    scheduleThumbFlush();
  });
}

const WARM_THUMBNAILS_MAX = 12;

/** Sign and pre-load the first screen of image thumbnails for a property. */
export function warmThumbnails(propertyId: string, files: PropertyFile[]): void {
  if (typeof window === 'undefined') return;
  files
    .filter(f => isPreviewableImage(f.file_name))
    .slice(0, WARM_THUMBNAILS_MAX)
    .forEach(f => {
      void requestThumbnailUrl(propertyId, f.file_name).then(url => { if (url) warmImage(url); });
    });
}

interface PropertyDataEntry {
  files: PropertyFile[];
  folders: PropertyFolder[];
  fetchedAt: number;
}

// Module-level: survives re-renders and React lifecycle within a page session.
// Synchronous reads mean zero latency on cache hits — no React state, no async getUser().
const dataStore = new Map<string, PropertyDataEntry>();
const inFlight = new Set<string>(); // prevent duplicate in-flight fetches

export function getPropertyDataSync(propertyId: string): PropertyDataEntry | null {
  const entry = dataStore.get(propertyId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) {
    dataStore.delete(propertyId);
    return null;
  }
  warmThumbnails(propertyId, entry.files);
  return entry;
}

export function setPropertyDataCache(
  propertyId: string,
  files: PropertyFile[],
  folders: PropertyFolder[]
): void {
  dataStore.set(propertyId, { files, folders, fetchedAt: Date.now() });
  warmThumbnails(propertyId, files);
}

export function invalidatePropertyCache(propertyId: string): void {
  dataStore.delete(propertyId);
}

// Fire-and-forget background prefetch: files, folders, the hero photo and the
// first thumbnails. Safe to call repeatedly — no-ops if already cached (and
// fresh) or already in-flight.
export async function prefetchPropertyData(propertyId: string, location?: { lat: number; lng: number }): Promise<void> {
  if (!propertyId) return;
  if (location) warmHeroImage(location.lat, location.lng);

  const existing = dataStore.get(propertyId);
  if (existing && Date.now() - existing.fetchedAt < CACHE_TTL) {
    warmThumbnails(propertyId, existing.files);
    return;
  }
  if (inFlight.has(propertyId)) return;

  inFlight.add(propertyId);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [folderResult, filesResult] = await Promise.all([
      supabase
        .from('property_folders')
        .select('*')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('property_files')
        .select('*')
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false }),
    ]);

    if (folderResult.data && filesResult.data) {
      setPropertyDataCache(propertyId, filesResult.data, folderResult.data);
    }
  } catch {
    // Silently fail — this is a background prefetch, not user-initiated
  } finally {
    inFlight.delete(propertyId);
  }
}
