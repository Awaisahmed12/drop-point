import { describe, it, expect } from 'vitest';
import type { PropertyFile } from '../types';
import {
  splitFileNameAndExt,
  getFileNameWithoutExtension,
  getUniqueFileName,
  getDuplicateFileName,
  sanitizeFileName,
  validateFolderName,
  getFileExtension,
  isImageFile,
  isDocumentFile,
  isSpreadsheetFile,
  isPresentationFile,
  isVideoFile,
  formatFileSize,
  shortAddress,
} from './fileManagement';

// Minimal PropertyFile factory — only sets the fields the helpers actually
// read. Lets tests stay focused on the behavior under test instead of
// hand-rolling 10-field objects.
const file = (overrides: Partial<PropertyFile> & { file_name: string }): PropertyFile => ({
  id: overrides.id ?? 'id',
  property_id: overrides.property_id ?? 'prop',
  folder_id: overrides.folder_id ?? null,
  file_name: overrides.file_name,
  file_url: overrides.file_url ?? `prop/${overrides.file_name}`,
  uploaded_at: overrides.uploaded_at ?? '2024-01-01T00:00:00.000Z',
  user_id: overrides.user_id ?? 'user',
  file_type: overrides.file_type ?? 'application/octet-stream',
  file_size: overrides.file_size ?? 0,
});

describe('splitFileNameAndExt', () => {
  it('splits on the last dot', () => {
    expect(splitFileNameAndExt('report.pdf')).toEqual(['report', '.pdf']);
    expect(splitFileNameAndExt('archive.tar.gz')).toEqual(['archive.tar', '.gz']);
  });

  it('returns no extension for dotless names', () => {
    expect(splitFileNameAndExt('README')).toEqual(['README', '']);
  });

  it('treats a leading dot as no extension (Unix dotfile semantics)', () => {
    // Different from the formatting.ts variant which uses lastDot === 0
    // as the dotfile guard. fileManagement.ts uses -1 only, so .env is
    // split into ['', '.env']. Lock that behavior in so a future "fix"
    // doesn't accidentally break the rename UX.
    expect(splitFileNameAndExt('.env')).toEqual(['', '.env']);
  });
});

describe('getFileNameWithoutExtension', () => {
  it('strips the last extension', () => {
    expect(getFileNameWithoutExtension('photo.jpg')).toBe('photo');
  });

  it('returns the full name when no extension', () => {
    expect(getFileNameWithoutExtension('LICENSE')).toBe('LICENSE');
  });
});

describe('getUniqueFileName', () => {
  it('returns the input unchanged when no conflict', () => {
    expect(getUniqueFileName('a.txt', null, [])).toBe('a.txt');
  });

  it('only conflicts within the same folder', () => {
    const files = [file({ file_name: 'a.txt', folder_id: 'other' })];
    expect(getUniqueFileName('a.txt', null, files)).toBe('a.txt');
  });

  it('appends (1) on first conflict', () => {
    const files = [file({ file_name: 'a.txt' })];
    expect(getUniqueFileName('a.txt', null, files)).toBe('a (1).txt');
  });

  it('escalates the suffix until a name is free', () => {
    const files = [
      file({ id: '1', file_name: 'a.txt' }),
      file({ id: '2', file_name: 'a (1).txt' }),
      file({ id: '3', file_name: 'a (2).txt' }),
    ];
    expect(getUniqueFileName('a.txt', null, files)).toBe('a (3).txt');
  });

  it('handles names without an extension', () => {
    const files = [file({ file_name: 'README' })];
    expect(getUniqueFileName('README', null, files)).toBe('README (1)');
  });
});

describe('getDuplicateFileName', () => {
  it('appends " - Copy" on first duplicate', () => {
    expect(getDuplicateFileName('report.pdf', null, [])).toBe('report - Copy.pdf');
  });

  it('uses " - Copy (2)" when a single Copy already exists', () => {
    const files = [file({ file_name: 'report - Copy.pdf' })];
    expect(getDuplicateFileName('report.pdf', null, files)).toBe('report - Copy (2).pdf');
  });

  it('keeps incrementing past existing copies', () => {
    const files = [
      file({ id: '1', file_name: 'report - Copy.pdf' }),
      file({ id: '2', file_name: 'report - Copy (2).pdf' }),
      file({ id: '3', file_name: 'report - Copy (3).pdf' }),
    ];
    expect(getDuplicateFileName('report.pdf', null, files)).toBe('report - Copy (4).pdf');
  });

  it('strips an existing " - Copy" suffix so duplicate of duplicate stays clean', () => {
    // The key contract: duplicating "doc - Copy.pdf" should NOT produce
    // "doc - Copy - Copy.pdf" — it produces "doc - Copy (2).pdf".
    const files = [file({ file_name: 'doc - Copy.pdf' })];
    expect(getDuplicateFileName('doc - Copy.pdf', null, files)).toBe('doc - Copy (2).pdf');
  });

  it('strips an existing " - Copy (N)" suffix', () => {
    const files = [
      file({ id: '1', file_name: 'doc - Copy.pdf' }),
      file({ id: '2', file_name: 'doc - Copy (2).pdf' }),
    ];
    expect(getDuplicateFileName('doc - Copy (2).pdf', null, files)).toBe('doc - Copy (3).pdf');
  });

  it('only conflicts within the source folder', () => {
    const files = [file({ file_name: 'a - Copy.pdf', folder_id: 'other' })];
    expect(getDuplicateFileName('a.pdf', null, files)).toBe('a - Copy.pdf');
  });

  it('handles files without an extension', () => {
    expect(getDuplicateFileName('README', null, [])).toBe('README - Copy');
  });
});

