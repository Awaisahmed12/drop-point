import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';

import { MoveModal } from './MoveModal';
import { FileIcon } from './FileIcon';
import { SkeletonItem } from './SkeletonItem';
import type { Property, PropertyFile, PropertyFolder, PendingUpload, SortField, SortDirection } from '../../types';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { formatDate, formatFileSize, splitFileNameAndExt, getFileNameWithoutExtension } from '../../utils/fileManagement';
import { parseAddress, formatStreetAddress, formatLocality } from '../../utils/addressParsing';
import { HomeIcon, FolderIcon as HeroFolderIcon } from '@heroicons/react/24/solid';

interface PropertyDetailsModalProps {
  isOpen: boolean;
  property: Property | null;
  snappedLatLng: { lat: number; lng: number } | null;
  onClose: () => void;
  
  // File and folder data
  folders: PropertyFolder[];
  files: PropertyFile[];
  foldersLoading: boolean;
  filesLoading: boolean;
  
  // Current folder state
  selectedFolder: string;
  onFolderChange: (folderId: string) => void;
  
  // File operations
  onFileUpload: (files: FileList) => void;
  onFileDelete: (file: PropertyFile) => void;
  onFileRename: (item: PropertyFile | PropertyFolder, newName: string) => void;
  onFolderCreate: (name: string) => void;
  onFolderDelete: (folder: PropertyFolder) => void;
  
  // Pending uploads
  pendingUploads: PendingUpload[];
  
  // Cache functions - for future use
  getCachedPropertyData?: (address: string) => Promise<{ files: PropertyFile[]; folders: PropertyFolder[] } | null>;
  cachePropertyData?: (address: string, files: PropertyFile[], folders: PropertyFolder[]) => void;
}



