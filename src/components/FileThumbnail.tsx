import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { FileIcon } from './FileIcon';
import { getFileSignedUrl } from '../utils/supabaseClient';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

// Ultra-aggressive caching
const urlCache = new Map<string, string>();
const imageCache = new Map<string, HTMLImageElement>();
const failedImages = new Set<string>();

// More reliable mobile detection - only disable on actual mobile devices
// const isMobile = typeof window !== 'undefined' && (
//   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
//   window.innerWidth < 480
// );

export const FileThumbnail = ({ fileName, propertyId, size = 64, className = '' }: FileThumbnailProps) => {
  const [showImage, setShowImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const cacheKey = `${propertyId}:${fileName}`;

  // Only support images that are likely to be small/fast
  const isOptimizableImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension);
  
     // Temporarily enable thumbnails on all devices for testing
   // if (isMobile && isOptimizableImage) {
   //   return (
   //     <div className={className}>
   //       <FileIcon type={fileExtension} size={size} />
   //     </div>
   //   );
   // }

  // Intersection Observer with very aggressive settings
  useEffect(() => {
    if (!isOptimizableImage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.01, // Start immediately when just visible
        rootMargin: '100px' // Load well before coming into view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isOptimizableImage]);

  // Ultra-fast image loading with immediate fallback
  useEffect(() => {
    if (!isInView || !isOptimizableImage) return;
    if (failedImages.has(cacheKey)) return;

    const loadImage = async () => {
      try {
        // Check if we have a cached image object
        const cachedImg = imageCache.get(cacheKey);
        if (cachedImg) {
          setPreviewUrl(cachedImg.src);
          setShowImage(true);
          return;
        }

        // Get or fetch signed URL
        let signedUrl = urlCache.get(cacheKey);
        if (!signedUrl) {
          signedUrl = await getFileSignedUrl(propertyId, fileName, false);
          urlCache.set(cacheKey, signedUrl);
        }

                 // Use the original signed URL (Supabase doesn't support transformation params)
         const optimizedUrl = signedUrl;

                 // Preload with reasonable timeout
         const img = new window.Image();
         const timeoutId = setTimeout(() => {
           failedImages.add(cacheKey);
           img.onload = null;
           img.onerror = null;
         }, 5000); // 5 second max wait

        img.onload = () => {
          clearTimeout(timeoutId);
          imageCache.set(cacheKey, img);
          setPreviewUrl(optimizedUrl);
          setShowImage(true);
        };

        img.onerror = () => {
          clearTimeout(timeoutId);
          failedImages.add(cacheKey);
        };

        img.src = optimizedUrl;

      } catch {
        failedImages.add(cacheKey);
      }
    };

    // Load immediately, no delay
    loadImage();
  }, [isInView, isOptimizableImage, propertyId, fileName, size, cacheKey]);

  // For non-optimizable images or fallback, just show icons
  if (!isOptimizableImage || failedImages.has(cacheKey)) {
    return (
      <div ref={containerRef} className={className}>
        <FileIcon type={fileExtension} size={size} />
      </div>
    );
  }

  // For optimizable images: show icon OR image (no progressive loading)
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ width: size, height: size }}
    >
             {showImage && previewUrl ? (
         <Image
           src={previewUrl}
           alt={fileName}
           fill
           className="object-cover"
           style={{ imageRendering: 'auto' }}
         />
       ) : (
        <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
          <FileIcon type={fileExtension} size={Math.floor(size * 0.7)} />
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
    </div>
  );
}; 