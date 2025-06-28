import type { PropertyFile } from '../types';

/**
 * Formats a file size in bytes to a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats a date string to a human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return 'Today';
  } else if (diffDays === 2) {
    return 'Yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  }
}

/**
 * Splits a filename into base name and extension
 */
export function splitFileNameAndExt(name: string): [string, string] {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex === -1) return [name, ''];
  return [name.substring(0, lastDotIndex), name.substring(lastDotIndex)];
}

/**
 * Gets the filename without extension
 */
export function getFileNameWithoutExtension(name: string): string {
  const lastDotIndex = name.lastIndexOf('.');
  return lastDotIndex === -1 ? name : name.substring(0, lastDotIndex);
}

/**
 * Generates a unique filename when there are conflicts
 */
export function getUniqueFileName(baseName: string, folderId: string | null, propertyFiles: PropertyFile[]): string {
  const filesInFolder = propertyFiles.filter(f => f.folder_id === folderId);
  const [nameWithoutExt, ext] = splitFileNameAndExt(baseName);
  
  let counter = 1;
  let newName = baseName;
  
  while (filesInFolder.some(f => f.file_name === newName)) {
    newName = `${nameWithoutExt} (${counter})${ext}`;
    counter++;
  }
  
  return newName;
}

/**
 * Sanitizes a filename by removing/replacing invalid characters
 */
export function sanitizeFileName(name: string): string {
  // Remove or replace invalid characters for file storage
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 255); // Limit length to 255 characters
}

/**
 * Validates a folder name
 */
export function validateFolderName(name: string): string | null {
  if (!name?.trim()) {
    return 'Folder name is required';
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length > 50) {
    return 'Folder name must be 50 characters or less';
  }
  
  if (/[<>:"/\\|?*]/.test(trimmed)) {
    return 'Folder name contains invalid characters';
  }
  
  return null; // Valid
}

/**
 * Shortens an address for display
 */
export function shortAddress(address: string, maxLen = 32): string {
  if (address.length <= maxLen) return address;
  return address.substring(0, maxLen - 3) + '...';
}

/**
 * Gets the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Determines if a file is an image based on its extension
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
}

/**
 * Determines if a file is a document based on its extension
 */
export function isDocumentFile(filename: string): boolean {
  const docExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'pages'];
  const ext = getFileExtension(filename);
  return docExtensions.includes(ext);
}

/**
 * Determines if a file is a spreadsheet based on its extension
 */
export function isSpreadsheetFile(filename: string): boolean {
  const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'numbers'];
  const ext = getFileExtension(filename);
  return spreadsheetExtensions.includes(ext);
}

/**
 * Determines if a file is a presentation based on its extension
 */
export function isPresentationFile(filename: string): boolean {
  const presentationExtensions = ['ppt', 'pptx', 'key'];
  const ext = getFileExtension(filename);
  return presentationExtensions.includes(ext);
}

/**
 * Determines if a file is a video based on its extension
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
  const ext = getFileExtension(filename);
  return videoExtensions.includes(ext);
} 