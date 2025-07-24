import React from 'react';
import { FileIcon } from './FileIcon';

interface FileThumbnailProps {
  fileName: string;
  propertyId: string;
  size?: number;
  className?: string;
}

// Simple, fast, no-lag file icon display
export const FileThumbnail = ({ fileName, size = 64, className = '' }: FileThumbnailProps) => {
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  return (
    <div className={className}>
      <FileIcon type={fileExtension} size={size} />
    </div>
  );
};

// Keep preloadThumbnails function for compatibility but make it a no-op
export const preloadThumbnails = async () => {
  // No-op - thumbnails disabled for performance
  console.log('📁 [THUMBNAILS] Disabled for performance - showing file icons instead');
}; 