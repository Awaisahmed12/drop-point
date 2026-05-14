import React, { useState, useEffect, useRef } from 'react';
import { FileIcon } from './FileIcon';
import { supabase } from '../utils/supabaseClient';
import { THUMBNAIL_BATCH_WINDOW_MS, THUMBNAIL_BATCH_MAX, SIGNED_URL_EXPIRY_SEC } from '../../constants';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

// Only raster image types get actual previews — docs, PDFs etc. keep their icons
const PREVIEW_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);

// Module-level URL cache: survives re-renders and property switches for the session lifetime.
// Values: string = signed URL, false = fetch failed/unavailable
const urlCache = new Map<string, string | false>();

// Batch queue: accumulate requests from IntersectionObserver callbacks across all mounted
// components, then flush them all in a single createSignedUrls() call.
let pendingQueue: Array<{ key: string; resolve: (url: string | false) => void }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flushQueue, THUMBNAIL_BATCH_WINDOW_MS);
}

async function flushQueue() {
  flushTimer = null;
  if (pendingQueue.length === 0) return;

  const batch = pendingQueue.splice(0, THUMBNAIL_BATCH_MAX);
  if (pendingQueue.length > 0) scheduleFlush(); // schedule next batch if more remain

  const paths = batch.map(item => item.key); // key = "propertyId/fileName"

  try {
    const { data, error } = await supabase.storage
      .from('property-files')
      .createSignedUrls(paths, SIGNED_URL_EXPIRY_SEC); // single HTTP request for all N URLs

    if (error || !data) {
      batch.forEach(item => { urlCache.set(item.key, false); item.resolve(false); });
      return;
    }

    batch.forEach((item, i) => {
      const url = data[i]?.signedUrl ?? false;
      urlCache.set(item.key, url);
      item.resolve(url);
    });
  } catch {
    batch.forEach(item => { urlCache.set(item.key, false); item.resolve(false); });
  }
}

function requestThumbnail(propertyId: string, fileName: string): Promise<string | false> {
  const key = `${propertyId}/${fileName}`;
  if (urlCache.has(key)) return Promise.resolve(urlCache.get(key)!);
  return new Promise(resolve => {
    pendingQueue.push({ key, resolve });
    scheduleFlush();
  });
}

export const FileThumbnail = ({ fileName, propertyId, size = 64, className = '' }: FileThumbnailProps) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isPreviewable = PREVIEW_EXTENSIONS.has(ext);

  // Synchronous cache check: if this file was seen before, start with the URL already set.
  // This makes re-opening the same property feel instant — no loading at all.
  const cachedValue = isPreviewable ? urlCache.get(`${propertyId}/${fileName}`) : undefined;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    typeof cachedValue === 'string' ? cachedValue : null
  );
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!isPreviewable || requested.current) return;

    // Double-check cache in case it was populated between render and effect
    const key = `${propertyId}/${fileName}`;
    const cached = urlCache.get(key);
    if (cached !== undefined) {
      if (typeof cached === 'string') setThumbnailUrl(cached);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    // Only start fetching when the item is near the viewport.
    // rootMargin: 300px means we start loading ~2 rows before they scroll into view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || requested.current) return;
        requested.current = true;
        observer.disconnect();
        requestThumbnail(propertyId, fileName).then(url => {
          if (typeof url === 'string') setThumbnailUrl(url);
        });
      },
      { rootMargin: '300px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isPreviewable, propertyId, fileName]);

  // Non-image files: just the icon, no overhead
  if (!isPreviewable) {
    return (
      <div className={className}>
        <FileIcon type={ext} size={size} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
    >
      {/* File icon is always the base layer — no layout shift, no spinner */}
      <FileIcon type={ext} size={size} />

      {/* Thumbnail fades in over the icon once the signed URL is fetched and the image loads */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: 6,
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setThumbnailUrl(null)} // fall back to icon on error
        />
      )}
    </div>
  );
};

// Kept for call-site compatibility
export const preloadThumbnails = async () => {};
