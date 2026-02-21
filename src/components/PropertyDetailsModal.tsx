import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';

import { MoveModal } from './MoveModal';
import { FileIcon } from './FileIcon';
import { FileThumbnail } from './FileThumbnail';
import { PropertySwitcher } from './PropertySwitcher';
import { FileMenu } from './FileMenu';
import { FolderMenu } from './FolderMenu';
import { RenameInput } from './RenameInput';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { useResponsiveValue } from '../hooks/useResponsiveValue';
import { usePropertySwitcher } from '../hooks/usePropertySwitcher';
import { useConfig } from '../contexts/ConfigContext';
import { useToast } from '../contexts/ToastContext';
import type { Property, PropertyFile, PropertyFolder, PendingUpload, SortField, SortDirection } from '../../types';
import type { PropertyWithFileCount } from '../../types';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { formatDate, formatFileSize, splitFileNameAndExt, getFileNameWithoutExtension } from '../../utils/fileManagement';
import { getFileSignedUrl } from '../utils/supabaseClient';
import { FolderIcon as HeroFolderIcon } from '@heroicons/react/24/solid';

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
  onFileUpload: (files: FileList) => Promise<void>;
  onFileDelete: (file: PropertyFile) => void;
  onFileRename: (item: PropertyFile | PropertyFolder, newName: string) => void;
  onFileMove?: (file: PropertyFile, targetFolderId: string | null) => Promise<void>;
  onFolderCreate: (name: string) => void;
  onFolderDelete: (folder: PropertyFolder) => void;
  
  // Pending uploads
  pendingUploads: PendingUpload[];
  onDismiss: (uploadId: string) => void;
  
  // Cache functions - for future use
  getCachedPropertyData?: (address: string) => Promise<{ files: PropertyFile[]; folders: PropertyFolder[] } | null>;
  cachePropertyData?: (address: string, files: PropertyFile[], folders: PropertyFolder[]) => void;
  
  // Property switching
  onPropertySwitch?: (property: PropertyWithFileCount, files: PropertyFile[], folders: PropertyFolder[]) => void;
  onMapMove?: (lat: number, lng: number) => void;
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
  onFileMove,
  onFolderCreate,
  onFolderDelete,
  pendingUploads,
  onDismiss,
  onPropertySwitch,
  onMapMove
}: PropertyDetailsModalProps) => {
  const { showToast } = useToast();

  // State for UI interactions
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderErrorPopup, setFolderErrorPopup] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFileName, setRenamingFileName] = useState('');
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{[key: string]: {top?: number, bottom?: number, left?: number, right?: number}}>({});
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFileTarget, setMoveFileTarget] = useState<PropertyFile | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [switchingProperty, setSwitchingProperty] = useState(false);

  const closeMenus = useCallback(() => {
    setFileMenuId(null);
    setFolderMenuId(null);
  }, []);
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('droppoint-view-mode');
      return (saved === 'grid' || saved === 'list') ? saved : 'grid';
    }
    return 'grid';
  });

  // Save view mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('droppoint-view-mode', viewMode);
    }
  }, [viewMode]);

  // Blanket fix: Close all menus when view mode changes
  useEffect(() => {
    closeMenus();
  }, [viewMode, closeMenus]);

  // Blanket fix: Close all menus when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      // Close menus when modal closes
      closeMenus();
    }
  }, [isOpen, closeMenus]);

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

  // Use global mobile viewport hook
  const { 
    isMobile, 
    getModalDimensions, 
    getMobileStyles,
    mobileClasses 
  } = useMobileViewport();

  // Configuration hook
  const { streetViewEnabled, propertyImageEnabled } = useConfig();

  // Property switching hook
  const { switchToProperty } = usePropertySwitcher({
    onMapMove,
    onPropertyDataLoad: (property, files, folders) => {
      // Clear search when switching properties
      setSearchQuery('');
      onPropertySwitch?.(property, files, folders);
    },
    onLoadingStateChange: setSwitchingProperty,
    onError: (error) => {
      console.error('Property switch error:', error);
      // You could add a toast notification here
    },
    propertyCache: (globalThis as { 
      __droppoint_property_cache?: Record<string, {
        files: PropertyFile[];
        folders: PropertyFolder[];
        lastFetched: number;
      }> 
    }).__droppoint_property_cache || {},
    cacheTimeout: 5 * 60 * 1000
  });

  // Convert current property to PropertyWithFileCount format
  const currentPropertyWithFileCount: PropertyWithFileCount | null = property ? {
    ...property,
    file_count: files.length,
    created_at: undefined, // PropertyWithFileCount doesn't have created_at
    last_accessed: new Date().toISOString() // Current time as last accessed
  } : null;

  // Global address parsing and formatting utility
  const parseAddress = (fullAddress: string) => {
    if (!fullAddress) return { streetAddress: '', locationInfo: '' };
    
    // Clean up the address and split by commas
    const parts = fullAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
    
    if (parts.length < 2) {
      // If no commas, treat entire string as street address
      return { streetAddress: fullAddress.trim(), locationInfo: '' };
    }
    
    // First part is the street address
    const streetAddress = parts[0];
    
    // Remaining parts form the location info
    const locationParts = parts.slice(1);
    
    // Handle different address formats
    if (locationParts.length >= 2) {
      const city = locationParts[0];
      const stateOrRegion = locationParts[1];
      
      // Check for US state + ZIP pattern (e.g., "TX 77407" or "Texas 77407")
      const usStateZipMatch = stateOrRegion.match(/^([A-Z]{2}|[A-Za-z\s]+)\s+(\d{5}(-\d{4})?)$/);
      
      if (usStateZipMatch) {
        // US format detected
        const state = usStateZipMatch[1];
        const zip = usStateZipMatch[2];
        
        // Check if there's a country after the state/zip
        const remainingParts = locationParts.slice(2);
        const country = remainingParts.length > 0 ? remainingParts.join(', ') : '';
        
        return {
          streetAddress,
          locationInfo: `${city}, ${state} ${zip}${country ? `, ${country}` : ''}`
        };
      } else {
        // International or other format
        // Check if last part looks like a country (typically longer and capitalized)
        const lastPart = locationParts[locationParts.length - 1];
        const isCountry = lastPart.length > 2 && /^[A-Z]/.test(lastPart);
        
        if (isCountry && locationParts.length > 2) {
          // Format: City, Region, Country
          const city = locationParts[0];
          const region = locationParts.slice(1, -1).join(', ');
          const country = lastPart;
          
          return {
            streetAddress,
            locationInfo: `${city}, ${region}, ${country}`
          };
        } else {
          // Simple format: just join all location parts
          return {
            streetAddress,
            locationInfo: locationParts.join(', ')
          };
        }
      }
    } else {
      // Only one location part (e.g., "Street, City")
      return {
        streetAddress,
        locationInfo: locationParts[0]
      };
    }
  };

  // Parse the current property address
  const { streetAddress, locationInfo } = parseAddress(property?.address || '');
  
  // Get display name (custom name/label takes priority over address)
  const displayName = property?.label || streetAddress || property?.address || '';
  const showRealAddress = property?.label && property.label.trim() !== streetAddress;

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
  
  // Smart menu positioning function
  const calculateMenuPosition = (buttonElement: HTMLElement, menuId: string) => {
    const rect = buttonElement.getBoundingClientRect();
    const menuHeight = 200; // Approximate menu height
    const menuWidth = 176; // 44 * 4 (w-44)
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const padding = 8; // Minimum distance from screen edge
    
    const position: {top?: number, bottom?: number, left?: number, right?: number} = {};
    
    // Vertical positioning - prefer below, but use above if not enough space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow >= menuHeight + padding) {
      // Enough space below
      position.top = rect.bottom + padding;
    } else if (spaceAbove >= menuHeight + padding) {
      // Not enough space below, but enough above
      position.bottom = viewportHeight - rect.top + padding;
    } else {
      // Not enough space above or below, position in the middle of available space
      if (spaceBelow > spaceAbove) {
        // More space below
        position.top = Math.max(padding, rect.bottom + padding);
      } else {
        // More space above
        position.bottom = Math.max(padding, viewportHeight - rect.top + padding);
      }
    }
    
    // Horizontal positioning - prefer right-aligned with button, but adjust if would go off-screen
    const spaceRight = viewportWidth - rect.right;
    const spaceLeft = rect.left;
    
    if (spaceRight >= menuWidth + padding) {
      // Enough space to the right of button (right-aligned)
      position.right = viewportWidth - rect.right;
    } else if (spaceLeft >= menuWidth + padding) {
      // Not enough space right-aligned, try left-aligned with button
      position.left = rect.left - menuWidth + rect.width;
    } else if (rect.left + menuWidth + padding <= viewportWidth) {
      // Try left edge of button
      position.left = rect.left;
    } else {
      // Force fit - position as far right as possible while staying on screen
      position.right = padding;
    }
    
    // Final safety check - ensure we don't go off any edge
    if (position.left !== undefined) {
      position.left = Math.max(padding, Math.min(position.left, viewportWidth - menuWidth - padding));
    }
    if (position.right !== undefined) {
      position.right = Math.max(padding, Math.min(position.right, viewportWidth - menuWidth - padding));
    }
    if (position.top !== undefined) {
      position.top = Math.max(padding, Math.min(position.top, viewportHeight - menuHeight - padding));
    }
    if (position.bottom !== undefined) {
      position.bottom = Math.max(padding, Math.min(position.bottom, viewportHeight - menuHeight - padding));
    }
    
    setMenuPosition(prev => ({...prev, [menuId]: position}));
  };

  // Folder validation - memoized to prevent recalculation on every render
  const maxFolderLength = 50;
  const folderNameError = useCallback((name: string) => {
    const forbiddenFolderChars = /[:;\/\\*?"<>|]/;
    if (!name) return '';
    if (name[0] === ' ') return "Folder name can't start with a space.";
    if (forbiddenFolderChars.test(name)) return "Folder names can't include : ; / \\ * ? \" < > |";
    if (name.length > maxFolderLength) return `Folder name must be less than ${maxFolderLength} characters.`;
    return '';
  }, []);
  
  const folderNameValidationMsg = useMemo(() => folderNameError(newFolderName), [newFolderName, folderNameError]);
  const isFolderNameValid = !!newFolderName && !folderNameValidationMsg;
  
  
  // Responsive values
  const titleSize = useResponsiveValue('text-base', 'text-xl');
  const locationSize = useResponsiveValue('text-xs', 'text-base');
  const buttonPadding = useResponsiveValue('p-2', 'p-2.5');
  const iconSize = useResponsiveValue('w-4 h-4', 'w-5 h-5');
  const headerHeight = useResponsiveValue('h-28', 'h-32');
  const searchPadding = useResponsiveValue('px-4 py-4 text-base', 'px-4 py-2 text-sm');
  const searchIconPos = useResponsiveValue('top-4 w-5 h-5', 'top-2.5 w-4 h-4');
  const tableHeaderPadding = useResponsiveValue('py-3', 'py-2');
  const listItemPadding = useResponsiveValue('px-4 py-2.5', 'px-3 py-3');
  const listIconSize = useResponsiveValue(32, 28);
  const listRenameVariant = useResponsiveValue<'full' | 'simple'>('full', 'simple');
  const gridIconSize = useResponsiveValue(48, 56);
  const gridMenuButtonSize = '28px';

  // Sorting logic - Folders first, then files (standard document management practice)
  const sortedItems = useMemo(() => {
    // Combine files and folders into a single array with unified interface
    const allItems: (PropertyFile & { itemType: 'file' } | PropertyFolder & { itemType: 'folder' })[] = [
      ...files
        .filter(file => {
          // If searching, show all files regardless of folder
          if (searchQuery.trim()) {
            return file.file_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
          }
          // Otherwise, filter by current folder
          return selectedFolder === 'master' ? !file.folder_id : file.folder_id === selectedFolder;
        })
        .map(file => ({ ...file, itemType: 'file' as const })),
      ...folders
        .filter(folder => {
          // If searching, show all folders regardless of parent
          if (searchQuery.trim()) {
            return folder.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
          }
          // Otherwise, filter by current folder
          return selectedFolder === 'master' ? folder.parent_id === null : folder.parent_id === selectedFolder;
        })
        .map(folder => ({ ...folder, itemType: 'folder' as const }))
    ];

    return allItems.sort((a, b) => {
      // Always put folders before files
      if (a.itemType !== b.itemType) {
        return a.itemType === 'folder' ? -1 : 1;
      }
      
      // Within the same type, sort by the selected criteria
      let comparison = 0;
      switch (sortField) {
        case 'name':
          const aName = a.itemType === 'file' ? a.file_name : a.name;
          const bName = b.itemType === 'file' ? b.file_name : b.name;
          comparison = aName.localeCompare(bName);
          break;
        case 'date':
          // Use uploaded_at for files, created_at for folders
          const aDate = a.itemType === 'file' ? a.uploaded_at : a.created_at;
          const bDate = b.itemType === 'file' ? b.uploaded_at : b.created_at;
          comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
          break;
        case 'size':
          // Files have size, folders are treated as 0 size
          const aSize = a.itemType === 'file' ? a.file_size : 0;
          const bSize = b.itemType === 'file' ? b.file_size : 0;
          comparison = aSize - bSize;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [files, folders, selectedFolder, sortField, sortDirection, searchQuery]);


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
      // Get the current item from the files/folders array to ensure we have the latest reference
      // This is especially important in sorted view where items can move positions
      let currentItem: PropertyFile | PropertyFolder | undefined;
      if ('file_name' in item) {
        // It's a file
        currentItem = files.find(f => f.id === item.id);
      } else {
        // It's a folder
        currentItem = folders.find(f => f.id === item.id);
      }
      
      // If item not found, use the original item (fallback)
      const itemToRename = currentItem || item;
      
      // For files, append the original extension back to the new name
      let finalName = newName;
      if ('file_name' in itemToRename) {
        const [, originalExtWithDot] = splitFileNameAndExt(itemToRename.file_name);
        if (originalExtWithDot && !newName.includes('.')) {
          // originalExtWithDot already contains the leading dot
          finalName = `${newName}${originalExtWithDot}`;
        }
      }
      
      await onFileRename(itemToRename, finalName);
      setRenamingFileId(null);
      setRenamingFileName('');
    } catch (error) {
      console.error('Rename failed:', error);
      // Keep rename state active if there's an error so user can retry
    }
  };

  // Enhanced click outside handler - prevents accidental clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if any menu is currently open
      const anyMenuOpen = fileMenuId || folderMenuId;
      
      if (!anyMenuOpen) return;
      
      // Check if click is on a menu button (check for title attribute, aria-label, or three-dot button structure)
      const buttonElement = target.closest('button');
      const isMenuButton = target.closest('button[title="Folder actions"]') || 
                          target.closest('button[title="File actions"]') ||
                          target.closest('button[aria-label="Folder actions"]') ||
                          target.closest('button[aria-label="File actions"]') ||
                          // Check if clicking on the SVG inside a three-dot button, or if parent button has three-dot SVG
                          (target.closest('svg') && target.closest('svg')?.parentElement?.closest('button')) ||
                          (buttonElement && buttonElement.querySelector('svg circle'));
      
      // Don't close if clicking the menu button itself
      if (isMenuButton) return;
      
      let menuClosed = false;
      
      // Close folder menu if clicking outside
      if (folderMenuId && folderMenuRef.current && !folderMenuRef.current.contains(target)) {
        setFolderMenuId(null);
        menuClosed = true;
      }
      
      // Close file menu if clicking outside
      if (fileMenuId && fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuId(null);
        menuClosed = true;
      }
      
      // If we just closed a menu, prevent the click from propagating to other elements
      if (anyMenuOpen && menuClosed) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener('click', handleClick, true); // Use capture phase
    document.addEventListener('touchend', handleClick, true); // Also handle touch events for mobile
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('touchend', handleClick, true);
    };
  }, [fileMenuId, folderMenuId]);

  // Enhanced mobile-first file opening function
  const openFileInline = async (file: PropertyFile) => {
    try {
      const fileUrl = await getFileSignedUrl(file.property_id, file.file_name, false);
      const downloadUrl = await getFileSignedUrl(file.property_id, file.file_name, true);
      const fileExtension = file.file_name.split('.').pop()?.toLowerCase();
      
      // Mobile-first approach
      if (isMobile) {
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
      showToast('Unable to open file. Please try again.');
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
        height: '100dvh',
        maxHeight: '100dvh'
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
              <Image
                src={mobileFileViewer.fileUrl}
                alt={file.file_name}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                style={{ 
                  maxHeight: 'calc(100dvh - 120px)' 
                }}
                unoptimized
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



  if (!isOpen || !property) return null;

  // Breadcrumb path
  const breadcrumbPath = [];
  for (let current = folders.find(f => f.id === selectedFolder); current; current = current.parent_id ? folders.find(f => f.id === current.parent_id) : undefined) {
    breadcrumbPath.unshift(current);
  }

  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('droppoint-view-mode', newMode);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex ${mobileClasses.modal} justify-center bg-black/50 backdrop-blur-md transition-all animate-fade-in`}
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100vw-20px)] sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col border border-gray-200 relative overflow-hidden"
           style={{ 
             borderRadius: '1.5rem', 
             ...getModalDimensions(),
           }}>
        
        {/* Header */}
        <div className="modal-header-refined flex items-center justify-between px-5 py-3 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center min-w-0 flex-1 mr-4">
            <div className="flex flex-col min-w-0 flex-1">
              {/* Custom Name or Street Address - Primary */}
              <h1 className={`property-title ${titleSize} font-semibold leading-tight mb-0.5`} 
                  style={{ letterSpacing: '-0.02em' }}
                  title={displayName}>
                {displayName}
              </h1>
              {/* Real Address (when custom name is used) */}
              {showRealAddress && (
                <p className={`property-location ${locationSize} font-medium leading-snug`} 
                   style={{ letterSpacing: '-0.005em' }}
                   title={streetAddress}>
                  {streetAddress}
                </p>
              )}
              {/* Location Info - Secondary */}
              {locationInfo && !showRealAddress && (
                <p className={`property-location ${locationSize} font-medium leading-snug`} 
                   style={{ letterSpacing: '-0.005em' }}
                   title={locationInfo}>
                  {locationInfo}
                </p>
              )}
              {/* Location Info (when custom name is shown) */}
              {locationInfo && showRealAddress && (
                <p className={`property-location ${locationSize} font-medium leading-snug text-gray-500`} 
                   style={{ letterSpacing: '-0.005em' }}
                   title={locationInfo}>
                  {locationInfo}
                </p>
              )}
            </div>
            
            {/* Property Switcher - Right next to address for intuitive property switching */}
            {currentPropertyWithFileCount && (
              <div className="ml-3 flex-shrink-0">
                <PropertySwitcher
                  currentProperty={currentPropertyWithFileCount}
                  onPropertySelect={switchToProperty}
                  disabled={switchingProperty}
                />
              </div>
            )}
          </div>
          
          {/* Action buttons with proper spacing */}
          <div className="flex items-center gap-3">
            {/* View Toggle Button */}
            <button
              className={`${buttonPadding} rounded-full cursor-pointer flex-shrink-0 hover:bg-gray-100 transition-colors`}
              onClick={toggleViewMode}
              title={`Switch to ${viewMode === 'list' ? 'grid' : 'list'} view`}
            >
              {viewMode === 'list' ? (
                // Grid icon when in list mode
                <svg className={`${iconSize} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              ) : (
                // List icon when in grid mode
                <svg className={`${iconSize} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              )}
            </button>
            
            {/* Close button with better spacing and styling */}
            <button
              className={`close-button ${buttonPadding} rounded-full cursor-pointer flex-shrink-0 hover:bg-gray-100 transition-colors`}
              onClick={() => {
                onClose();
                setCreatingFolder(false);
                setSearchQuery('');
              }}
              title="Close"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File List Container - Scrollable with satellite image first, then all other content */}
          <div className="flex-1 overflow-y-auto file-list overflow-x-visible mobile-scroll" style={{ 
            minHeight: '200px', // Minimum height for content
            // Let content naturally size on mobile instead of fixed height restrictions
          }}>
            {/* Property preview: Street View, Satellite Map, or no image based on configuration */}
            {propertyImageEnabled && (
              streetViewEnabled ? (
                <div className={`relative w-full ${headerHeight} bg-gray-200 border-b border-blue-100 flex-shrink-0`}>
                  <Image
                    key={`property-image-${property?.id || 'new'}-${snappedLatLng?.lat}-${snappedLatLng?.lng}`}
                    src={
                      // Use Street View on mobile where aspect fits; use satellite map on desktop to avoid skinny distortion
                      isMobile
                        ? `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`
                        : `https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&zoom=17&size=1200x400&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&key=${GOOGLE_MAPS_API_KEY}`
                    }
                    alt="Property preview"
                    layout="fill"
                    objectFit="cover"
                    priority
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target && target.src.indexOf('streetview') !== -1) {
                        target.src = `https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&zoom=17&size=800x400&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&key=${GOOGLE_MAPS_API_KEY}`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className={`relative w-full ${headerHeight} bg-gray-200 border-b border-blue-100 flex-shrink-0`}>
                  <Image
                    key={`property-image-${property?.id || 'new'}-${snappedLatLng?.lat}-${snappedLatLng?.lng}`}
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&zoom=17&size=1200x400&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? property?.lat)},${(snappedLatLng?.lng ?? property?.lng)}&key=${GOOGLE_MAPS_API_KEY}`}
                    alt="Property satellite view"
                    layout="fill"
                    objectFit="cover"
                    priority
                    unoptimized
                  />
                </div>
              )
            )}

            {/* All other content comes after satellite image */}
            <div className="bg-white sticky top-0 z-50 border-b border-gray-100">
              {/* Breadcrumbs - compact unified bar */}
              {(breadcrumbPath.length > 0 || selectedFolder !== 'master') && (
                <div className="px-4 py-2 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-700 overflow-x-auto">
                    {selectedFolder !== 'master' && (
                      <button
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => {
                          const currentFolder = folders.find(f => f.id === selectedFolder);
                          const parentId = currentFolder?.parent_id || 'master';
                          setSearchQuery('');
                          onFolderChange(parentId);
                        }}
                        aria-label="Back"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}
                    <button
                      className="text-gray-500 hover:text-blue-600 flex items-center gap-1 flex-shrink-0"
                      onClick={() => {
                        setSearchQuery('');
                        onFolderChange('master');
                      }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 1.293a1 1 0 00-1.414 0l-8 8a1 1 0 001.414 1.414L4 9.414V20a2 2 0 002 2h3a1 1 0 001-1v-5a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 001 1h3a2 2 0 002-2V9.414l1.293 1.293a1 1 0 001.414-1.414l-8-8z"/></svg>
                      <span className="whitespace-nowrap">Home</span>
                    </button>
                    {breadcrumbPath.map((folder) => (
                      <div key={folder.id} className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-400">›</span>
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          onClick={() => {
                            setSearchQuery('');
                            onFolderChange(folder.id);
                          }}
                        >
                          {folder.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Search Bar - Always visible with enhanced mobile positioning */}
              <div className={`px-4 ${breadcrumbPath.length > 0 ? 'py-3' : 'py-4'} bg-white min-h-[72px] sm:min-h-0`} style={{
                // Ensure search bar is always above mobile browser chrome
                position: 'sticky',
                top: breadcrumbPath.length > 0 ? '0' : '0',
                zIndex: 60, // Higher z-index to ensure it stays above everything
              }}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search files and folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${searchPadding} min-h-[48px] sm:min-h-0 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-10 ${searchQuery ? 'pr-10' : ''} text-black placeholder-gray-400`}
                  />
                  <svg className={`absolute left-3 ${searchIconPos} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute right-3 ${searchIconPos} text-gray-400 hover:text-gray-600 transition-colors rounded-full flex items-center justify-center`}
                      title="Clear search"
                    >
                      <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Column Headers - Sticky and always visible */}
              <div className={`hidden sm:grid grid-cols-12 gap-4 px-3 ${tableHeaderPadding} text-sm border-b border-gray-200 bg-white ${viewMode === 'grid' ? 'sm:hidden' : ''}`}>
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
                  className="col-span-2 flex items-center justify-end gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort('size')}
                >
                  Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {/* Content */}
            {!foldersLoading && !filesLoading && (
              <>
                {/* Empty State */}
                {sortedItems.length === 0 && selectedFolder === 'master' && (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No files yet</p>
                    <p className="text-xs text-gray-400 mt-1">Upload files or create folders to get started</p>
                  </div>
                )}

                {/* Combined Files and Folders - Google Drive Style */}
                <div className="px-4">
                  {viewMode === 'list' ? (
                    // List View (existing layout)
                    sortedItems.map(item => {
                      if (item.itemType === 'folder') {
                        // Render folder
                        const folder = item;
                        return (
                          <div key={`folder-${folder.id}`}>
                            <div
                              className={`flex sm:grid sm:grid-cols-12 sm:gap-4 items-center ${listItemPadding} sm:px-3 sm:py-2 min-h-[56px] sm:min-h-[40px] hover:bg-gray-100 rounded-lg transition mb-0.5`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (fileMenuId || folderMenuId) {
                                  closeMenus();
                                  return;
                                }

                                setSearchQuery('');
                                onFolderChange(folder.id);
                              }}
                            >
                              <div className="flex items-center min-w-0 flex-1 sm:col-span-7">
                                <HeroFolderIcon
                                  style={{
                                    width: listIconSize,
                                    height: listIconSize,
                                    color: '#fbbf24'
                                  }}
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                  {renamingFileId === folder.id ? (
                                    <RenameInput
                                      value={renamingFileName}
                                      onChange={setRenamingFileName}
                                      onBlur={async () => {
                                        const trimmed = renamingFileName.trim();
                                        if (trimmed) {
                                          await handleRename(folder, trimmed);
                                        } else {
                                          setRenamingFileId(null);
                                          setRenamingFileName('');
                                        }
                                      }}
                                      onCancel={() => {
                                        setRenamingFileId(null);
                                        setRenamingFileName('');
                                      }}
                                      onSave={async () => {
                                        const trimmed = renamingFileName.trim();
                                        if (trimmed) {
                                          await handleRename(folder, trimmed);
                                        }
                                      }}
                                      placeholder="Folder name"
                                      variant={listRenameVariant}
                                      className="w-full"
                                    />
                                  ) : (
                                    <>
                                      <div className="text-gray-900 font-medium truncate">
                                        {folder.name}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 sm:hidden">
                                        <span>{formatDate(folder.created_at)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="hidden sm:block sm:col-span-3 text-xs text-gray-500">
                                {formatDate(folder.created_at)}
                              </div>
                              <div className="relative flex items-center justify-end sm:col-span-2">
                                <button
                                  className="p-2 sm:p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200 ml-2 flex-shrink-0"
                                  style={{ minWidth: 24, minHeight: 24 }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    closeMenus();
                                    const newMenuId = folderMenuId === folder.id ? null : folder.id;
                                    setFolderMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, folder.id);
                                    }
                                  }}
                                  onTouchEnd={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    closeMenus();
                                    const newMenuId = folderMenuId === folder.id ? null : folder.id;
                                    setFolderMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, folder.id);
                                    }
                                  }}
                                  title="Folder actions"
                                >
                                  <svg className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                                  </svg>
                                </button>
                                <FolderMenu
                                  folder={folder}
                                  isOpen={folderMenuId === folder.id}
                                  onClose={() => setFolderMenuId(null)}
                                  onRename={(folder) => {
                                    setRenamingFileId(folder.id);
                                    setRenamingFileName(folder.name);
                                  }}
                                  onDelete={onFolderDelete}
                                  menuPosition={menuPosition[folder.id] || {}}
                                  menuRef={folderMenuRef}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Render file
                        const file = item;
                        const [, ext] = splitFileNameAndExt(file.file_name);
                        return (
                          <div key={`file-${file.id}`}>
                            <div
                              className={`flex sm:grid sm:grid-cols-12 sm:gap-4 items-center ${listItemPadding} sm:px-3 sm:py-2 min-h-[56px] sm:min-h-[40px] hover:bg-gray-100 rounded-lg transition mb-0.5`}
                              style={{ cursor: 'pointer' }}
                              onClick={async (e) => {
                                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                                  return;
                                }

                                if (fileMenuId || folderMenuId) {
                                  closeMenus();
                                  return;
                                }

                                try {
                                  await openFileInline(file);
                                } catch (error) {
                                  console.error('Error opening file:', error);
                                  showToast('Unable to open file. Please try again.');
                                }
                              }}
                            >
                              <div className="flex items-center min-w-0 flex-1 sm:col-span-7">
                                <FileIcon
                                  type={file.file_name.split('.').pop() || 'file'}
                                  size={listIconSize}
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                  {renamingFileId === file.id ? (
                                    <RenameInput
                                      value={renamingFileName}
                                      onChange={setRenamingFileName}
                                      onBlur={async () => {
                                        const trimmed = renamingFileName.trim();
                                        if (trimmed) {
                                          await handleRename(file, trimmed);
                                        } else {
                                          setRenamingFileId(null);
                                          setRenamingFileName('');
                                        }
                                      }}
                                      onCancel={() => {
                                        setRenamingFileId(null);
                                        setRenamingFileName('');
                                      }}
                                      onSave={async () => {
                                        const trimmed = renamingFileName.trim();
                                        if (trimmed) {
                                          await handleRename(file, trimmed);
                                        }
                                      }}
                                      extension={listRenameVariant === 'simple' ? ext : undefined}
                                      placeholder="File name"
                                      variant={listRenameVariant}
                                    />
                                  ) : (
                                    <>
                                      <span className="text-gray-900 font-medium truncate">
                                        {getFileNameWithoutExtension(file.file_name)}
                                      </span>
                                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 sm:hidden">
                                        <span>{formatDate(file.modified_at || file.uploaded_at)}</span>
                                        <span>•</span>
                                        <span>{formatFileSize(file.file_size)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="hidden sm:block sm:col-span-3 text-xs text-gray-500">
                                {formatDate(file.modified_at || file.uploaded_at)}
                              </div>
                              <div className="relative flex items-center justify-end sm:col-span-2">
                                <span className="hidden sm:inline-block text-xs text-gray-500 mr-2">{formatFileSize(file.file_size)}</span>
                                <button
                                  className="p-2 sm:p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200 ml-2 flex-shrink-0"
                                  style={{ minWidth: 24, minHeight: 24 }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    closeMenus();
                                    const newMenuId = fileMenuId === file.id ? null : file.id;
                                    setFileMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, file.id);
                                    }
                                  }}
                                  onTouchEnd={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    closeMenus();
                                    const newMenuId = fileMenuId === file.id ? null : file.id;
                                    setFileMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, file.id);
                                    }
                                  }}
                                  title="File actions"
                                >
                                  <svg className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                                  </svg>
                                </button>
                                <FileMenu
                                  file={file}
                                  isOpen={fileMenuId === file.id}
                                  onClose={() => setFileMenuId(null)}
                                  onRename={(file) => {
                                    setRenamingFileId(file.id);
                                    setRenamingFileName(file.file_name);
                                  }}
                                  onMove={onFileMove ? (file) => {
                                    setMoveFileTarget(file);
                                    setShowMoveModal(true);
                                  } : undefined}
                                  onDelete={onFileDelete}
                                  menuPosition={menuPosition[file.id] || {}}
                                  menuRef={fileMenuRef}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })
                  ) : (
                    // Grid View (new iOS Files-style layout)
                    <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 p-2">
                      {sortedItems.map(item => {
                        if (item.itemType === 'folder') {
                          // Grid Folder Item
                          const folder = item;
                          return (
                            <div
                              key={`grid-folder-${folder.id}`}
                              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 transition cursor-pointer group relative"
                              onClick={() => {
                                // Clear search when entering a folder
                                setSearchQuery('');
                                onFolderChange(folder.id);
                              }}
                            >
                              <div className="relative">
                                <HeroFolderIcon style={{ width: gridIconSize, height: gridIconSize, color: '#fbbf24' }} />
                                {/* iOS-style perfectly circular menu button */}
                                <button
                                  className="absolute -top-2 -right-2 rounded-full bg-white/95 backdrop-blur-sm shadow-lg border border-black/10 transition-all duration-200 flex items-center justify-center hover:bg-gray-50 hover:shadow-xl touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  onClick={e => {
                                    e.stopPropagation();
                                    e.preventDefault(); // Prevent double-tap zoom on mobile
                                    // Close any open menus first
                                    closeMenus();
                                    // Then open this menu if not already open
                                    const newMenuId = folderMenuId === folder.id ? null : folder.id;
                                    setFolderMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, folder.id);
                                    }
                                  }}
                                  onTouchEnd={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Close any open menus first
                                    closeMenus();
                                    // Then open this menu if not already open
                                    const newMenuId = folderMenuId === folder.id ? null : folder.id;
                                    setFolderMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, folder.id);
                                    }
                                  }}
                                  style={{ 
                                    zIndex: 10,
                                    width: gridMenuButtonSize,
                                    height: gridMenuButtonSize,
                                    minWidth: gridMenuButtonSize,
                                    minHeight: gridMenuButtonSize,
                                    touchAction: 'manipulation', // Better touch handling
                                    cursor: 'pointer'
                                  }}
                                  aria-label="Folder actions"
                                >
                                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                                  </svg>
                                </button>
                                <FolderMenu
                                  folder={folder}
                                  isOpen={folderMenuId === folder.id}
                                  onClose={() => setFolderMenuId(null)}
                                  onRename={(folder) => {
                                    setRenamingFileId(folder.id);
                                    setRenamingFileName(folder.name);
                                  }}
                                  onDelete={onFolderDelete}
                                  menuPosition={menuPosition[folder.id] || {}}
                                  menuRef={folderMenuRef}
                                />
                              </div>
                              <div className="mt-2 text-center w-full">
                                {renamingFileId === folder.id ? (
                                  <RenameInput
                                    value={renamingFileName}
                                    onChange={setRenamingFileName}
                                    onBlur={async () => {
                                      const trimmed = renamingFileName.trim();
                                      if (trimmed) {
                                        await handleRename(folder, trimmed);
                                      } else {
                                        setRenamingFileId(null);
                                        setRenamingFileName('');
                                      }
                                    }}
                                    onCancel={() => {
                                      setRenamingFileId(null);
                                      setRenamingFileName('');
                                    }}
                                    placeholder="Folder name"
                                    variant="grid"
                                  />
                                ) : (
                                  <>
                                    <div className="font-medium text-gray-900 truncate text-xs sm:text-sm leading-tight">
                                      {folder.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {formatDate(folder.created_at)}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          // Grid File Item
                          const file = item;
                          const [, ext] = splitFileNameAndExt(file.file_name);
                          return (
                            <div
                              key={`grid-file-${file.id}`}
                              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 transition cursor-pointer group relative"
                              onClick={async (e) => {
                                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                                  return;
                                }
                                
                                // If any menu is open, close it instead of opening the file
                                if (fileMenuId || folderMenuId) {
                                  closeMenus();
                                  return;
                                }
                                
                                try {
                                  await openFileInline(file);
                                } catch (error) {
                                  console.error('Error opening file:', error);
                                  showToast('Unable to open file. Please try again.');
                                }
                              }}
                            >
                              <div className="relative">
                                <FileThumbnail
                                  fileName={file.file_name}
                                  propertyId={file.property_id}
                                  size={gridIconSize}
                                />
                                {/* iOS-style perfectly circular menu button */}
                                <button
                                  className="absolute -top-2 -right-2 rounded-full bg-white/95 backdrop-blur-sm shadow-lg border border-black/10 transition-all duration-200 flex items-center justify-center hover:bg-gray-50 hover:shadow-xl touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  onClick={e => {
                                    e.stopPropagation();
                                    e.preventDefault(); // Prevent double-tap zoom on mobile
                                    // Close any open menus first
                                    closeMenus();
                                    // Then open this menu if not already open
                                    const newMenuId = fileMenuId === file.id ? null : file.id;
                                    setFileMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, file.id);
                                    }
                                  }}
                                  onTouchEnd={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Close any open menus first
                                    closeMenus();
                                    // Then open this menu if not already open
                                    const newMenuId = fileMenuId === file.id ? null : file.id;
                                    setFileMenuId(newMenuId);
                                    if (newMenuId) {
                                      calculateMenuPosition(e.currentTarget, file.id);
                                    }
                                  }}
                                  style={{ 
                                    zIndex: 10,
                                    width: gridMenuButtonSize,
                                    height: gridMenuButtonSize,
                                    minWidth: gridMenuButtonSize,
                                    minHeight: gridMenuButtonSize,
                                    touchAction: 'manipulation', // Better touch handling
                                    cursor: 'pointer'
                                  }}
                                  aria-label="File actions"
                                >
                                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                                  </svg>
                                </button>
                                <FileMenu
                                  file={file}
                                  isOpen={fileMenuId === file.id}
                                  onClose={() => setFileMenuId(null)}
                                  onRename={(file) => {
                                    setRenamingFileId(file.id);
                                    setRenamingFileName(file.file_name);
                                  }}
                                  onMove={onFileMove ? (file) => {
                                    setMoveFileTarget(file);
                                    setShowMoveModal(true);
                                  } : undefined}
                                  onDelete={onFileDelete}
                                  menuPosition={menuPosition[file.id] || {}}
                                  menuRef={fileMenuRef}
                                />
                              </div>
                              <div className="mt-2 text-center w-full">
                                {renamingFileId === file.id ? (
                                  <RenameInput
                                    value={renamingFileName}
                                    onChange={setRenamingFileName}
                                    onBlur={async () => {
                                      const trimmed = renamingFileName.trim();
                                      if (trimmed) {
                                        await handleRename(file, trimmed);
                                      } else {
                                        setRenamingFileId(null);
                                        setRenamingFileName('');
                                      }
                                    }}
                                    onCancel={() => {
                                      setRenamingFileId(null);
                                      setRenamingFileName('');
                                    }}
                                    extension={ext}
                                    placeholder="File name"
                                    variant="grid"
                                  />
                                ) : (
                                  <>
                                    <div className="font-medium text-gray-900 truncate text-xs sm:text-sm leading-tight">
                                      {getFileNameWithoutExtension(file.file_name)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                                      <div>{formatFileSize(file.file_size)}</div>
                                      <div>{formatDate(file.modified_at || file.uploaded_at)}</div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input for upload */}
        <input id="file-upload-input" type="file" className="hidden" onChange={async (e) => {
          if (e.target.files) {
            try {
              await onFileUpload(e.target.files);
            } catch (error) {
              console.error('File upload error:', error);
              // You could add a toast notification here
            }
          }
        }} multiple />

        {/* Upload Progress Toasts - Apple-inspired design */}
        {pendingUploads.length > 0 && (
          <div className="fixed z-[9999] top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96">
            {/* Summary toast for multiple uploads */}
            {pendingUploads.length > 1 && (
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 mb-3 transform transition-all duration-300 ease-out">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Uploading {pendingUploads.filter(p => p.status === 'uploading').length} files
                      </p>
                      <div className="w-48 bg-gray-200 rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                          style={{ 
                            width: `${pendingUploads.reduce((acc, upload) => acc + upload.progress, 0) / pendingUploads.length}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Cancel active uploads and dismiss the rest
                      pendingUploads.forEach(upload => {
                        if (upload.status === 'uploading') {
                          upload.cancel?.();
                        } else {
                          onDismiss(upload.id);
                        }
                      });
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                    title="Clear"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {/* Individual file toasts */}
            <div className="space-y-2 max-h-80 overflow-hidden">
              {pendingUploads.slice(0, 4).map((upload) => (
                <div 
                  key={upload.id}
                  className={`bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 p-3 transform transition-all duration-500 ease-out ${
                    upload.status === 'success' 
                      ? 'bg-green-50/95 border-green-200/30' 
                      : upload.status === 'error'
                      ? 'bg-red-50/95 border-red-200/30'
                      : ''
                  }`}
                  style={{
                    animation: upload.status === 'success' 
                      ? 'slideInThenOut 2.5s ease-out forwards' 
                      : 'slideIn 0.3s ease-out'
                  }}
                >
                  <div className="flex items-center">
                    {/* File Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                      upload.status === 'uploading' 
                        ? 'bg-blue-100' 
                        : upload.status === 'success'
                        ? 'bg-green-100'
                        : upload.status === 'error'
                        ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}>
                      {upload.status === 'uploading' && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      {upload.status === 'success' && (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {upload.status === 'error' && (
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    
                    {/* File Info */}
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {upload.name}
                      </p>
                      {upload.status === 'uploading' && (
                        <div className="flex items-center mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1 mr-2">
                            <div 
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-medium">
                            {upload.progress}%
                          </span>
                        </div>
                      )}
                      {upload.status === 'success' && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">
                          Uploaded successfully
                        </p>
                      )}
                      {upload.status === 'error' && (
                        <p className="text-xs text-red-600 font-medium mt-0.5">
                          {upload.error || 'Upload failed'}
                        </p>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1">
                      {upload.status === 'uploading' && (
                        <button
                          onClick={upload.cancel}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                          title="Cancel"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {upload.status === 'error' && (
                        <button
                          onClick={upload.retry}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors group"
                          title="Retry"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      {upload.status !== 'uploading' && (
                        <button
                          onClick={() => onDismiss(upload.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                          title="Dismiss"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show more indicator */}
              {pendingUploads.length > 4 && (
                <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 p-2 text-center">
                  <p className="text-xs text-gray-500">
                    +{pendingUploads.length - 4} more files uploading...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add custom CSS for animations */}
        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes slideInThenOut {
            0% {
              opacity: 0;
              transform: translateX(100%);
            }
            15% {
              opacity: 1;
              transform: translateX(0);
            }
            85% {
              opacity: 1;
              transform: translateX(0);
            }
            100% {
              opacity: 0;
              transform: translateX(100%);
            }
          }
        `}</style>

        {/* Action Buttons */}
        <div className="flex w-full bg-white border-t border-gray-200 rounded-b-3xl overflow-hidden flex-shrink-0 h-14 min-h-[56px] sm:h-[70px] sm:min-h-[70px]" style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          ...getMobileStyles('container')
        }}>
          <button
            className="w-1/2 py-2.5 px-4 sm:py-0 sm:px-0 sm:h-full bg-gray-100 text-blue-700 text-base sm:text-lg font-bold flex items-center justify-center gap-2 border-r border-gray-200 rounded-none rounded-bl-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all hover:bg-blue-50 active:scale-95"
            onClick={() => setCreatingFolder(true)}
          >
            <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Folder
          </button>
          <button
            className="w-1/2 py-2.5 px-4 sm:py-0 sm:px-0 sm:h-full bg-blue-600 text-white text-base sm:text-lg font-bold flex items-center justify-center gap-2 rounded-none rounded-br-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-blue-700 active:scale-95"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                  // Immediate state update for input responsiveness
                  setNewFolderName(val);
                  // Validation update can be batched (memoized anyway)
                  const error = folderNameError(val);
                  setFolderErrorPopup(error);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && isFolderNameValid && !isCreatingFolder) {
                    e.preventDefault();
                    handleCreateFolder();
                  }
                  if (e.key === 'Escape' && !isCreatingFolder) {
                    e.preventDefault();
                    setCreatingFolder(false);
                    setNewFolderName('');
                    setFolderErrorPopup(null);
                  }
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
          onMove={async (targetFolderId) => {
            if (onFileMove && moveFileTarget) {
              try {
                await onFileMove(moveFileTarget, targetFolderId);
              } catch (error) {
                console.error('Move failed:', error);
                // Error handling is done in the parent onFileMove function
              }
            }
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