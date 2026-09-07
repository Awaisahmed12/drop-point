import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import type { Property, PropertyFile, PropertyFolder } from '../../types';

// vi.mock factories are hoisted above imports, so everything they reference
// has to be hoisted too. The global setup pins NODE_ENV=production for the
// logger tests; React's act() only exists in development builds.
const mocks = vi.hoisted(() => {
  vi.stubEnv('NODE_ENV', 'test');
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  type File_ = { file_name: string; folder_id: string | null; [key: string]: unknown };
  type Folder_ = { name: string; parent_id: string | null; [key: string]: unknown };

  const fileService = {
    uploadFile: vi.fn<(file: File, propertyId: string, name: string, folderId: string | null) => Promise<{ path: string }>>(
      async () => ({ path: 'p' }),
    ),
    createFileRecord: vi.fn<(
      propertyId: string, name: string, path: string, type: string, size: number, folderId: string | null, modifiedAt?: string,
    ) => Promise<unknown>>(async () => ({})),
    getPropertyFiles: vi.fn<(propertyId: string) => Promise<File_[]>>(async () => []),
    renameFile: vi.fn(async (file: File_, name: string) => ({ ...file, file_name: name })),
    deleteFile: vi.fn<(file: File_) => Promise<void>>(async () => {}),
    moveFile: vi.fn<(file: File_, folderId: string | null, newName?: string) => Promise<File_>>(
      async (file, folderId) => ({ ...file, folder_id: folderId }),
    ),
    copyFile: vi.fn(async (file: File_, name: string) => ({ ...file, id: 'copy', file_name: name })),
  };
  const folderService = {
    createFolder: vi.fn(async (propertyId: string, name: string, parentId: string | null) => ({
      id: 'new-folder', property_id: propertyId, user_id: 'u1', name, parent_id: parentId,
      created_at: '', updated_at: '', deleted_at: null,
    })),
    renameFolder: vi.fn(async (folder: Folder_, name: string) => ({ ...folder, name })),
    deleteFolder: vi.fn<(folderId: string) => Promise<void>>(async () => {}),
  };
  return {
    fileService,
    folderService,
    showToast: vi.fn(),
    invalidatePropertyCache: vi.fn(),
    getUserUsageBytes: vi.fn<(userId: string) => Promise<number>>(async () => 0),
  };
});
const { fileService, folderService, showToast, invalidatePropertyCache, getUserUsageBytes } = mocks;

