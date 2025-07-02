import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';

import { MoveModal } from './MoveModal';
import { FileIcon } from './FileIcon';
import { SkeletonItem } from './SkeletonItem';
import type { Property, PropertyFile, PropertyFolder, PendingUpload, SortField, SortDirection } from '../../types';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { formatDate, formatFileSize, splitFileNameAndExt, getFileNameWithoutExtension } from '../../utils/fileManagement';
import { getFileSignedUrl } from '../utils/supabaseClient';
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
  onDismiss: (uploadId: string) => void;
  
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
  pendingUploads,
  onDismiss
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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mobile viewport height state
  const [viewportHeight, setViewportHeight] = useState(0);
  
  // Mobile file viewer state
  const [mobileFileViewer, setMobileFileViewer] = useState<{
    isOpen: boolean;
    file: PropertyFile | null;
    fileUrl: string;
    downloadUrl: string;
    content?: string;
  }>({
    isOpen: false,
    file: null,
    fileUrl: '',
    downloadUrl: '',
  });

  // Mobile detection utility
  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  };

  // Dynamic viewport height handling for mobile browsers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportHeight = () => {
      // Use the visual viewport API if available (modern browsers)
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        // Fallback to window.innerHeight
        setViewportHeight(window.innerHeight);
      }
    };

    // Set initial height
    updateViewportHeight();

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    } else {
      window.addEventListener('resize', updateViewportHeight);
      window.addEventListener('orientationchange', updateViewportHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      } else {
        window.removeEventListener('resize', updateViewportHeight);
        window.removeEventListener('orientationchange', updateViewportHeight);
      }
    };
  }, []);

  // Calculate modal height based on device and viewport
  const getModalHeight = () => {
    if (!isMobileDevice()) {
      return '90vh'; // Desktop remains the same
    }
    
    // For mobile, use the dynamic viewport height if available
    if (viewportHeight > 0) {
      return `${Math.min(viewportHeight * 0.95, viewportHeight - 20)}px`;
    }
    
    // Fallback to CSS viewport units for mobile
    return '100dvh'; // dvh = dynamic viewport height (modern browsers)
  };

  // Calculate modal max height
  const getModalMaxHeight = () => {
    if (!isMobileDevice()) {
      return '800px'; // Desktop remains the same
    }
    
    if (viewportHeight > 0) {
      return `${Math.min(viewportHeight * 0.95, viewportHeight - 20)}px`;
    }
    
    return '100dvh';
  };

  // Auto-dismiss successful uploads after 1.5 seconds
  useEffect(() => {
    const successfulUploads = pendingUploads.filter(p => p.status === 'success');
    if (successfulUploads.length > 0) {
      const timeouts = successfulUploads.map(upload => 
        setTimeout(() => {
          onDismiss(upload.id);
        }, 1500) // 1.5 seconds
      );
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [pendingUploads, onDismiss]);

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
    const filtered = [...files]
      .filter(file => {
        // If searching, show all files regardless of folder
        if (searchQuery.trim()) {
          return file.file_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
        }
        // Otherwise, filter by current folder
        return selectedFolder === 'master' ? !file.folder_id : file.folder_id === selectedFolder;
      });
    
    console.log('📋 [MODAL] File filtering - Total files:', files.length, 'Selected folder:', selectedFolder, 'Filtered count:', filtered.length);
    if (filtered.length > 0) {
      console.log('📋 [MODAL] Filtered files:', filtered.slice(0, 5).map(f => ({ name: f.file_name, folder_id: f.folder_id })));
    }
    
    return filtered.sort((a, b) => {
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
  }, [files, selectedFolder, sortField, sortDirection, searchQuery]);

  const sortedFolders = useMemo(() => {
    return [...folders]
      .filter(folder => {
        // If searching, show all folders regardless of parent
        if (searchQuery.trim()) {
          return folder.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
        }
        // Otherwise, filter by current folder
        return selectedFolder === 'master' ? folder.parent_id === null : folder.parent_id === selectedFolder;
      })
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
  }, [folders, selectedFolder, sortField, sortDirection, searchQuery]);

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
      // For files, append the original extension back to the new name
      let finalName = newName;
      if ('file_name' in item) {
        const [, originalExt] = splitFileNameAndExt(item.file_name);
        if (originalExt && !newName.includes('.')) {
          finalName = `${newName}.${originalExt}`;
        }
      }
      
      await onFileRename(item, finalName);
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

  // Enhanced mobile-first file opening function
  const openFileInline = async (file: PropertyFile) => {
    try {
      const fileUrl = await getFileSignedUrl(file.property_id, file.file_name, false);
      const downloadUrl = await getFileSignedUrl(file.property_id, file.file_name, true);
      const fileExtension = file.file_name.split('.').pop()?.toLowerCase();
      
      // Mobile-first approach
      if (isMobileDevice()) {
        // For mobile, open in modal overlay
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
          // Images - show directly in mobile viewer
          setMobileFileViewer({
            isOpen: true,
            file,
            fileUrl,
            downloadUrl,
          });
        } else if (fileExtension === 'pdf') {
          // PDFs - try to show in mobile viewer, fallback to direct navigation
          setMobileFileViewer({
            isOpen: true,
            file,
            fileUrl,
            downloadUrl,
          });
        } else if (fileExtension === 'txt') {
          // Text files - fetch content and show in mobile viewer
          try {
            const response = await fetch(fileUrl);
            const content = await response.text();
            setMobileFileViewer({
              isOpen: true,
              file,
              fileUrl,
              downloadUrl,
              content,
            });
          } catch {
            // Fallback to direct download
            window.location.href = downloadUrl;
          }
        } else if (fileExtension === 'csv') {
          // CSV files - fetch and parse for mobile viewer
          try {
            const response = await fetch(fileUrl);
            const content = await response.text();
            setMobileFileViewer({
              isOpen: true,
              file,
              fileUrl,
              downloadUrl,
              content,
            });
          } catch {
            // Fallback to direct download
            window.location.href = downloadUrl;
          }
        } else {
          // For other file types on mobile, direct download or attempt to open
          try {
            // Try to open in same window first
            window.location.href = fileUrl;
          } catch {
            // Fallback to download
            window.location.href = downloadUrl;
          }
        }
        return;
      }

      // Desktop behavior (existing logic)
      // For PDFs, try to open inline with a viewer
      if (fileExtension === 'pdf') {
        // Try to open PDF inline by embedding it
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.file_name}</title>
                <style>
                  body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                  .header { 
                    background: #f8f9fa; 
                    padding: 12px 20px; 
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .filename { font-weight: 600; color: #333; }
                  .download-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                  }
                  .download-btn:hover { background: #0056b3; }
                  iframe { width: 100%; height: calc(100vh - 50px); border: none; }
                </style>
              </head>
              <body>
                <div class="header">
                  <span class="filename">${file.file_name}</span>
                  <button class="download-btn" onclick="window.open('${downloadUrl}', '_blank')">Download</button>
                </div>
                <iframe src="${fileUrl}" type="application/pdf"></iframe>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      } 
      // For images, open directly (these usually work fine)
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
        window.open(fileUrl, '_blank');
      }
      // For other document types, try Google Docs Viewer
      else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension || '')) {
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.file_name}</title>
                <style>
                  body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                  .header { 
                    background: #f8f9fa; 
                    padding: 12px 20px; 
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .filename { font-weight: 600; color: #333; }
                  .download-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                  }
                  .download-btn:hover { background: #0056b3; }
                  iframe { width: 100%; height: calc(100vh - 50px); border: none; }
                </style>
              </head>
              <body>
                <div class="header">
                  <span class="filename">${file.file_name}</span>
                  <button class="download-btn" onclick="window.open('${downloadUrl}', '_blank')">Download</button>
                </div>
                <iframe src="${viewerUrl}"></iframe>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      }
      // For CSV files, format as a proper table
      else if (fileExtension === 'csv') {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          // Fetch the content and display it as a table
          fetch(fileUrl)
            .then(response => response.text())
            .then(content => {
              // Parse CSV content
              const lines = content.split('\n').filter(line => line.trim());
              const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
              const rows = lines.slice(1).map(line => 
                line.split(',').map(cell => cell.trim().replace(/"/g, ''))
              );

              const tableHtml = `
                <table>
                  <thead>
                    <tr>
                      ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(row => `
                      <tr>
                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `;

              newWindow.document.write(`
                <html>
                  <head>
                    <title>${file.file_name}</title>
                    <style>
                      body { 
                        font-family: system-ui, -apple-system, sans-serif; 
                        padding: 0; 
                        margin: 0;
                      }
                      .header { 
                        background: #f8f9fa; 
                        padding: 12px 20px; 
                        border-bottom: 1px solid #e9ecef;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                      }
                      .filename { font-weight: 600; color: #333; }
                      .download-btn {
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                      }
                      .download-btn:hover { background: #0056b3; }
                      .table-container {
                        padding: 20px;
                        overflow: auto;
                        margin-bottom: 40px;
                      }
                      table { 
                        border-collapse: collapse; 
                        width: 100%; 
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        font-size: 11px;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                      }
                      th, td { 
                        border: 1px solid #d0d7de; 
                        padding: 4px 8px; 
                        text-align: left;
                        vertical-align: top;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 200px;
                      }
                      th { 
                        background: #f6f8fa; 
                        font-weight: 600;
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        font-size: 11px;
                        color: #24292f;
                      }
                      tr:nth-child(even) { background: #f6f8fa; }
                      tr:hover { background: #dbeafe; }
                      td:hover {
                        white-space: normal;
                        word-wrap: break-word;
                        max-width: none;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <span class="filename">${file.file_name}</span>
                      <button class="download-btn" onclick="window.open('${downloadUrl}', '_blank')">Download</button>
                    </div>
                    <div class="table-container">
                      ${tableHtml}
                    </div>
                  </body>
                </html>
              `);
              newWindow.document.close();
            })
            .catch(() => {
              // If fetch fails, just open the URL directly
              newWindow.location.href = fileUrl;
            });
        }
      }
      // For TXT files, display with proper formatting
      else if (fileExtension === 'txt') {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          // Fetch the content and display it
          fetch(fileUrl)
            .then(response => response.text())
            .then(content => {
              newWindow.document.write(`
                <html>
                  <head>
                    <title>${file.file_name}</title>
                    <style>
                      body { 
                        font-family: system-ui, -apple-system, sans-serif; 
                        padding: 0; 
                        margin: 0;
                      }
                      .header { 
                        background: #f8f9fa; 
                        padding: 12px 20px; 
                        border-bottom: 1px solid #e9ecef;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                      }
                      .filename { font-weight: 600; color: #333; }
                      .download-btn {
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                      }
                      .download-btn:hover { background: #0056b3; }
                      .content { 
                        padding: 20px; 
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
                        white-space: pre-wrap; 
                        line-height: 1.5;
                        background: #f8f9fa;
                        margin: 0;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <span class="filename">${file.file_name}</span>
                      <button class="download-btn" onclick="window.open('${downloadUrl}', '_blank')">Download</button>
                    </div>
                    <pre class="content">${content}</pre>
                  </body>
                </html>
              `);
              newWindow.document.close();
            })
            .catch(() => {
              // If fetch fails, just open the URL directly
              newWindow.location.href = fileUrl;
            });
        }
      }
      // For everything else, try direct open
      else {
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error('Error getting file URL:', error);
      alert('Unable to open file. Please try again.');
    }
  };

  // Mobile file viewer component
  const renderMobileFileViewer = () => {
    if (!mobileFileViewer.isOpen || !mobileFileViewer.file) return null;

    const file = mobileFileViewer.file;
    const fileExtension = file.file_name.split('.').pop()?.toLowerCase();

    const closeMobileViewer = () => {
      setMobileFileViewer({
        isOpen: false,
        file: null,
        fileUrl: '',
        downloadUrl: '',
      });
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" style={{
        height: viewportHeight > 0 ? `${viewportHeight}px` : '100dvh',
        maxHeight: viewportHeight > 0 ? `${viewportHeight}px` : '100dvh'
      }}>
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center min-w-0 flex-1">
            <FileIcon
              type={fileExtension || 'file'}
              size={24}
            />
            <div className="ml-3 min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate text-sm">
                {getFileNameWithoutExtension(file.file_name)}
              </h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.file_size)} • {formatDate(file.modified_at || file.uploaded_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => window.open(mobileFileViewer.downloadUrl, '_blank')}
              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
              title="Download"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5 5V3" />
              </svg>
            </button>
            <button
              onClick={closeMobileViewer}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100" style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
          {['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '') ? (
            // Image viewer
            <div className="flex items-center justify-center min-h-full p-4">
              <img
                src={mobileFileViewer.fileUrl}
                alt={file.file_name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                style={{ 
                  maxHeight: viewportHeight > 0 
                    ? `${viewportHeight - 120}px` 
                    : 'calc(100dvh - 120px)' 
                }}
              />
            </div>
          ) : fileExtension === 'pdf' ? (
            // PDF viewer
            <div className="h-full">
              <iframe
                src={mobileFileViewer.fileUrl}
                className="w-full h-full border-none"
                title={file.file_name}
              />
            </div>
          ) : fileExtension === 'txt' && mobileFileViewer.content ? (
            // Text viewer
            <div className="p-4">
              <pre className="bg-white rounded-lg p-4 text-sm font-mono whitespace-pre-wrap break-words shadow-sm border">
                {mobileFileViewer.content}
              </pre>
            </div>
          ) : fileExtension === 'csv' && mobileFileViewer.content ? (
            // CSV viewer
            <div className="p-4">
              <div className="bg-white rounded-lg shadow-sm border overflow-auto">
                {(() => {
                  const lines = mobileFileViewer.content.split('\n').filter(line => line.trim());
                  const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
                  const rows = lines.slice(1).map(line => 
                    line.split(',').map(cell => cell.trim().replace(/"/g, ''))
                  );

                  return (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {headers.map((header, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 border-b">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2 border-b border-gray-200">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          ) : (
            // Fallback for unsupported types
            <div className="flex items-center justify-center min-h-full p-4">
              <div className="text-center">
                <FileIcon
                  type={fileExtension || 'file'}
                  size={64}
                />
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {file.file_name}
                </h3>
                <p className="mt-2 text-gray-300">
                  Preview not available for this file type
                </p>
                <button
                  onClick={() => window.open(mobileFileViewer.downloadUrl, '_blank')}
                  className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Download File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Debug logging for files prop changes
  useEffect(() => {
    console.log('📋 [MODAL] Files prop updated, count:', files.length);
    if (files.length > 0) {
      console.log('📋 [MODAL] Latest files:', files.slice(0, 3).map(f => f.file_name));
    }
  }, [files]);

  // Debug logging for modal state
  useEffect(() => {
    console.log('📋 [MODAL] Modal opened:', isOpen, 'Property:', property?.address);
  }, [isOpen, property?.address]);

  if (!isOpen || !property) return null;

  // Breadcrumb path
  const breadcrumbPath = [];
  for (let current = folders.find(f => f.id === selectedFolder); current; current = current.parent_id ? folders.find(f => f.id === current.parent_id) : undefined) {
    breadcrumbPath.unshift(current);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col border border-blue-100 relative overflow-visible"
           style={{ 
             borderRadius: '1.5rem', 
             height: getModalHeight(),
             maxHeight: getModalMaxHeight(),
             margin: isMobileDevice() ? '10px' : '0'
           }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-white border-b border-blue-100 rounded-t-3xl flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
            <span className={`${isMobileDevice() ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-extrabold text-gray-900 truncate`} title={property.address}>
              {property?.address}
            </span>
          </div>
          <button
            className={`${isMobileDevice() ? 'p-3' : 'p-2'} rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0`}
            onClick={() => {
              onClose();
              setCreatingFolder(false);
            }}
          >
            <svg className={`${isMobileDevice() ? 'w-7 h-7' : 'w-6 h-6'} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File List Container - Scrollable with safe area handling */}
        <div className="flex-1 overflow-y-auto file-list overflow-x-visible" style={{ 
          minHeight: '300px',
          // Add safe area padding for mobile devices with notches/dynamic islands
          paddingBottom: isMobileDevice() ? 'env(safe-area-inset-bottom, 0px)' : '0'
        }}>
          {/* Satellite Image - First in scrollable area */}
          <div className={`relative w-full ${isMobileDevice() ? 'h-48' : 'h-56'} bg-gray-200 border-b border-blue-100 flex-shrink-0`}>
            <Image
              src={`https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? property.lat)},${(snappedLatLng?.lng ?? property.lng)}&zoom=17&size=800x400&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? property.lat)},${(snappedLatLng?.lng ?? property.lng)}&key=${GOOGLE_MAPS_API_KEY}`}
              alt="Property satellite view"
              layout="fill"
              objectFit="cover"
              priority
              unoptimized
            />
          </div>

          {/* Consolidated Navigation Section - STICKY within scroll container */}
          <div className="bg-white flex-shrink-0 sticky top-0 z-30">
            {/* Breadcrumbs - only show if not at root level */}
            {breadcrumbPath.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto">
                  <HomeIcon 
                    className="w-4 h-4 text-gray-400 cursor-pointer hover:text-blue-600 transition-colors flex-shrink-0" 
                    onClick={() => onFolderChange('')}
                  />
                  {breadcrumbPath.map((folder) => (
                    <div key={folder.id} className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-400">/</span>
                      <button
                        className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                        onClick={() => onFolderChange(folder.id)}
                      >
                        {folder.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search Bar */}
            <div className={`px-4 ${breadcrumbPath.length > 0 ? 'py-3' : 'py-2'} bg-white`}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full ${isMobileDevice() ? 'px-4 py-3 text-base' : 'px-4 py-2 text-sm'} bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-10 text-black placeholder-gray-400`}
                />
                <svg className={`absolute left-3 ${isMobileDevice() ? 'top-3.5 w-5 h-5' : 'top-2.5 w-4 h-4'} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
            </div>
          </div>

          {/* Upload Progress Section - STICKY */}
          {pendingUploads.length > 0 && (
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[calc(theme(spacing.14)+theme(spacing.14))] z-20">
              <div className="space-y-3">
                {pendingUploads.map(upload => (
                  <div key={upload.id} className="flex items-center gap-3">
                    <FileIcon type={upload.file.name.split('.').pop() || 'file'} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {upload.file.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              upload.status === 'uploading' ? 'bg-blue-500' :
                              upload.status === 'success' ? 'bg-green-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {upload.status === 'uploading' ? `${upload.progress}%` :
                           upload.status === 'success' ? 'Done' :
                           'Failed'}
                        </span>
                      </div>
                    </div>
                    {(upload.status === 'success' || upload.status === 'error') && (
                      <button
                        onClick={() => onDismiss(upload.id)}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Headers - STICKY, positioned after upload section */}
          <div className={`hidden sm:grid grid-cols-12 gap-4 px-3 ${isMobileDevice() ? 'py-3' : 'py-2'} text-sm border-b border-gray-200 bg-white sticky z-10`}
               style={{ 
                 top: pendingUploads.length > 0 
                   ? `calc(${breadcrumbPath.length > 0 ? '80px' : '56px'} + ${pendingUploads.length * 60 + 24}px)`
                   : breadcrumbPath.length > 0 ? '80px' : '56px'
               }}>
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
              className="col-span-2 flex items-center justify-end gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 z-10"
              onClick={() => toggleSort('size')}
            >
              Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          {/* Compact Uploading Files - STICKY within scroll container */}
          {pendingUploads.filter(p => (selectedFolder === 'master' ? !p.folder_id : p.folder_id === selectedFolder) && p.property_id === property?.id).length > 0 && (
            <div className="px-4 pb-2 bg-white flex-shrink-0 sticky z-10 border-b border-gray-50" style={{ top: `${selectedFolder === 'master' ? 96 : 120}px` }}>
              <div className="space-y-1">
                {pendingUploads.filter(p => (selectedFolder === 'master' ? !p.folder_id : p.folder_id === selectedFolder) && p.property_id === property?.id).map(pending => (
                  <div key={pending.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    pending.status === 'error' ? 'border-red-200 bg-red-50' : 
                    pending.status === 'success' ? 'border-green-200 bg-green-50' :
                    'border-blue-200 bg-blue-50'
                  }`}>
                    {/* Compact File Icon and Name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileIcon
                        type={pending.name.split('.').pop() || 'file'}
                        size={20}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate text-xs">
                          {getFileNameWithoutExtension(pending.name)}
                        </div>
                      </div>
                    </div>

                    {/* Compact Progress/Status */}
                    <div className="flex items-center gap-2">
                      {pending.status === 'uploading' && (
                        <div className="flex items-center gap-1">
                          {/* Simple Spinning Circle */}
                          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                      )}
                      
                      {pending.status === 'success' && (
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs text-green-600 font-medium">Done!</span>
                        </div>
                      )}
                      
                      {pending.status === 'error' && (
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <span className="text-xs text-red-600 font-medium">Failed</span>
                        </div>
                      )}

                      {/* Compact Action Buttons */}
                      <div className="flex gap-1">
                        {pending.status === 'error' && pending.retry && (
                          <button
                            onClick={pending.retry}
                            className="p-1 rounded-full hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Retry upload"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        
                        {pending.status === 'error' && (
                          <button
                            onClick={() => onDismiss(pending.id)}
                            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            title="Dismiss"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        
                        {pending.status === 'uploading' && pending.cancel && (
                          <button
                            onClick={pending.cancel}
                            className="p-1 rounded-full hover:bg-red-100 text-red-600 transition-colors"
                            title="Cancel upload"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <div className="px-4">
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
                          <div ref={folderMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-2xl z-[99999] ring-1 ring-black/10">
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
                      className={`sm:hidden flex items-center justify-between ${isMobileDevice() ? 'px-4 py-4' : 'px-3 py-3'} hover:bg-gray-100 rounded-lg transition border border-gray-100 mb-2`}
                      style={{ cursor: 'pointer', minHeight: isMobileDevice() ? '64px' : '56px' }}
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
                        <div className={`${isMobileDevice() ? 'ml-4' : 'ml-3'} flex-1 min-w-0`}>
                          {renamingFileId === folder.id ? (
                            <div className="flex items-center w-full">
                              <input
                                className={`font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 ${isMobileDevice() ? 'text-lg' : 'text-base'} flex-1`}
                                value={renamingFileName}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onFocus={e => {
                                  const input = e.target as HTMLInputElement;
                                  input.setSelectionRange(0, renamingFileName.length);
                                }}
                                onChange={e => setRenamingFileName(e.target.value)}
                                onBlur={async () => {
                                  const trimmed = renamingFileName.trim();
                                  if (trimmed) {
                                    await handleRename(folder, trimmed);
                                  } else {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                              />
                              <span className={`text-gray-400 ${isMobileDevice() ? 'text-base ml-3' : 'text-sm ml-2'}`}>{folder.name}</span>
                            </div>
                          ) : (
                            <>
                              <div className={`text-gray-900 font-semibold truncate ${isMobileDevice() ? 'text-lg' : 'text-base'}`}>
                                {folder.name}
                              </div>
                              <div className={`${isMobileDevice() ? 'text-sm' : 'text-xs'} text-gray-500 mt-1 flex items-center gap-2`}>
                                <span>{formatDate(folder.created_at)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          className={`${isMobileDevice() ? 'p-3' : 'p-2'} rounded hover:bg-gray-200 ml-2 flex-shrink-0`}
                          onClick={e => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            setFileMenuId(folderMenuId === folder.id ? null : folder.id);
                          }}
                          title="Folder actions"
                        >
                          <svg className={`${isMobileDevice() ? 'w-6 h-6' : 'w-5 h-5'} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                          </svg>
                        </button>
                        {folderMenuId === folder.id && (
                          <div ref={folderMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-2xl z-[99999] ring-1 ring-black/10">
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
                  </div>
                ))}

                {/* Files */}
                {sortedFiles.map(file => {
                  const [, ext] = splitFileNameAndExt(file.file_name);
                  return (
                    <div key={file.id}>
                      {/* Desktop File Layout */}
                      <div
                        className="hidden sm:grid grid-cols-12 gap-4 items-center px-3 py-2 hover:bg-gray-100 rounded-lg transition group border border-gray-100 mb-1"
                      style={{ cursor: 'pointer', minHeight: 40 }}
                      onClick={async (e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                          return;
                        }
                        
                        // If any menu is open, close it instead of opening the file
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        try {
                          await openFileInline(file);
                        } catch (error) {
                          console.error('Error opening file:', error);
                          alert('Unable to open file. Please try again.');
                        }
                      }}
                    >
                      <div className="col-span-7 flex items-center min-w-0">
                        <FileIcon
                          type={file.file_name.split('.').pop() || 'file'}
                          size={28}
                        />
                        <div className="ml-3 flex-1 min-w-0 text-gray-900 font-medium truncate">
                          {renamingFileId === file.id ? (
                            <div className="flex items-center w-full">
                              <input
                                className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-base flex-1"
                                value={renamingFileName}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onFocus={e => {
                                  const input = e.target as HTMLInputElement;
                                  input.setSelectionRange(0, renamingFileName.length);
                                }}
                                onChange={e => setRenamingFileName(e.target.value)}
                                onBlur={async () => {
                                  const trimmed = renamingFileName.trim();
                                  if (trimmed) {
                                    await handleRename(file, trimmed);
                                  } else {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                              />
                              <span className="text-gray-400 text-sm ml-2">{ext}</span>
                            </div>
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
                          <div ref={fileMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-2xl z-[99999] ring-1 ring-black/10">
                            <button
                              className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setRenamingFileId(file.id);
                                setRenamingFileName(getFileNameWithoutExtension(file.file_name));
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                setFileMenuId(null);
                                try {
                                  await openFileInline(file);
                                } catch (error) {
                                  console.error('Error opening file:', error);
                                  alert('Unable to open file. Please try again.');
                                }
                              }}
                            >Open</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-green-600 hover:text-white font-medium cursor-pointer"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const fileUrl = await getFileSignedUrl(file.property_id, file.file_name, true);
                                  window.open(fileUrl, '_blank');
                                } catch (error) {
                                  console.error('Error downloading file:', error);
                                  alert('Unable to download file. Please try again.');
                                }
                              }}
                            >Download</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                onFileDelete(file);
                                setFileMenuId(null);
                              }}
                            >Delete</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile File Layout */}
                    <div
                      className={`sm:hidden flex items-center justify-between ${isMobileDevice() ? 'px-4 py-4' : 'px-3 py-3'} hover:bg-gray-100 rounded-lg transition border border-gray-100 mb-2`}
                      style={{ cursor: 'pointer', minHeight: isMobileDevice() ? '64px' : '56px' }}
                      onClick={async (e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                          return;
                        }
                        
                        // If any menu is open, close it instead of opening the file
                        if (fileMenuId || folderMenuId) {
                          setFileMenuId(null);
                          setFolderMenuId(null);
                          return;
                        }
                        
                        try {
                          await openFileInline(file);
                        } catch (error) {
                          console.error('Error opening file:', error);
                          alert('Unable to open file. Please try again.');
                        }
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <FileIcon
                          type={file.file_name.split('.').pop() || 'file'}
                          size={isMobileDevice() ? 36 : 32}
                        />
                        <div className={`${isMobileDevice() ? 'ml-4' : 'ml-3'} flex-1 min-w-0`}>
                          {renamingFileId === file.id ? (
                            <div className="flex items-center w-full">
                              <input
                                className={`font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 ${isMobileDevice() ? 'text-lg' : 'text-base'} flex-1`}
                                value={renamingFileName}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onFocus={e => {
                                  const input = e.target as HTMLInputElement;
                                  input.setSelectionRange(0, renamingFileName.length);
                                }}
                                onChange={e => setRenamingFileName(e.target.value)}
                                onBlur={async () => {
                                  const trimmed = renamingFileName.trim();
                                  if (trimmed) {
                                    await handleRename(file, trimmed);
                                  } else {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') {
                                    setRenamingFileId(null);
                                    setRenamingFileName('');
                                  }
                                }}
                              />
                              <span className={`text-gray-400 ${isMobileDevice() ? 'text-base ml-3' : 'text-sm ml-2'}`}>{ext}</span>
                            </div>
                          ) : (
                            <>
                              <div className={`text-gray-900 font-semibold truncate ${isMobileDevice() ? 'text-lg' : 'text-base'}`}>
                                {getFileNameWithoutExtension(file.file_name)}
                              </div>
                              <div className={`${isMobileDevice() ? 'text-sm' : 'text-xs'} text-gray-500 mt-1 flex items-center gap-2`}>
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
                          className={`${isMobileDevice() ? 'p-3' : 'p-2'} rounded hover:bg-gray-200 ml-2 flex-shrink-0`}
                          onClick={e => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            setFileMenuId(fileMenuId === file.id ? null : file.id);
                          }}
                          title="File actions"
                        >
                          <svg className={`${isMobileDevice() ? 'w-6 h-6' : 'w-5 h-5'} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                          </svg>
                        </button>
                        {fileMenuId === file.id && (
                          <div ref={fileMenuRef} className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-blue-200 rounded-lg shadow-2xl z-[99999] ring-1 ring-black/10">
                            <button
                              className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                setRenamingFileId(file.id);
                                setRenamingFileName(getFileNameWithoutExtension(file.file_name));
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                setFileMenuId(null);
                                try {
                                  await openFileInline(file);
                                } catch (error) {
                                  console.error('Error opening file:', error);
                                  alert('Unable to open file. Please try again.');
                                }
                              }}
                            >Open</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-green-600 hover:text-white font-medium cursor-pointer"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const fileUrl = await getFileSignedUrl(file.property_id, file.file_name, true);
                                  window.open(fileUrl, '_blank');
                                } catch (error) {
                                  console.error('Error downloading file:', error);
                                  alert('Unable to download file. Please try again.');
                                }
                              }}
                            >Download</button>
                            <button
                              className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                onFileDelete(file);
                                setFileMenuId(null);
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
        </div>

        {/* Hidden file input for upload */}
        <input id="file-upload-input" type="file" className="hidden" onChange={(e) => {
          if (e.target.files) onFileUpload(e.target.files);
        }} multiple />

        {/* Action Buttons */}
        <div className="flex w-full bg-white border-t border-blue-100 rounded-b-3xl overflow-hidden flex-shrink-0" style={{
          height: '80px',
          // Ensure buttons are always above mobile browser chrome
          paddingBottom: isMobileDevice() ? 'env(safe-area-inset-bottom, 0px)' : '0',
          minHeight: isMobileDevice() ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : '80px'
        }}>
          <button
            className="w-1/2 h-full bg-gray-100 text-blue-700 text-lg font-bold flex items-center justify-center gap-3 border-r border-blue-100 rounded-none rounded-bl-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all hover:bg-blue-50 active:scale-95"
            onClick={() => setCreatingFolder(true)}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
          <button
            className="w-1/2 h-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center gap-3 rounded-none rounded-br-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-blue-700 active:scale-95"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5 5V3" />
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

      {/* Mobile file viewer */}
      {renderMobileFileViewer()}
    </div>
  );
}; 