import React, { useState, useEffect, useRef } from 'react';
import { FileIcon } from './FileIcon';
import { getFileSignedUrl } from '../utils/supabaseClient';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

// Cache for signed URLs to prevent re-fetching
const urlCache = new Map<string, string>();

// Cache for failed images to avoid retrying
const failedImages = new Set<string>();

export const FileThumbnail = ({ fileName, propertyId, size = 64, className = '' }: FileThumbnailProps) => {
  const [stage, setStage] = useState<'icon' | 'loading' | 'image' | 'error'>('icon');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const cacheKey = `${propertyId}:${fileName}`;

  // Determine what type of preview we can show
  const getPreviewType = (ext: string): 'image' | 'pdf' | 'text' | 'none' => {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['pdf'].includes(ext)) {
      return 'pdf';
    }
    if (['txt', 'md', 'csv'].includes(ext)) {
      return 'text';
    }
    return 'none';
  };

  const previewType = getPreviewType(fileExtension);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before coming into view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Load image when visible and it's an image type
  useEffect(() => {
    if (!isVisible || previewType !== 'image') return;
    if (failedImages.has(cacheKey)) return; // Skip if we know it failed

    const loadImage = async () => {
      try {
        // Check cache first
        let signedUrl = urlCache.get(cacheKey);
        
        if (!signedUrl) {
          setStage('loading');
          signedUrl = await getFileSignedUrl(propertyId, fileName, false);
          urlCache.set(cacheKey, signedUrl);
        }

        // Preload the image to check if it loads successfully
        const img = new Image();
        img.onload = () => {
          setPreviewUrl(signedUrl!);
          setStage('image');
        };
        img.onerror = () => {
          failedImages.add(cacheKey);
          setStage('error');
        };
        
        // Add image optimization parameters for faster loading
        const optimizedUrl = signedUrl.includes('?') 
          ? `${signedUrl}&w=${size * 2}&h=${size * 2}&fit=cover&quality=80`
          : `${signedUrl}?w=${size * 2}&h=${size * 2}&fit=cover&quality=80`;
        
        img.src = optimizedUrl;
        
      } catch (err) {
        console.error('Error loading image preview:', err);
        failedImages.add(cacheKey);
        setStage('error');
      }
    };

    // Small delay to prioritize visible content first
    const timer = setTimeout(loadImage, 100);
    return () => clearTimeout(timer);
  }, [isVisible, previewType, propertyId, fileName, size, cacheKey]);

  // Always start with FileIcon for instant rendering
  const iconComponent = (
    <div className={className}>
      <FileIcon
        type={fileExtension}
        size={size}
      />
    </div>
  );

  // For non-image types, show enhanced previews immediately
  if (previewType === 'pdf') {
    return (
      <div 
        ref={containerRef}
        className={`relative flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="relative w-full h-full p-2">
          <div className="w-full h-full bg-gray-50 rounded border border-gray-200 flex flex-col">
            <div className="p-1.5 space-y-1">
              <div className="h-1 bg-red-400 rounded w-3/4"></div>
              <div className="h-0.5 bg-gray-300 rounded w-full"></div>
              <div className="h-0.5 bg-gray-300 rounded w-5/6"></div>
              <div className="h-0.5 bg-gray-300 rounded w-4/5"></div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 bg-red-500 text-white text-xs px-1 rounded-tl text-center"
             style={{ fontSize: '8px', lineHeight: '12px' }}>
          PDF
        </div>
      </div>
    );
  }

  if (previewType === 'text') {
    return (
      <div 
        ref={containerRef}
        className={`relative flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="relative w-full h-full p-2">
          <div className="w-full h-full bg-gray-50 rounded border border-gray-200 flex flex-col justify-start p-1.5 space-y-1">
            <div className="h-0.5 bg-blue-400 rounded w-2/3"></div>
            <div className="h-0.5 bg-gray-400 rounded w-full"></div>
            <div className="h-0.5 bg-gray-400 rounded w-5/6"></div>
            <div className="h-0.5 bg-gray-400 rounded w-4/5"></div>
            <div className="h-0.5 bg-gray-400 rounded w-3/4"></div>
            <div className="h-0.5 bg-gray-400 rounded w-full"></div>
            <div className="h-0.5 bg-gray-400 rounded w-2/3"></div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-xs px-1 rounded-tl text-center"
             style={{ fontSize: '8px', lineHeight: '12px' }}>
          {fileExtension.toUpperCase()}
        </div>
      </div>
    );
  }

  // For images: Progressive loading experience
  if (previewType === 'image') {
    return (
      <div 
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Always show icon first for instant feedback */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${
          stage === 'image' ? 'opacity-0' : 'opacity-100'
        }`}>
          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
            <FileIcon type={fileExtension} size={Math.floor(size * 0.6)} />
          </div>
        </div>

        {/* Loading overlay */}
        {stage === 'loading' && (
          <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Actual image */}
        {stage === 'image' && previewUrl && (
          <img
            src={previewUrl}
            alt={fileName}
            className="w-full h-full object-cover transition-opacity duration-300"
            style={{ imageRendering: 'auto' }}
          />
        )}

        {/* Subtle hover overlay for all stages */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
      </div>
    );
  }

  // Fallback for unsupported types
  return (
    <div ref={containerRef}>
      {iconComponent}
    </div>
  );
}; 