vi.mock('../services', () => ({ fileService: mocks.fileService, folderService: mocks.folderService }));
vi.mock('../utils/supabaseClient', () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) } },
}));
vi.mock('../utils/usage', () => ({ getUserUsageBytes: mocks.getUserUsageBytes }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock('./usePropertyPrefetch', () => ({ invalidatePropertyCache: mocks.invalidatePropertyCache }));

import { usePropertyFileActions } from './usePropertyFileActions';

const property: Property = { id: 'prop-1', address: '1 Main St', lat: 0, lng: 0, label: null, notes: null };

const file = (overrides: Partial<PropertyFile>): PropertyFile => ({
  id: 'f1', property_id: 'prop-1', folder_id: null, file_name: 'photo.jpg', file_url: 'prop-1/photo.jpg',
  uploaded_at: '', user_id: 'u1', file_type: 'image/jpeg', file_size: 10, ...overrides,
});
const folder = (overrides: Partial<PropertyFolder>): PropertyFolder => ({
  id: 'd1', property_id: 'prop-1', user_id: 'u1', name: 'Docs', parent_id: null,
  created_at: '', updated_at: '', deleted_at: null, ...overrides,
});

interface HarnessOptions {
  property?: Property | null;
  files?: PropertyFile[];
  folders?: PropertyFolder[];
  selectedFolder?: string;
  ensurePropertyId?: () => Promise<string | null>;
}

function useHarness(options: HarnessOptions) {
  const [files, setFiles] = useState(options.files ?? []);
  const [folders, setFolders] = useState(options.folders ?? []);
  const actions = usePropertyFileActions({
    property: options.property === undefined ? property : options.property,
    files,
    setFiles,
    folders,
    setFolders,
    selectedFolder: options.selectedFolder ?? 'master',
    ensurePropertyId: options.ensurePropertyId,
  });
  return { actions, files, folders };
}

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

beforeEach(() => {
  vi.clearAllMocks();
  getUserUsageBytes.mockResolvedValue(0);
});

describe('usePropertyFileActions', () => {
  it('uploads with names unique against existing files and within the batch', async () => {
    fileService.getPropertyFiles.mockResolvedValue([]);
    const { result } = renderHook(() => useHarness({ files: [file({ file_name: 'photo.jpg' })] }));

    await act(async () => {
      await result.current.actions.uploadFiles([
        new File(['a'], 'photo.jpg'),
        new File(['b'], 'photo.jpg'),
      ]);
    });
    await flush();

    const uploadedNames = fileService.uploadFile.mock.calls.map(call => call[2]);
    expect(uploadedNames).toEqual(['photo (1).jpg', 'photo (2).jpg']);
    expect(fileService.createFileRecord).toHaveBeenCalledTimes(2);
    expect(invalidatePropertyCache).toHaveBeenCalledWith('prop-1');
  });

  it('blocks uploads that would exceed the free-tier quota', async () => {
    getUserUsageBytes.mockResolvedValue(Number.MAX_SAFE_INTEGER);
    const { result } = renderHook(() => useHarness({}));

    await act(async () => {
      await result.current.actions.uploadFiles([new File(['a'], 'big.pdf')]);
    });
    await flush();

    expect(fileService.uploadFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/storage limit/i), 'warning');
    expect(result.current.actions.pendingUploads).toEqual([]);
  });

  it('persists an unsaved pin before the first upload, and aborts if that fails', async () => {
    const unsaved: Property = { ...property, id: null };
    const ensurePropertyId = vi.fn(async () => null);
    const { result } = renderHook(() => useHarness({ property: unsaved, ensurePropertyId }));

    await act(async () => {
      await result.current.actions.uploadFiles([new File(['a'], 'a.txt')]);
    });

    expect(ensurePropertyId).toHaveBeenCalledTimes(1);
    expect(fileService.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads into the selected folder', async () => {
    const { result } = renderHook(() => useHarness({ selectedFolder: 'd1', folders: [folder({})] }));

    await act(async () => {
      await result.current.actions.uploadFiles([new File(['a'], 'a.txt')]);
    });
    await flush();

    expect(fileService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'prop-1', 'a.txt', 'd1');
    expect(fileService.createFileRecord.mock.calls[0][5]).toBe('d1');
  });

  it('rejects a rename that collides with a sibling file', async () => {
    const files = [file({ id: 'f1', file_name: 'a.pdf' }), file({ id: 'f2', file_name: 'b.pdf' })];
    const { result } = renderHook(() => useHarness({ files }));

    await expect(result.current.actions.renameItem(files[0], 'B.pdf')).rejects.toThrow(/already exists/);
    expect(fileService.renameFile).not.toHaveBeenCalled();
  });

  it('renames a file and updates local state', async () => {
    const files = [file({ id: 'f1', file_name: 'a.pdf' })];
    const { result } = renderHook(() => useHarness({ files }));

    await act(async () => {
      await result.current.actions.renameItem(files[0], 'report.pdf');
    });

    expect(fileService.renameFile).toHaveBeenCalledWith(files[0], 'report.pdf');
    expect(result.current.files[0].file_name).toBe('report.pdf');
    expect(invalidatePropertyCache).toHaveBeenCalledWith('prop-1');
  });

  it('throws DUPLICATE_FOLDER for a same-named sibling folder', async () => {
    const { result } = renderHook(() => useHarness({ folders: [folder({ name: 'Docs' })] }));

    await expect(result.current.actions.createFolder('docs')).rejects.toThrow('DUPLICATE_FOLDER');
    expect(folderService.createFolder).not.toHaveBeenCalled();
  });

  it('creates a folder under the current folder and appends it', async () => {
    const { result } = renderHook(() => useHarness({ folders: [folder({})], selectedFolder: 'd1' }));

    await act(async () => {
      await result.current.actions.createFolder('Inspections');
    });

    expect(folderService.createFolder).toHaveBeenCalledWith('prop-1', 'Inspections', 'd1');
    expect(result.current.folders.map(f => f.name)).toEqual(['Docs', 'Inspections']);
  });

  it('refuses to delete a folder that still has contents', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const folders = [folder({ id: 'd1' })];
    const { result } = renderHook(() => useHarness({ folders, files: [file({ folder_id: 'd1' })] }));

    await act(async () => {
      await result.current.actions.deleteFolder(folders[0]);
    });

    expect(folderService.deleteFolder).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/must be empty/i), 'warning');
    confirmSpy.mockRestore();
  });

  it('deletes a file after confirmation and removes it from state', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const files = [file({ id: 'f1' }), file({ id: 'f2', file_name: 'b.pdf' })];
    const { result } = renderHook(() => useHarness({ files }));

    await act(async () => {
      await result.current.actions.deleteFile(files[0]);
    });

    expect(fileService.deleteFile).toHaveBeenCalledWith(files[0]);
    expect(result.current.files.map(f => f.id)).toEqual(['f2']);
    confirmSpy.mockRestore();
  });

  it('moves a file, renaming it if the target folder already has that name', async () => {
    const files = [file({ id: 'f1', file_name: 'a.pdf', folder_id: null }), file({ id: 'f2', file_name: 'a.pdf', folder_id: 'd1' })];
    const { result } = renderHook(() => useHarness({ files }));

    await act(async () => {
      await result.current.actions.moveFile(files[0], 'd1');
    });

    expect(fileService.moveFile).toHaveBeenCalledWith(files[0], 'd1', 'a (1).pdf');
  });

  it('duplicates a file with a "- Copy" name and prepends it', async () => {
    const files = [file({ id: 'f1', file_name: 'a.pdf' })];
    const { result } = renderHook(() => useHarness({ files }));

    await act(async () => {
      await result.current.actions.copyFile(files[0]);
    });

    expect(fileService.copyFile).toHaveBeenCalledWith(files[0], 'a - Copy.pdf');
    expect(result.current.files.map(f => f.id)).toEqual(['copy', 'f1']);
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/Duplicated/), 'success');
  });
});
