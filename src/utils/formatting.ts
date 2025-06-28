// Format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Split file name and extension
export function splitFileNameAndExt(name: string): [string, string] {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return [name, ''];
  return [name.slice(0, lastDot), name.slice(lastDot)];
}

// Get file name without extension
export function getFileNameWithoutExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return name;
  return name.substring(0, lastDot);
}

// Import additional functions from fileManagement.ts to maintain compatibility
export { 
  getUniqueFileName, 
  sanitizeFileName, 
  validateFolderName, 
  shortAddress,
  getFileExtension,
  isImageFile,
  isDocumentFile,
  isSpreadsheetFile,
  isPresentationFile,
  isVideoFile
} from '../../utils/fileManagement'; 