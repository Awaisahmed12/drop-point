import React, { useCallback, useState, useRef } from 'react';
import Head from 'next/head';
import { ListView } from '../components/ListView';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import type { Property, PropertyFile, PropertyFolder, PendingUpload } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { withAuth } from '../components/withAuth';
import { fileService, folderService } from '../services';
import { useToast } from '../contexts/ToastContext';
import { getUniqueFileName, sanitizeFileName } from '../../utils/fileManagement';
import { getUserUsageBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES } from '../../constants';

function ListPage() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [snappedLatLng, setSnappedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('master');
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const { showToast } = useToast();
  const setRenamingFileId = useRef<((id: string | null) => void) | null>(null);

  const openProperty = useCallback(async (p: { id: string | null; address: string; lat: number; lng: number; label?: string | null; notes?: string | null; }) => {
    const prop: Property = {
      id: p.id,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      label: p.label ?? null,
      notes: p.notes ?? null,
    };
    setSavedProperty(prop);
    setSnappedLatLng({ lat: p.lat, lng: p.lng });
    setSelectedFolder('master');
    setPendingUploads([]);
    setShowDetailsModal(true);

    setFoldersLoading(true);
    setFilesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && prop.id) {
        const [folderResult, filesResult] = await Promise.all([
          supabase
            .from('property_folders')
            .select('*')
            .eq('property_id', prop.id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
          supabase
            .from('property_files')
            .select('*')
            .eq('property_id', prop.id)
            .order('uploaded_at', { ascending: false })
        ]);
        if (folderResult.data) setFolders(folderResult.data);
        if (filesResult.data) setFiles(filesResult.data);
      } else {
        setFolders([]);
        setFiles([]);
      }
    } catch (e) {
      console.error('Error loading property data:', e);
    } finally {
      setFoldersLoading(false);
      setFilesLoading(false);
    }
  }, []);

  const startSingleUpload = useCallback(async (
    uploadId: string,
    file: File,
    uniqueName: string,
    propertyId: string,
    folderIdForUpload: string | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const usedBytes = await getUserUsageBytes(user.id);
      if (usedBytes + file.size > FREE_TIER_MAX_BYTES) {
        showToast('Storage limit reached (5 GB). Delete files to free up space.', 'warning');
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
        return;
      }
    } catch (err) {
      console.error('[USAGE] Failed to check usage. Blocking upload for safety.', err);
      showToast('Unable to verify storage usage. Please try again shortly.');
      setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      return;
    }

    const filePath = `${propertyId}/${uniqueName}`;

    try {
      await fileService.uploadFile(file, propertyId, uniqueName, folderIdForUpload);

      setPendingUploads(prev => prev.map(p =>
        p.id === uploadId ? { ...p, progress: 90 } : p
      ));

      let retryCount = 0;
      const maxRetries = 2;
      let lastError = null;
      while (retryCount < maxRetries) {
        try {
          await fileService.createFileRecord(
            propertyId,
            uniqueName,
            filePath,
            file.type,
            file.size,
            folderIdForUpload,
            new Date(file.lastModified).toISOString()
          );
          break;
        } catch (error) {
          lastError = error;
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          }
        }
      }
      if (retryCount >= maxRetries && lastError) throw lastError;

      setPendingUploads(prev => prev.map(p =>
        p.id === uploadId ? { ...p, status: 'success', progress: 100 } : p
      ));

      const refreshed = await fileService.getPropertyFiles(propertyId);
      setFiles(refreshed);
    } catch (error) {
      console.error('[UPLOAD] Upload failed:', error);
      setPendingUploads(prev => prev.map(p =>
        p.id === uploadId ? { ...p, status: 'error', progress: 0 } : p
      ));
      throw error;
    }
  }, []);

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0 || !savedProperty?.id) return;

    const propertyId = savedProperty.id;
    const folderIdForUpload = selectedFolder === 'master' ? null : selectedFolder;
    const filesArray = Array.from(fileList);

    const newPendingUploads: PendingUpload[] = filesArray.map(file => {
      const existingFiles = files.filter(f =>
        folderIdForUpload ? f.folder_id === folderIdForUpload : !f.folder_id
      );
      const existingNames = existingFiles.map(f => f.file_name);
      const baseName = sanitizeFileName(file.name);
      let uniqueName = baseName;
      let counter = 1;
      while (existingNames.includes(uniqueName)) {
        const [name, ext] = baseName.includes('.')
          ? [baseName.substring(0, baseName.lastIndexOf('.')), baseName.substring(baseName.lastIndexOf('.'))]
          : [baseName, ''];
        uniqueName = `${name} (${counter})${ext}`;
        counter++;
      }

      const uploadId = Math.random().toString(36).substring(2, 15);
      const abortController = new AbortController();

      const cancel = () => {
        abortController.abort();
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      };
      const retry = () => {
        setPendingUploads(prev => prev.map(p =>
          p.id === uploadId ? { ...p, status: 'uploading', progress: 0, error: undefined } : p
        ));
        startSingleUpload(uploadId, file, uniqueName, propertyId, folderIdForUpload);
      };

      return {
        id: uploadId,
        name: uniqueName,
        file,
        status: 'uploading' as const,
        progress: 0,
        property_id: propertyId,
        folder_id: folderIdForUpload,
        modified_at: new Date(file.lastModified).toISOString(),
        cancel,
        retry,
        abortController,
      };
    });

    setPendingUploads(prev => [...prev, ...newPendingUploads]);
    newPendingUploads.forEach(pending => {
      startSingleUpload(pending.id, pending.file, pending.name, propertyId, folderIdForUpload);
    });
  }, [savedProperty, selectedFolder, files, startSingleUpload]);

  const handleDeleteFile = useCallback(async (file: PropertyFile) => {
    if (!file) return;
    const isConfirmed = window.confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`);
    if (!isConfirmed) return;
    try {
      await fileService.deleteFile(file);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete file';
      showToast(`Failed to delete file: ${msg}`);
    }
  }, []);

  const handleRename = useCallback(async (item: PropertyFile | PropertyFolder, newName: string) => {
    const originalName = 'file_name' in item ? item.file_name : item.name;
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === originalName) {
      if (setRenamingFileId.current) setRenamingFileId.current(null);
      return;
    }

    const isFile = 'file_name' in item;
    try {
      if (isFile) {
        const file = item as PropertyFile;
        const sanitizedNewName = sanitizeFileName(trimmedNewName);
        if (!sanitizedNewName) throw new Error('Invalid file name after sanitization.');
        const existing = files.find(f => f.folder_id === file.folder_id && f.file_name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== file.id);
        if (existing) throw new Error('A file with this name already exists in this folder.');
        const updated = await fileService.renameFile(file, sanitizedNewName);
        setFiles(prev => prev.map(f => f.id === file.id ? updated : f));
      } else {
        const folder = item as PropertyFolder;
        const sanitizedNewName = trimmedNewName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
        const existing = folders.find(f => f.parent_id === folder.parent_id && f.name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== folder.id);
        if (existing) throw new Error('A folder with this name already exists here.');
        const updated = await folderService.renameFolder(folder, sanitizedNewName);
        setFolders(prev => prev.map(f => f.id === folder.id ? updated : f));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Rename failed';
      console.error('[RENAME] Rename operation failed:', msg);
      showToast(`Rename failed: ${msg}`);
    } finally {
      if (setRenamingFileId.current) setRenamingFileId.current(null);
    }
  }, [files, folders]);

  const handleFolderCreate = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !savedProperty?.id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const parentId = selectedFolder === 'master' ? null : selectedFolder;
      const { data, error } = await supabase
        .from('property_folders')
        .insert({
          property_id: savedProperty.id,
          user_id: user.id,
          parent_id: parentId,
          name: trimmed,
        })
        .select('*')
        .single();
      if (error) {
        console.error('Error creating folder:', error);
        showToast('Could not create folder. Please try again.');
        return;
      }
      if (data) setFolders(prev => [...prev, data]);
    } catch (err) {
      console.error('Unexpected error creating folder:', err);
      showToast('Could not create folder. Please try again.');
    }
  }, [savedProperty, selectedFolder]);

  const handleFolderDelete = useCallback(async (folder: PropertyFolder) => {
    if (!folder) return;
    const hasChildFolders = folders.some(f => f.parent_id === folder.id);
    const hasChildFiles = files.some(f => f.folder_id === folder.id);
    if (hasChildFolders || hasChildFiles) {
      showToast('Folder must be empty before it can be deleted.', 'warning');
      return;
    }
    const isConfirmed = window.confirm(`Are you sure you want to delete the folder "${folder.name}"?`);
    if (!isConfirmed) return;
    try {
      await folderService.deleteFolder(folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete folder';
      showToast(`Failed to delete folder: ${msg}`);
    }
  }, [folders, files]);

  const dismissPendingUpload = useCallback((uploadId: string) => {
    setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Head>
        <title>Properties - DropPoint</title>
      </Head>
      <WebSidebar />
      <div className="flex-1 overflow-auto pt-4 pb-20">
        <ListView
          isOpen={true}
          variant="page"
          onPropertySelect={(property) => openProperty(property)}
          onClose={() => { /* noop on page */ }}
        />
      </div>
      <PropertyDetailsModal
        isOpen={showDetailsModal}
        property={savedProperty}
        snappedLatLng={snappedLatLng}
        onClose={() => setShowDetailsModal(false)}
        folders={folders}
        files={files}
        foldersLoading={foldersLoading}
        filesLoading={filesLoading}
        selectedFolder={selectedFolder}
        onFolderChange={setSelectedFolder}
        onFileUpload={handleFileUpload}
        onFileDelete={handleDeleteFile}
        onFileRename={handleRename}
        onFolderCreate={handleFolderCreate}
        onFolderDelete={handleFolderDelete}
        pendingUploads={pendingUploads}
        onDismiss={dismissPendingUpload}
        onPropertySwitch={(propertyWithCount, newFiles, newFolders) => {
          const switched: Property = {
            id: propertyWithCount.id,
            address: propertyWithCount.address,
            lat: propertyWithCount.lat,
            lng: propertyWithCount.lng,
            label: propertyWithCount.label ?? null,
            notes: propertyWithCount.notes ?? null,
          };
          setSavedProperty(switched);
          setSnappedLatLng({ lat: switched.lat, lng: switched.lng });
          setFiles(newFiles);
          setFolders(newFolders);
          setSelectedFolder('master');
          setPendingUploads([]);
        }}
      />
      <MobileBottomNav />
    </div>
  );
}

export default withAuth(ListPage, { requireAuth: true });