describe('sanitizeFileName', () => {
  it('returns "unnamed_file" for an empty input', () => {
    expect(sanitizeFileName('')).toBe('unnamed_file');
  });

  it('replaces filesystem-reserved characters', () => {
    expect(sanitizeFileName('a<b>c:d.txt')).toBe('a_b_c_d.txt');
  });

  it('replaces non-ASCII characters with underscores, then falls back to "file" if nothing is left', () => {
    // 文件 -> '__' -> collapse to '_' -> trim to '' -> empty-name fallback
    // kicks in and the helper returns 'file' as the base, plus the extension.
    expect(sanitizeFileName('文件.txt')).toBe('file.txt');
  });

  it('keeps the ASCII portion and trims trailing-underscore from replaced glyphs', () => {
    // The CJK chars at the trailing edge of the name (before the extension
    // split) collapse to a single underscore and then get trimmed by the
    // trailing-boundary `^[\s_]+|[\s_]+$` rule. So "hello文件.txt" -> "hello.txt".
    expect(sanitizeFileName('hello文件.txt')).toBe('hello.txt');
  });

  it('keeps an underscore mid-name (not at a boundary)', () => {
    // CJK glyphs sandwiched between ASCII: the replacement underscore is
    // interior and survives the trim.
    expect(sanitizeFileName('foo文bar.txt')).toBe('foo_bar.txt');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizeFileName('a___b.txt')).toBe('a_b.txt');
  });

  it('preserves spaces (single, not collapsed-away)', () => {
    expect(sanitizeFileName('my report.pdf')).toBe('my report.pdf');
  });

  it('trims leading/trailing whitespace and underscores', () => {
    expect(sanitizeFileName('  _hello_  ')).toBe('hello');
  });

  it('lowercases the extension', () => {
    expect(sanitizeFileName('report.PDF')).toBe('report.pdf');
  });
});

describe('validateFolderName', () => {
  it('rejects empty / whitespace-only names', () => {
    expect(validateFolderName('')).toBe('Folder name is required');
    expect(validateFolderName('   ')).toBe('Folder name is required');
  });

  it('rejects names over 50 characters', () => {
    expect(validateFolderName('a'.repeat(51))).toBe('Folder name must be 50 characters or less');
  });

  it('rejects invalid characters', () => {
    expect(validateFolderName('a/b')).toBe('Folder name contains invalid characters');
    expect(validateFolderName('a*b')).toBe('Folder name contains invalid characters');
  });

  it('returns null for a valid name', () => {
    expect(validateFolderName('My Folder')).toBeNull();
  });
});

describe('getFileExtension / isXxxFile', () => {
  it('extracts the lowercase extension', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg');
    expect(getFileExtension('no-extension')).toBe('');
  });

  it('classifies extension families', () => {
    expect(isImageFile('a.png')).toBe(true);
    expect(isImageFile('a.pdf')).toBe(false);
    expect(isDocumentFile('a.pdf')).toBe(true);
    expect(isSpreadsheetFile('a.xlsx')).toBe(true);
    expect(isPresentationFile('a.pptx')).toBe(true);
    expect(isVideoFile('a.mp4')).toBe(true);
    expect(isVideoFile('a.jpg')).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('uses 1024-based units', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('shows two decimal places at the chosen unit', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

describe('shortAddress', () => {
  it('returns the input unchanged when under the cap', () => {
    expect(shortAddress('123 Main St')).toBe('123 Main St');
  });

  it('truncates with an ellipsis past the cap', () => {
    expect(shortAddress('123 Main Street Suite 4500 Apartment B', 20)).toBe('123 Main Street S...');
  });
});
