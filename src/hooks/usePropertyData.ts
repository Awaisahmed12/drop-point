import { useState } from 'react';
import type { PropertyFile, PropertyFolder } from '../../types';

/**
 * Files and folders for the currently open property, plus the folder the
 * user is browsing. Caching lives in usePropertyPrefetch (id-keyed, module
 * level) so every entry point shares one source of truth.
 */
export function usePropertyData() {
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('master');
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);

  return {
    propertyFiles,
    setPropertyFiles,
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    foldersLoading,
    setFoldersLoading,
    filesLoading,
    setFilesLoading,
  };
}
