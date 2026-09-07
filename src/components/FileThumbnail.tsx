import React, { useState, useEffect, useRef } from 'react';
import { FileIcon } from './FileIcon';
import { peekThumbnailUrl, requestThumbnailUrl, dropThumbnailUrl, isPreviewableImage } from '../hooks/usePropertyPrefetch';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

// Signed URLs are cached, batched and pre-warmed in usePropertyPrefetch so a
// property that was prefetched (or opened before) shows its pictures at once.

export const FileThumbnail = ({ fileName, propertyId, size = 64, className = '' }: FileThumbnailProps) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isPreviewable = isPreviewableImage(fileName);

  // Synchronous cache check: if this file was seen before, start with the URL already set.
  // This makes re-opening the same property feel instant — no loading at all.
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    () => (isPreviewable ? peekThumbnailUrl(propertyId, fileName) : null)
  );
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const retried = useRef(false);

  useEffect(() => {
    if (!isPreviewable || requested.current) return;

    // Already resolved (possibly between render and effect): no observer needed.
    const cached = peekThumbnailUrl(propertyId, fileName);
    if (cached) {
      requested.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cache hit, no request
      setThumbnailUrl(cached);
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
        requestThumbnailUrl(propertyId, fileName).then(url => {
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
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, no optimization loader
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
          onError={() => {
            // A signed URL can expire between visits: re-sign once, then fall back to the icon.
            setThumbnailUrl(null);
            dropThumbnailUrl(propertyId, fileName);
            if (retried.current) return;
            retried.current = true;
            requestThumbnailUrl(propertyId, fileName).then(url => {
              if (typeof url === 'string') setThumbnailUrl(url);
            });
          }}
        />
      )}
    </div>
  );
};
