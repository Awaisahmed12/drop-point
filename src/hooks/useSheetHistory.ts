import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

interface UseSheetHistoryOptions {
  isOpen: boolean;
  propertyId: string | null;
  selectedFolder: string;
  /** The property list is loaded, so a deep link can be resolved. */
  ready: boolean;
  /** Open a property because the URL says so. Return false if it's unknown. */
  openPropertyById: (id: string) => boolean;
  /** Close the sheet in state only; the URL has already moved on. */
  closeSheet: () => void;
  setSelectedFolder: (id: string) => void;
}

const readParams = (path: string) => {
  const q = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?')) : '');
  return { property: q.get('property'), folder: q.get('folder') };
};

/**
 * The open property and folder live in the URL, one history entry per step,
 * so Back, Forward and the edge swipe move through them like pages and a
 * link to a property opens it. Pages call open/changeFolder/close; the
 * effect keeps state in step with the URL when the browser drives.
 *
 * Entries the sheet added are remembered so Close can jump back to where
 * the user was before they opened anything.
 */
export function useSheetHistory(options: UseSheetHistoryOptions) {
  const router = useRouter();
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const stack = useRef<string[]>([]);
  const pos = useRef(-1); // index into stack; -1 = before any entry of ours

  const buildPath = useCallback((property: string, folder?: string | null) => {
    const q = new URLSearchParams({ property });
    if (folder && folder !== 'master') q.set('folder', folder);
    return `${router.pathname}?${q.toString()}`;
  }, [router.pathname]);

  const push = useCallback((path: string) => {
    stack.current = stack.current.slice(0, pos.current + 1).concat(path);
    pos.current += 1;
    void router.push(path, undefined, { shallow: true });
  }, [router]);

  /** The user opened (or switched to) a property. */
  const open = useCallback((id: string) => {
    if (readParams(window.location.search).property === id) return;
    push(buildPath(id));
  }, [push, buildPath]);

  /** The user went into (or up out of) a folder. */
  const changeFolder = useCallback((folderId: string) => {
    latest.current.setSelectedFolder(folderId);
    const current = readParams(window.location.search);
    const id = latest.current.propertyId ?? current.property;
    if (!id) return;
    if ((current.folder ?? 'master') === folderId && current.property === id) return;
    push(buildPath(id, folderId));
  }, [push, buildPath]);

  /** Close the sheet, landing on the URL the user had before they opened it. */
  const close = useCallback(() => {
    if (!readParams(window.location.search).property) {
      latest.current.closeSheet();
      return;
    }
    if (pos.current >= 0) {
      const steps = pos.current + 1;
      stack.current = [];
      pos.current = -1;
      window.history.go(-steps);
    } else {
      // Arrived by link: nothing of ours to go back over.
      void router.replace(router.pathname, undefined, { shallow: true });
    }
  }, [router]);

  // URL → state. Runs only when the URL (or readiness) changes; state is read
  // through `latest` so our own pushes, which set state first, are no-ops here.
  useEffect(() => {
    if (!router.isReady) return;
    const path = router.asPath;
    const s = stack.current;
    const p = pos.current;
    if (p >= 0 && s[p - 1] === path) pos.current = p - 1;
    else if (s[p + 1] === path) pos.current = p + 1;
    else if (s[p] !== path) {
      // Something else (the file viewer, a link) changed the URL.
      if (readParams(path).property) {
        stack.current = s.slice(0, p + 1).concat(path);
        pos.current = p + 1;
      } else {
        stack.current = [];
        pos.current = -1;
      }
    }

    const { property, folder } = readParams(path);
    const o = latest.current;
    if (!property) {
      if (o.isOpen) o.closeSheet();
      return;
    }
    if (!o.ready) return;
    if (!o.isOpen || o.propertyId !== property) {
      if (!o.openPropertyById(property)) {
        void router.replace(router.pathname, undefined, { shallow: true });
        return;
      }
    }
    const target = folder ?? 'master';
    if (target !== o.selectedFolder) o.setSelectedFolder(target);
  }, [router, router.isReady, router.asPath, options.ready]);

  return { open, changeFolder, close };
}
