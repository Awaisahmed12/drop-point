import { logger } from '../src/utils/logger';
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
 * Generates a non-colliding filename. Scope is the WHOLE PROPERTY, not the
 * containing folder, because storage paths are flat: every file lives at
 * `${propertyId}/${file_name}` regardless of folder_id. Two files in
 * different DB folders with the same file_name would map to the same
 * storage object — uploads + renames + moves would all fail 400 at the
 * storage layer.
 *
 * The `folderId` parameter is ignored. It's retained in the signature so
 * existing callers keep compiling; remove it on the next refactor.
 *
 * `excludeFileId` lets callers carve their own row out of the check when
 * the operation is on an existing file (rename, move) — without it,
 * renaming "report.pdf" → "report.pdf" would always claim the name is
 * taken (by the file itself).
 */
export function getUniqueFileName(
  baseName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _folderId: string | null,
  propertyFiles: PropertyFile[],
  excludeFileId?: string,
): string {
  const others = excludeFileId
    ? propertyFiles.filter(f => f.id !== excludeFileId)
    : propertyFiles;
  const [nameWithoutExt, ext] = splitFileNameAndExt(baseName);

  let counter = 1;
  let newName = baseName;

  while (others.some(f => f.file_name === newName)) {
    newName = `${nameWithoutExt} (${counter})${ext}`;
    counter++;
  }

  return newName;
}

/**
 * Generates a name for a duplicated file, Windows-style:
 *
 *   report.pdf            -> report - Copy.pdf
 *   report - Copy.pdf     -> report - Copy (2).pdf
 *   report - Copy (2).pdf -> report - Copy (3).pdf
 *
 * Same property-wide scope as getUniqueFileName (see note there).
 *
 * Distinct from getUniqueFileName: this is for the "Duplicate" action, so
 * the " - Copy" marker stays as a visual cue. getUniqueFileName is for
 * upload-conflict resolution and uses the simpler "(1)", "(2)" suffix.
 */
export function getDuplicateFileName(
  originalName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _folderId: string | null,
  propertyFiles: PropertyFile[],
): string {
  const [nameWithoutExt, ext] = splitFileNameAndExt(originalName);

  // Strip an existing " - Copy" or " - Copy (N)" suffix so duplicating a copy
  // produces "name - Copy (2).ext" instead of "name - Copy - Copy.ext".
  const copySuffix = / - Copy(?: \((\d+)\))?$/;
  const stripped = nameWithoutExt.replace(copySuffix, '');

  const candidate = (n: number) => n === 1 ? `${stripped} - Copy${ext}` : `${stripped} - Copy (${n})${ext}`;

  let n = 1;
  while (propertyFiles.some(f => f.file_name === candidate(n))) {
    n += 1;
  }
  return candidate(n);
}

/**
 * Sanitizes a filename by removing/replacing invalid characters and making it URL-safe
 */
export function sanitizeFileName(name: string): string {
  logger.debug('[SANITIZE] Starting sanitization for:', name);
  
  if (!name) {
    logger.debug('[SANITIZE] Empty name, returning default:', 'unnamed_file');
    return 'unnamed_file';
  }
  
  // First, normalize Unicode characters
  const normalized = name.normalize('NFD');
  logger.debug('[SANITIZE] After normalization:', normalized);
  
  // Split into name and extension
  const lastDot = normalized.lastIndexOf('.');
  const nameWithoutExt = lastDot === -1 ? normalized : normalized.substring(0, lastDot);
  const ext = lastDot === -1 ? '' : normalized.substring(lastDot);
  logger.debug('[SANITIZE] Split - name:', nameWithoutExt, 'ext:', ext);
  
  // Clean the name part
  let cleanName = nameWithoutExt
    // Replace common problematic characters (but keep spaces)
    .replace(/[<>:"/\\|?*]/g, '_')
    // Replace Chinese/Unicode characters with transliteration or underscore
    .replace(/[\u4e00-\u9fff]/g, '_') // Chinese characters
    .replace(/[\u3040-\u309f]/g, '_') // Hiragana
    .replace(/[\u30a0-\u30ff]/g, '_') // Katakana
    .replace(/[\u0400-\u04ff]/g, '_') // Cyrillic
    .replace(/[\u0590-\u05ff]/g, '_') // Hebrew
    .replace(/[\u0600-\u06ff]/g, '_') // Arabic
    // Replace any remaining non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '_')
    // Collapse multiple consecutive underscores (but preserve spaces)
    .replace(/_+/g, '_')
    // Collapse multiple consecutive spaces to single space (but keep the space)
    .replace(/\s+/g, ' ')
    // Remove leading/trailing underscores and spaces
    .replace(/^[\s_]+|[\s_]+$/g, '')
    .trim();
  
  logger.debug('[SANITIZE] After character replacement:', cleanName);
  
  // If name is empty after cleaning, use a default
  if (!cleanName) {
    cleanName = 'file';
    logger.debug('[SANITIZE] Name was empty after cleaning, using default:', cleanName);
  }
  
  // Clean the extension
  const cleanExt = ext
    .replace(/[^\w.-]/g, '')
    .toLowerCase();
  
  logger.debug('[SANITIZE] Cleaned extension:', cleanExt);
  
  // Combine and limit length
  const result = (cleanName + cleanExt).substring(0, 200);
  
  // Ensure it doesn't start with a dot
  const finalResult = result.startsWith('.') ? 'file' + result : result;
  
  logger.debug('[SANITIZE] Final result:', finalResult);
  return finalResult;
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
