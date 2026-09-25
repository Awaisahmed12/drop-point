import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { PendingUpload, Property, PropertyFile, PropertyFolder, Visibility } from '../../types';
import { fileService, folderService, propertyService } from '../services';
import { supabase } from '../utils/supabaseClient';
import { getUserUsageBytes } from '../utils/usage';
import { FREE_TIER_GB, FREE_TIER_MAX_BYTES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../../constants';
import { getDuplicateFileName, getUniqueFileName, sanitizeFileName } from '../../utils/fileManagement';
import { invalidatePropertyCache } from './usePropertyPrefetch';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

interface UsePropertyFileActionsOptions {
  property: Property | null;
  files: PropertyFile[];
  setFiles: Dispatch<SetStateAction<PropertyFile[]>>;
  folders: PropertyFolder[];
  setFolders: Dispatch<SetStateAction<PropertyFolder[]>>;
  /** 'master' for the property root, otherwise a folder id. */
  selectedFolder: string;
  /**
   * Called before the first write when `property.id` is null (a freshly
   * dropped, unsaved pin). Must persist the property and return its id, or
   * return null after surfacing an error to the user.
   */
  ensurePropertyId?: () => Promise<string | null>;
  /**
   * What a new file or folder at the property root is. Uploads inside a
   * folder take the folder's setting instead. Owners default to private;
   * a page passes 'shared' for someone collaborating on another person's
   * property, where the point of adding something is that the team sees it.
   */
  defaultVisibility?: Visibility;
}

const FOLDER_NAME_FORBIDDEN = /[<>:"/\\|?*]/g;
const sanitizeFolderName = (name: string) => name.replace(FOLDER_NAME_FORBIDDEN, '_').substring(0, 50).trim();

/**
 * Every file/folder mutation the property details modal can trigger, shared
 * by the map and list pages so both entry points behave identically. The
 * hook owns pending-upload state; the page owns files/folders state and
 * passes the setters in.
 *
 * Errors are thrown (not swallowed) from rename/createFolder so the modal can
 * render its inline messages; the remaining actions toast directly.
 */
export function usePropertyFileActions({
  property,
  files,
  setFiles,
  folders,
  setFolders,
  selectedFolder,
  ensurePropertyId,
  defaultVisibility = 'private',
}: UsePropertyFileActionsOptions) {
  const { showToast } = useToast();
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const propertyId = property?.id ?? null;
  const folderIdForWrites = selectedFolder === 'master' ? null : selectedFolder;

  /** New things inherit the folder they land in; at the root, the page's default. */
  const visibilityIn = useCallback((folderId: string | null): Visibility => {
    if (!folderId) return defaultVisibility;
    return folders.find(f => f.id === folderId)?.visibility ?? 'private';
  }, [folders, defaultVisibility]);
  const visibilityForWrites = visibilityIn(folderIdForWrites);

  // Uploads belong to the property they started on.
  useEffect(() => {
    setPendingUploads([]);
  }, [propertyId]);

  // Warn before navigating away mid-upload.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingUploads.some(p => p.status === 'uploading')) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingUploads]);

  const resolvePropertyId = useCallback(async (): Promise<string | null> => {
    if (propertyId) return propertyId;
    if (!property) {
      showToast('Please select a property first.', 'warning');
      return null;
    }
    if (!ensurePropertyId) {
      showToast('This property has not been saved yet.', 'warning');
      return null;
    }
    return ensurePropertyId();
  }, [propertyId, property, ensurePropertyId, showToast]);

  const dismissPendingUpload = useCallback((uploadId: string) => {
    setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
  }, []);

  const startSingleUpload = useCallback(async (
    uploadId: string,
    file: File,
    uniqueName: string,
    targetPropertyId: string,
    folderId: string | null,
    visibility: Visibility,
    /** Set for the property's very first document: its success is the end of onboarding. */
    firstDocumentFor?: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('You must be logged in to upload files.');
      setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      return;
    }

    // Free-tier quota check. Fail closed if usage can't be read.
    try {
      const usedBytes = await getUserUsageBytes(user.id);
      if (usedBytes + file.size > FREE_TIER_MAX_BYTES) {
        showToast(`Storage limit reached (${FREE_TIER_GB} GB). Delete files to free up space.`, 'warning');
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
        return;
      }
    } catch (err) {
      logger.error('[USAGE] Failed to check usage. Blocking upload for safety.', err);
      showToast('Unable to verify storage usage. Please try again shortly.');
      setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      return;
    }

    try {
      await fileService.uploadFile(file, targetPropertyId, uniqueName, folderId);
      setPendingUploads(prev => prev.map(p => (p.id === uploadId ? { ...p, progress: 90 } : p)));

      // The storage upload succeeded; retry the metadata insert once so a
      // transient DB hiccup doesn't orphan the blob.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await fileService.createFileRecord(
            targetPropertyId,
            uniqueName,
            `${targetPropertyId}/${uniqueName}`,
            file.type,
            file.size,
            folderId,
            new Date(file.lastModified).toISOString(),
            visibility,
          );
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (lastError) throw lastError;

      setPendingUploads(prev => prev.map(p => (p.id === uploadId ? { ...p, status: 'success', progress: 100 } : p)));
      if (firstDocumentFor) showToast(`Saved. It's here whenever you're at ${firstDocumentFor}.`, 'success');

      const refreshed = await fileService.getPropertyFiles(targetPropertyId);
      setFiles(refreshed);
      invalidatePropertyCache(targetPropertyId);
    } catch (error) {
      logger.error('[UPLOAD] Upload failed:', error);
      const message = error instanceof Error ? error.message : 'Upload failed';
      setPendingUploads(prev => prev.map(p => (p.id === uploadId ? { ...p, status: 'error', progress: 0, error: message } : p)));
    }
  }, [setFiles, showToast]);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    // Storage rejects anything over the per-file limit; say so up front
    // instead of letting the upload fail partway.
    const selected = Array.from(fileList);
    const filesArray = selected.filter(file => file.size <= MAX_FILE_SIZE_BYTES);
    const tooLarge = selected.length - filesArray.length;
    if (tooLarge > 0) {
      showToast(
        tooLarge === 1
          ? `A file is larger than ${MAX_FILE_SIZE_MB} MB and was skipped.`
          : `${tooLarge} files are larger than ${MAX_FILE_SIZE_MB} MB and were skipped.`,
        'warning',
      );
    }
    if (filesArray.length === 0) return;

    const targetPropertyId = await resolvePropertyId();
    if (!targetPropertyId) return;

    const folderId = folderIdForWrites;
    const visibility = visibilityForWrites;
    // Track names assigned within this batch so two "photo.jpg" in one
    // selection don't both resolve to the same unique name.
    const taken: PropertyFile[] = [...files];

    const newPendingUploads: PendingUpload[] = filesArray.map(file => {
      const uniqueName = getUniqueFileName(sanitizeFileName(file.name), folderId, taken);
      taken.push({ file_name: uniqueName, folder_id: folderId } as PropertyFile);

      const uploadId = Math.random().toString(36).substring(2, 15);
      const abortController = new AbortController();

      return {
        id: uploadId,
        name: uniqueName,
        file,
        status: 'uploading' as const,
        progress: 0,
        property_id: targetPropertyId,
        folder_id: folderId,
        abortController,
        cancel: () => {
          abortController.abort();
          setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
        },
        retry: () => {
          setPendingUploads(prev => prev.map(p =>
            p.id === uploadId ? { ...p, status: 'uploading', progress: 0, error: undefined } : p
          ));
          void startSingleUpload(uploadId, file, uniqueName, targetPropertyId, folderId, visibility);
        },
      };
    });

    const firstDocument = files.length === 0 && folders.length === 0 && property
      ? property.label || property.address
      : undefined;
    setPendingUploads(prev => [...prev, ...newPendingUploads]);
    newPendingUploads.forEach((pending, i) => {
      void startSingleUpload(pending.id, pending.file, pending.name, targetPropertyId, folderId, visibility, i === 0 ? firstDocument : undefined);
    });
  }, [files, folders, property, folderIdForWrites, visibilityForWrites, resolvePropertyId, startSingleUpload, showToast]);

  /** Throws on failure so the caller can show a contextual message. */
  const renameItem = useCallback(async (item: PropertyFile | PropertyFolder, newName: string) => {
    const trimmed = newName.trim();
    const originalName = 'file_name' in item ? item.file_name : item.name;
    if (!trimmed || trimmed === originalName) return;

    if ('file_name' in item) {
      const sanitized = sanitizeFileName(trimmed);
      if (!sanitized) throw new Error('Invalid file name.');
      const clash = files.find(f =>
        f.id !== item.id && f.folder_id === item.folder_id && f.file_name.toLowerCase() === sanitized.toLowerCase()
      );
      if (clash) throw new Error('A file with this name already exists in this folder.');
      const updated = await fileService.renameFile(item, sanitized);
      setFiles(prev => prev.map(f => (f.id === item.id ? updated : f)));
    } else {
      const sanitized = sanitizeFolderName(trimmed);
      if (!sanitized) throw new Error('Invalid folder name.');
      const clash = folders.find(f =>
        f.id !== item.id && f.parent_id === item.parent_id && f.name.toLowerCase() === sanitized.toLowerCase()
      );
      if (clash) throw new Error('A folder with this name already exists here.');
      const updated = await folderService.renameFolder(item, sanitized);
      setFolders(prev => prev.map(f => (f.id === item.id ? updated : f)));
    }
    if (propertyId) invalidatePropertyCache(propertyId);
  }, [files, folders, propertyId, setFiles, setFolders]);

  const deleteFile = useCallback(async (file: PropertyFile) => {
    if (!window.confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;
    try {
      await fileService.deleteFile(file);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      invalidatePropertyCache(file.property_id);
    } catch (error) {
      showToast(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [setFiles, showToast]);

  const deleteFolder = useCallback(async (folder: PropertyFolder) => {
    const hasChildren = folders.some(f => f.parent_id === folder.id) || files.some(f => f.folder_id === folder.id);
    if (hasChildren) {
      showToast('Folder must be empty before it can be deleted.', 'warning');
      return;
    }
    if (!window.confirm(`Delete the folder "${folder.name}"?`)) return;
    try {
      await folderService.deleteFolder(folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      invalidatePropertyCache(folder.property_id);
    } catch (error) {
      showToast(`Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [files, folders, setFolders, showToast]);

  /** Throws DUPLICATE_FOLDER on a name clash so the modal can say so inline. */
  const createFolder = useCallback(async (name: string) => {
    const sanitized = sanitizeFolderName(name);
    if (!sanitized) throw new Error('Invalid folder name.');

    const targetPropertyId = await resolvePropertyId();
    if (!targetPropertyId) return;

    const clash = folders.find(f =>
      f.parent_id === folderIdForWrites && f.name.toLowerCase() === sanitized.toLowerCase()
    );
    if (clash) throw new Error('DUPLICATE_FOLDER');

    const created = await folderService.createFolder(targetPropertyId, sanitized, folderIdForWrites, visibilityForWrites);
    setFolders(prev => [...prev, created]);
    invalidatePropertyCache(targetPropertyId);
  }, [folders, folderIdForWrites, visibilityForWrites, resolvePropertyId, setFolders]);

  const moveFile = useCallback(async (file: PropertyFile, targetFolderId: string | null) => {
    if (file.folder_id === targetFolderId) return;
    try {
      const candidate = sanitizeFileName(getUniqueFileName(file.file_name, targetFolderId, files));
      if (!candidate) {
        showToast('Invalid file name. Please rename the file and try again.', 'warning');
        return;
      }
      const newName = candidate === file.file_name ? undefined : candidate;
      // Into a folder: take on the folder's sharing. Back to the root: keep its own.
      const visibility = targetFolderId ? visibilityIn(targetFolderId) : undefined;
      const updated = await fileService.moveFile(file, targetFolderId, newName, visibility);
      setFiles(prev => prev.map(f => (f.id === file.id ? updated : f)));
      invalidatePropertyCache(file.property_id);
    } catch (error) {
      logger.error('[MOVE] Error moving file:', error);
      showToast(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [files, setFiles, showToast, visibilityIn]);

  /** Share a file with everyone on the property, or take it back. */
  const setFileVisibility = useCallback(async (file: PropertyFile, visibility: Visibility) => {
    try {
      const updated = await fileService.setVisibility(file, visibility);
      setFiles(prev => prev.map(f => (f.id === file.id ? updated : f)));
      invalidatePropertyCache(file.property_id);
      showToast(visibility === 'shared' ? 'Shared with everyone on this property' : 'Now private to you', 'success');
    } catch (error) {
      logger.error('[SHARE] Error changing file visibility:', error);
      showToast(`Couldn’t change sharing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [setFiles, showToast]);

  /**
   * Share a folder and its contents, or make them private. The database
   * cascades, so files and folders are re-read to show the result.
   */
  const setFolderVisibility = useCallback(async (folder: PropertyFolder, visibility: Visibility) => {
    try {
      await folderService.setVisibility(folder.id, visibility);
      const data = await propertyService.getPropertyData(folder.property_id);
      setFolders(data.folders);
      setFiles(data.files);
      invalidatePropertyCache(folder.property_id);
      showToast(visibility === 'shared' ? `“${folder.name}” is shared with everyone on this property` : `“${folder.name}” is now private to you`, 'success');
    } catch (error) {
      logger.error('[SHARE] Error changing folder visibility:', error);
      showToast(`Couldn’t change sharing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [setFiles, setFolders, showToast]);

  const copyFile = useCallback(async (file: PropertyFile) => {
    try {
      const duplicateName = sanitizeFileName(getDuplicateFileName(file.file_name, file.folder_id, files));
      if (!duplicateName) {
        showToast('Could not generate a valid duplicate name.', 'warning');
        return;
      }
      const created = await fileService.copyFile(file, duplicateName);
      setFiles(prev => [created, ...prev]);
      invalidatePropertyCache(file.property_id);
      showToast(`Duplicated as "${created.file_name}"`, 'success');
    } catch (error) {
      logger.error('[COPY] Error duplicating file:', error);
      showToast(`Failed to duplicate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [files, setFiles, showToast]);

  return {
    pendingUploads,
    dismissPendingUpload,
    uploadFiles,
    renameItem,
    deleteFile,
    deleteFolder,
    createFolder,
    moveFile,
    copyFile,
    setFileVisibility,
    setFolderVisibility,
  };
}