export const PropertyDetailsModal = ({ 
  isOpen, 
  property, 
  snappedLatLng,
  onClose,
  folders,
  files,
  foldersLoading,
  filesLoading,
  selectedFolder,
  onFolderChange,
  onFileUpload,
  onFileDelete,
  onFileRename,
  onFolderCreate,
  onFolderDelete,
  pendingUploads
}: PropertyDetailsModalProps) => {
  // State for UI interactions
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderErrorPopup, setFolderErrorPopup] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFileName, setRenamingFileName] = useState('');
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFileTarget, setMoveFileTarget] = useState<PropertyFile | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Refs
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Folder validation
  const forbiddenFolderChars = /[:;\/\\*?"<>|]/;
  const maxFolderLength = 50;
  const folderNameError = (name: string) => {
    if (!name) return '';
    if (name[0] === ' ') return "Folder name can't start with a space.";
    if (forbiddenFolderChars.test(name)) return "Folder names can't include : ; / \\ * ? \" < > |";
    if (name.length > maxFolderLength) return `Folder name must be less than ${maxFolderLength} characters.`;
    return '';
  };
  const folderNameValidationMsg = folderNameError(newFolderName);
  const isFolderNameValid = !!newFolderName && !folderNameValidationMsg;

  // Sorting logic
  const sortedFiles = useMemo(() => {
    return [...files]
      .filter(file => (selectedFolder === 'master' ? !file.folder_id : file.folder_id === selectedFolder))
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.file_name.localeCompare(b.file_name);
            break;
          case 'date':
            comparison = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
            break;
          case 'size':
            comparison = a.file_size - b.file_size;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [files, selectedFolder, sortField, sortDirection]);

  const sortedFolders = useMemo(() => {
    return [...folders]
      .filter(folder => (selectedFolder === 'master' ? folder.parent_id === null : folder.parent_id === selectedFolder))
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'date':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          default:
            comparison = a.name.localeCompare(b.name);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [folders, selectedFolder, sortField, sortDirection]);

  // Toggle sort direction
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle folder creation
  const handleCreateFolder = async () => {
    if (!isFolderNameValid || isCreatingFolder) return;
    
    setIsCreatingFolder(true);
    try {
      await onFolderCreate(newFolderName.trim());
      setCreatingFolder(false);
      setNewFolderName('');
      setFolderErrorPopup(null);
    } catch {
      setFolderErrorPopup('Failed to create folder. Please try again.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle rename
  const handleRename = async (item: PropertyFile | PropertyFolder, newName: string) => {
    try {
      await onFileRename(item, newName);
      setRenamingFileId(null);
      setRenamingFileName('');
    } catch (error) {
      console.error('Rename failed:', error);
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (!target.closest('button[title="Folder actions"]') && !target.closest('button[title="File actions"]')) {
        if (folderMenuRef.current && !folderMenuRef.current.contains(target)) {
          setFolderMenuId(null);
        }
        if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
          setFileMenuId(null);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!isOpen || !property) return null;

  // Breadcrumb path
  const breadcrumbPath = [];
  for (let current = folders.find(f => f.id === selectedFolder); current; current = current.parent_id ? folders.find(f => f.id === current.parent_id) : undefined) {
    breadcrumbPath.unshift(current);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col border border-blue-100 relative"
           style={{ borderRadius: '1.5rem', minHeight: '620px', maxHeight: '96vh' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-white border-b border-blue-100 rounded-t-3xl">
          <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
            <span className="text-lg sm:text-xl font-extrabold text-gray-900 truncate" title={property.address}>
              {formatStreetAddress(parseAddress(property.address).streetAddress)}
            </span>
            {parseAddress(property.address).locality && (
              <span className="text-xs sm:text-sm text-gray-500 truncate">
                {formatLocality(parseAddress(property.address).locality)}
              </span>
            )}
          </div>
          <button
            className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
            onClick={() => {
              onClose();
              setCreatingFolder(false);
            }}
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Satellite Image */}
        <div className="relative w-full h-48 sm:h-64 bg-gray-200 border-b border-blue-100">
          <Image
            src={`https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? property.lat)},${(snappedLatLng?.lng ?? property.lng)}&zoom=19&size=640x213&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? property.lat)},${(snappedLatLng?.lng ?? property.lng)}&key=${GOOGLE_MAPS_API_KEY}`}
            alt="Property satellite view"
            layout="fill"
            objectFit="cover"
            priority
            unoptimized
          />
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-2 text-sm text-blue-700 font-semibold px-4 pt-2">
          {selectedFolder !== 'master' && (
            <>
              {/* Back Button */}
              <button
                className="cursor-pointer hover:bg-blue-50 rounded-full p-1 flex items-center transition-colors"
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolder);
                  const parentId = currentFolder?.parent_id || 'master';
                  onFolderChange(parentId);
                }}
                title="Go back"
              >
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Home Button */}
              <button
                className="cursor-pointer hover:underline flex items-center"
                onClick={() => onFolderChange('master')}
                title="Go to root"
              >
                <HomeIcon style={{ width: 20, height: 20, color: '#1a73e8' }} />
              </button>
            </>
          )}
          {breadcrumbPath.map((folder) => [
            <span key={`sep-${folder.id}`}>/</span>,
            <button
              key={folder.id}
              className="cursor-pointer hover:underline"
              onClick={() => onFolderChange(folder.id)}
            >
              {folder.name}
            </button>
          ])}
        </div>

        {/* Search Bar (Disabled for now) */}
        <div className="px-4 pb-2 bg-white">
          <input
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            placeholder="Search files and folders (coming soon)"
            disabled
          />
        </div>

        {/* File List Container */}
        <div className="flex-1 overflow-y-auto min-h-[120px] file-list">
          {/* Sort Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-3 py-2 text-sm border-b border-gray-200 mb-2 sticky top-0 bg-white z-10">
            <button
              className="col-span-7 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              onClick={() => toggleSort('name')}
            >
              Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className="col-span-3 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              onClick={() => toggleSort('date')}
            >
              Modified {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className="col-span-2 flex items-center justify-end gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 mr-2"
              onClick={() => toggleSort('size')}
            >
              Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          {/* Loading States */}
          {(foldersLoading || filesLoading) && (
            <div className="px-4">
              {foldersLoading && (
                <>
                  <SkeletonItem type="folder" />
                  <SkeletonItem type="folder" />
                </>
              )}
              {filesLoading && (
                <>
                  <SkeletonItem type="file" />
                  <SkeletonItem type="file" />
                  <SkeletonItem type="file" />
                  <SkeletonItem type="file" />
                  <SkeletonItem type="file" />
                </>
              )}
            </div>
          )}

          {/* Content */}
          {!foldersLoading && !filesLoading && (
            <>
              {/* Empty State */}
              {sortedFolders.length === 0 && sortedFiles.length === 0 && selectedFolder === 'master' && (
                <div className="text-gray-400 italic self-center py-6 px-4">
                  No files or folders yet. Upload some files to get started!
                </div>
              )}

              {/* Folders and Files */}
              <div className="h-full overflow-y-auto px-4">
                {/* Folders */}
                {sortedFolders.map(folder => (
                  <div key={folder.id}>
                    {/* Desktop Folder Layout */}
                    <div
                      className="hidden sm:grid grid-cols-12 gap-4 items-center px-3 py-2 hover:bg-gray-100 rounded-lg transition group border border-gray-100 mb-1"
                      style={{ cursor: 'pointer', minHeight: 40 }}
                      onClick={() => {
                        // If any menu is open, close it instead of navigating to folder
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        onFolderChange(folder.id);
                      }}
                    >
                      <div className="col-span-7 flex items-center min-w-0">
                        <HeroFolderIcon style={{ width: 28, height: 28, color: '#fbbf24' }} />
                        <div className="ml-3 flex-1 min-w-0">
                          {renamingFileId === folder.id ? (
                            <input
                              className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 text-sm w-40"
                              value={renamingFileName}
                              autoFocus
                              onClick={e => e.stopPropagation()}
                              onFocus={e => {
                                const input = e.target as HTMLInputElement;
                                input.setSelectionRange(0, folder.name.length);
                              }}
                              onChange={e => setRenamingFileName(e.target.value)}
                              onBlur={async () => {
                                await handleRename(folder, renamingFileName);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setRenamingFileId(null);
                                  setRenamingFileName('');
                                }
                              }}
                            />
                          ) : (
                            <div className="text-gray-900 font-medium truncate">
                              {folder.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3 text-xs text-gray-500">
                        {formatDate(folder.created_at)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end relative">
                        <button
                          className="p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200"
                          style={{ minWidth: 24, minHeight: 24 }}
                          onClick={e => {
                            e.stopPropagation();
                            setFileMenuId(null);
                            setFolderMenuId(folderMenuId === folder.id ? null : folder.id);
                          }}
                          title="Folder actions"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                          </svg>
                        </button>
                        {folderMenuId === folder.id && (
                          <div ref={folderMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-xl" style={{ zIndex: '9999 !important' }}>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setRenamingFileId(folder.id);
                                setRenamingFileName(folder.name);
                                setFolderMenuId(null);
                              }}
                            >Rename</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                onFolderDelete(folder);
                              }}
                            >Delete</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Folder Layout */}
                    <div
                      className="sm:hidden flex items-center justify-between px-3 py-3 hover:bg-gray-100 rounded-lg transition border border-gray-100 mb-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // If any menu is open, close it instead of navigating to folder
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        onFolderChange(folder.id);
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <HeroFolderIcon style={{ width: 32, height: 32, color: '#fbbf24' }} />
                        <div className="ml-3 flex-1 min-w-0">
                          {renamingFileId === folder.id ? (
                            <input
                              className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-base w-full"
                              value={renamingFileName}
                              autoFocus
                              onClick={e => e.stopPropagation()}
                              onFocus={e => {
                                const input = e.target as HTMLInputElement;
                                input.setSelectionRange(0, folder.name.length);
                              }}
                              onChange={e => setRenamingFileName(e.target.value)}
                              onBlur={async () => {
                                await handleRename(folder, renamingFileName);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setRenamingFileId(null);
                                  setRenamingFileName('');
                                }
                              }}
                            />
                          ) : (
                            <>
                              <div className="text-gray-900 font-semibold truncate text-base">
                                {folder.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(folder.created_at)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        className="p-2 rounded hover:bg-gray-200 ml-2 flex-shrink-0"
                        onClick={e => {
                          e.stopPropagation();
                          setFileMenuId(null);
                          setFolderMenuId(folderMenuId === folder.id ? null : folder.id);
                        }}
                        title="Folder actions"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                        </svg>
                      </button>
                      {folderMenuId === folder.id && (
                        <div ref={folderMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-xl" style={{ zIndex: '9999 !important' }}>
                          <button
                            className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              setRenamingFileId(folder.id);
                              setRenamingFileName(folder.name);
                              setFolderMenuId(null);
                            }}
                          >Rename</button>
                          <button
                            className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              onFolderDelete(folder);
                            }}
                          >Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Files */}
                {sortedFiles.map(file => {
                  const [base, ext] = splitFileNameAndExt(file.file_name);
                  return (
                    <div key={file.id}>
                      {/* Desktop File Layout */}
                      <div
                        className="hidden sm:grid grid-cols-12 gap-4 items-center px-3 py-2 hover:bg-gray-100 rounded-lg transition group border border-gray-100 mb-1"
                      style={{ cursor: 'pointer', minHeight: 40 }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                          return;
                        }
                        
                        // If any menu is open, close it instead of opening the file
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
                      }}
                    >
                      <div className="col-span-7 flex items-center min-w-0">
                        <FileIcon
                          type={file.file_name.split('.').pop() || 'file'}
                          size={28}
                        />
                        <div className="ml-3 flex-1 min-w-0 text-gray-900 font-medium truncate">
                          {renamingFileId === file.id ? (
                            <span className="flex items-center">
                              <input
                                className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 text-sm w-40"
                                value={renamingFileName}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onFocus={e => {
                                  const input = e.target as HTMLInputElement;
                                  input.setSelectionRange(0, base.length);
                                }}
                                onChange={e => setRenamingFileName(e.target.value)}
                                onBlur={async () => {
                                  const trimmed = renamingFileName.trim();
                                  const [, newExt] = splitFileNameAndExt(trimmed);
                                  const [, oldExt] = splitFileNameAndExt(file.file_name);
                                  if (!newExt && oldExt) {
                                    alert('File extension cannot be removed. Aborting rename.');
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                    return;
                                  }
                                  await handleRename(file, trimmed);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                              />
                              <span className="text-gray-400 text-xs ml-1">{ext}</span>
                            </span>
                          ) : (
                            <span className="text-gray-900 font-medium truncate">
                              {getFileNameWithoutExtension(file.file_name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3 text-xs text-gray-500">
                        {formatDate(file.modified_at || file.uploaded_at)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end relative">
                        <span className="hidden sm:inline-block text-xs text-gray-500 mr-2">{formatFileSize(file.file_size)}</span>
                        <button
                          className="p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200"
                          style={{ minWidth: 24, minHeight: 24 }}
                          onClick={e => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            setFileMenuId(fileMenuId === file.id ? null : file.id);
                          }}
                          title="File actions"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                          </svg>
                        </button>
                        {fileMenuId === file.id && (
                          <div ref={fileMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-xl" style={{ zIndex: '9999 !important' }}>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setRenamingFileId(file.id);
                                setRenamingFileName(file.file_name);
                                setTimeout(() => {
                                  setFileMenuId(null);
                                  setFolderMenuId(null);
                                }, 50);
                              }}
                            >Rename</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setMoveFileTarget(file);
                                setShowMoveModal(true);
                                setFileMenuId(null);
                              }}
                            >Move</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
                                setFileMenuId(null);
                              }}
                            >Open</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                onFileDelete(file);
                              }}
                            >Delete</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile File Layout */}
                    <div
                      className="sm:hidden flex items-center justify-between px-3 py-3 hover:bg-gray-100 rounded-lg transition border border-gray-100 mb-2"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                          return;
                        }
                        
                        // If any menu is open, close it instead of opening the file
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <FileIcon
                          type={file.file_name.split('.').pop() || 'file'}
                          size={32}
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          {renamingFileId === file.id ? (
                            <input
                              className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-base w-full"
                              value={renamingFileName}
                              autoFocus
                              onClick={e => e.stopPropagation()}
                              onFocus={e => {
                                const input = e.target as HTMLInputElement;
                                input.setSelectionRange(0, base.length);
                              }}
                              onChange={e => setRenamingFileName(e.target.value)}
                              onBlur={async () => {
                                const trimmed = renamingFileName.trim();
                                const [, newExt] = splitFileNameAndExt(trimmed);
                                const [, oldExt] = splitFileNameAndExt(file.file_name);
                                if (!newExt && oldExt) {
                                  alert('File extension cannot be removed. Aborting rename.');
                                  setRenamingFileId(null);
                                  setRenamingFileName('');
                                  return;
                                }
                                await handleRename(file, trimmed);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setRenamingFileId(null);
                                  setRenamingFileName('');
                                }
                              }}
                            />
                          ) : (
                            <>
                              <div className="text-gray-900 font-semibold truncate text-base">
                                {getFileNameWithoutExtension(file.file_name)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                <span>{formatDate(file.modified_at || file.uploaded_at)}</span>
                                <span>•</span>
                                <span>{formatFileSize(file.file_size)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          className="p-2 rounded hover:bg-gray-200 ml-2 flex-shrink-0"
                          onClick={e => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            setFileMenuId(fileMenuId === file.id ? null : file.id);
                          }}
                          title="File actions"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                          </svg>
                        </button>
                        {fileMenuId === file.id && (
                          <div ref={fileMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-xl" style={{ zIndex: '9999 !important' }}>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setRenamingFileId(file.id);
                                setRenamingFileName(file.file_name);
                                setTimeout(() => {
                                  setFileMenuId(null);
                                  setFolderMenuId(null);
                                }, 50);
                              }}
                            >Rename</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setMoveFileTarget(file);
                                setShowMoveModal(true);
                                setFileMenuId(null);
                              }}
                            >Move</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
                                setFileMenuId(null);
                              }}
                            >Open</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                onFileDelete(file);
                              }}
                            >Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pending Uploads */}
          {pendingUploads.filter(p => (selectedFolder === 'master' ? !p.folder_id : p.folder_id === selectedFolder) && p.property_id === property?.id).length > 0 && (
            <>
              {pendingUploads.filter(p => (selectedFolder === 'master' ? !p.folder_id : p.folder_id === selectedFolder) && p.property_id === property?.id).map(pending => (
                <div key={pending.id} className={`flex items-center justify-between p-2 rounded-lg border-2 ${pending.status === 'error' ? 'border-red-400 bg-white/95' : 'border-gray-100 opacity-80'} relative mb-2`}>
                  <span className="font-semibold text-gray-900 truncate max-w-[120px] mr-2">{pending.name}</span>
                  {pending.status === 'uploading' && (
                    <span className="text-xs text-blue-600 font-medium">Uploading...</span>
                  )}
                  {pending.status === 'error' && (
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/>
                          <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {typeof pending.error === 'string' && pending.error.includes('Unauthorized') ? 'You don\'t have permission to upload.' : 'Upload failed'}
                      </span>
                    </div>
                  )}
                  {pending.status === 'success' && (
                    <span className="text-xs text-green-600 font-medium">Uploaded!</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Hidden file input for upload */}
        <input id="file-upload-input" type="file" className="hidden" onChange={(e) => {
          if (e.target.files) onFileUpload(e.target.files);
        }} multiple />

        {/* Action Buttons */}
        <div className="flex w-full bg-white border-t border-blue-100 rounded-b-3xl overflow-hidden" style={{height:'112px'}}>
          <button
            className="w-1/2 h-full bg-gray-100 text-blue-700 text-xl font-bold flex items-center justify-center gap-3 border-r border-blue-100 rounded-none rounded-bl-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all hover:bg-blue-50 active:scale-95"
            onClick={() => setCreatingFolder(true)}
          >
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
          <button
            className="w-1/2 h-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center gap-3 rounded-none rounded-br-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-blue-700 active:scale-95"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Upload
          </button>
        </div>

        {/* Folder Creation Modal */}
        {creatingFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-11/12 max-w-xs flex flex-col gap-4 border border-blue-100 relative">
              <div className="text-lg font-bold text-gray-900 mb-2">Create New Folder</div>
              <input
                ref={folderInputRef}
                type="text"
                className="rounded-lg border border-blue-200 px-3 py-2 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="New folder name"
                value={newFolderName}
                onChange={e => {
                  if (isCreatingFolder) return;
                  const val = e.target.value;
                  setNewFolderName(val);
                  setFolderErrorPopup(folderNameError(val));
                }}
                autoFocus
                disabled={isCreatingFolder}
              />
              {folderErrorPopup && (
                <div className="text-red-500 text-xs mt-1 w-full bg-red-50 border border-red-200 rounded px-2 py-1">
                  {folderErrorPopup}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  className={`flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 font-semibold text-base transition-all ${(!isFolderNameValid || isCreatingFolder) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                  onClick={handleCreateFolder}
                  disabled={!isFolderNameValid || isCreatingFolder}
                >
                  {isCreatingFolder ? 'Creating...' : 'Create'}
                </button>
                <button
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-3 py-2 font-semibold text-base hover:bg-gray-200"
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName('');
                    setFolderErrorPopup(null);
                    setIsCreatingFolder(false);
                  }}
                  disabled={isCreatingFolder}
                >Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Move Modal */}
      {showMoveModal && moveFileTarget && (
        <MoveModal
          open={showMoveModal}
          folders={folders}
          currentItemId={moveFileTarget.id}
          currentItemType="file"
          currentFolderId={moveFileTarget.folder_id}
          onMove={async () => {
            // Implementation would be handled by parent component
            setShowMoveModal(false);
            setMoveFileTarget(null);
          }}
          onCancel={() => {
            setShowMoveModal(false);
            setMoveFileTarget(null);
          }}
        />
      )}
    </div>
  );
}; 