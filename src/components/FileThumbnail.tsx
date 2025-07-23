import React, { useState, useEffect } from 'react';
import { FileIcon } from './FileIcon';
import { getFileSignedUrl } from '../utils/supabaseClient';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

export const FileThumbnail = ({ fileName, propertyId, size = 64, className = '' }: FileThumbnailProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'text' | 'none'>('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

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

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const type = getPreviewType(fileExtension);
        setPreviewType(type);

        if (type === 'none') {
          setLoading(false);
          return;
        }

        // Get signed URL for the file
        const signedUrl = await getFileSignedUrl(propertyId, fileName, false);
        
        if (type === 'image') {
          // For images, we can directly use the signed URL
          setPreviewUrl(signedUrl);
        } else if (type === 'pdf') {
          // For PDFs, we'll show the first page using PDF.js or similar
          // For now, we'll use a PDF icon but this could be enhanced
          setPreviewUrl(null);
        } else if (type === 'text') {
          // For text files, we could fetch the content and show a preview
          // For now, we'll use the file icon
          setPreviewUrl(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading file preview:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadPreview();
  }, [fileName, propertyId, fileExtension]);

  // Show loading state
  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-lg animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="w-6 h-6 bg-gray-300 rounded"></div>
      </div>
    );
  }

  // Show image preview
  if (previewType === 'image' && previewUrl && !error) {
    return (
      <div 
        className={`relative overflow-hidden rounded-lg bg-gray-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={previewUrl}
          alt={fileName}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          style={{ imageRendering: 'auto' }}
        />
        {/* Subtle overlay to indicate it's a file */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
      </div>
    );
  }

  // For PDFs, show a document preview-style icon with page representation
  if (previewType === 'pdf') {
    return (
      <div 
        className={`relative flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        {/* PDF page representation */}
        <div className="relative w-full h-full p-2">
          <div className="w-full h-full bg-gray-50 rounded border border-gray-200 flex flex-col">
            {/* Header lines representing text */}
            <div className="p-1.5 space-y-1">
              <div className="h-1 bg-red-400 rounded w-3/4"></div>
              <div className="h-0.5 bg-gray-300 rounded w-full"></div>
              <div className="h-0.5 bg-gray-300 rounded w-5/6"></div>
              <div className="h-0.5 bg-gray-300 rounded w-4/5"></div>
            </div>
          </div>
        </div>
        {/* PDF indicator */}
        <div className="absolute bottom-0 right-0 bg-red-500 text-white text-xs px-1 rounded-tl text-center"
             style={{ fontSize: '8px', lineHeight: '12px' }}>
          PDF
        </div>
      </div>
    );
  }

  // For text files, show a document with text lines
  if (previewType === 'text') {
    return (
      <div 
        className={`relative flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Text document representation */}
        <div className="relative w-full h-full p-2">
          <div className="w-full h-full bg-gray-50 rounded border border-gray-200 flex flex-col justify-start p-1.5 space-y-1">
            {/* Text lines */}
            <div className="h-0.5 bg-blue-400 rounded w-2/3"></div>
            <div className="h-0.5 bg-gray-400 rounded w-full"></div>
            <div className="h-0.5 bg-gray-400 rounded w-5/6"></div>
            <div className="h-0.5 bg-gray-400 rounded w-4/5"></div>
            <div className="h-0.5 bg-gray-400 rounded w-3/4"></div>
            <div className="h-0.5 bg-gray-400 rounded w-full"></div>
            <div className="h-0.5 bg-gray-400 rounded w-2/3"></div>
          </div>
        </div>
        {/* File type indicator */}
        <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-xs px-1 rounded-tl text-center"
             style={{ fontSize: '8px', lineHeight: '12px' }}>
          {fileExtension.toUpperCase()}
        </div>
      </div>
    );
  }

  // Fall back to original FileIcon for unsupported types or errors
  return (
    <div className={className}>
      <FileIcon
        type={fileExtension}
        size={size}
      />
    </div>
  );
}; 