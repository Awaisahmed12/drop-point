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

// No-op kept for call-site compatibility
export const preloadThumbnails = async () => {}; 