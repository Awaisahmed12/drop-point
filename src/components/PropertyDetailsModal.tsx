import { logger } from '../utils/logger';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useInternalDrag } from '../hooks/useInternalDrag';
import { tryWithToast } from '../utils/tryWithToast';
import type { Property, PropertyFile, PropertyFolder, PendingUpload, SortField, SortDirection } from '../../types';
import type { PropertyWithFileCount } from '../../types';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { formatDate, formatFileSize, splitFileNameAndExt, getFileNameWithoutExtension } from '../../utils/fileManagement';
import { getFileSignedUrl } from '../utils/supabaseClient';
import { FolderIcon as HeroFolderIcon } from '@heroicons/react/24/solid';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

// Everything written into a viewer tab is escaped: the tab shares this
// app's origin, so unescaped file names or text content would run as HTML.
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

const VIEWER_CSS = `
  body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  .header { background: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
  .filename { font-weight: 600; color: #333; }
  .download-btn { background: #007bff; color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; font-size: 14px; }
  .download-btn:hover { background: #0056b3; }
  iframe { width: 100%; height: calc(100vh - 50px); border: none; }
  .content { padding: 20px; font-family: Menlo, Monaco, monospace; white-space: pre-wrap; line-height: 1.5; background: #f8f9fa; margin: 0; }
  .table-container { padding: 20px; overflow: auto; }
  table { border-collapse: collapse; width: 100%; background: white; font-size: 12px; }
  th, td { border: 1px solid #d0d7de; padding: 4px 8px; text-align: left; vertical-align: top; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
  th { background: #f6f8fa; font-weight: 600; position: sticky; top: 0; }
  tr:nth-child(even) { background: #f6f8fa; }
  td:hover { white-space: normal; max-width: none; }
`;

/** Fill a blank tab with a titled, escaped viewer page. */
function writeViewer(win: Window, title: string, downloadUrl: string, body: string) {
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${VIEWER_CSS}</style></head>` +
    `<body><div class="header"><span class="filename">${escapeHtml(title)}</span>` +
    `<a class="download-btn" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a></div>${body}</body></html>`,
  );
  win.document.close();
}

/** Minimal CSV split: one row per non-blank line, comma-separated, quotes stripped. */
function parseCsv(content: string): string[][] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));
}

function renderCsvTable(content: string): string {
  const [headers = [], ...rows] = parseCsv(content);
  const th = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const tr = rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-container"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

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
  
  // File operations. Rename and folder creation may throw; the modal turns
  // the error into an inline message.
  onFileUpload: (files: FileList) => Promise<void>;
  onFileDelete: (file: PropertyFile) => void;
  onFileRename: (item: PropertyFile | PropertyFolder, newName: string) => Promise<void> | void;
  onFileMove?: (file: PropertyFile, targetFolderId: string | null) => Promise<void>;
  onFileCopy?: (file: PropertyFile) => Promise<void>;
  onFolderCreate: (name: string) => Promise<void> | void;
  onFolderDelete: (folder: PropertyFolder) => void;
  
  // Pending uploads
  pendingUploads: PendingUpload[];
  onDismiss: (uploadId: string) => void;
  
  // Property switching
  onPropertySwitch?: (property: PropertyWithFileCount, files: PropertyFile[], folders: PropertyFolder[]) => void;
  onMapMove?: (lat: number, lng: number) => void;
  /** Rename the open property (null clears the custom name). */
  onPropertyRename?: (property: Property, label: string | null) => Promise<void>;
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
  onFileCopy,
  onFolderCreate,
  onFolderDelete,
  pendingUploads,
  onDismiss,
  onPropertySwitch,
  onMapMove,
  onPropertyRename,
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; file: PropertyFile } | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [renamingProperty, setRenamingProperty] = useState(false);
  const [propertyLabelDraft, setPropertyLabelDraft] = useState('');
  const renameCancelledRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Internal drag state for moving files between folders. Distinct from the
  // dragDepthRef-based external upload overlay above: this tracks "a file
  // row is being dragged within the app", which uses a custom MIME so the
  // two flows don't collide. Spring-loaded folders auto-open after 600ms
  // of hover so the user can drill into nested folders without releasing.
  const internalDrag = useInternalDrag();

  // Shared loader for the image preview overlay (keyboard nav + prev/next
  // buttons all called this same pattern silently). Surfaces a toast if
  // the signed-URL fetch fails so the user isn't left wondering why
  // ArrowRight did nothing.
  const loadImagePreview = useCallback(async (file: PropertyFile) => {
    await tryWithToast(
      async () => {
        const url = await getFileSignedUrl(file.property_id, file.file_name, false);
        setImagePreview({ url, file });
      },
      {
        showToast,
        errorMessage: `Couldn't load "${file.file_name}".`,
        tag: 'ImagePreview',
      },
    );
  }, [showToast]);
  // Drag depth counter. dragenter/dragleave fire in pairs as the cursor crosses
  // child boundaries, and the "contains(relatedTarget)" guard breaks when
  // relatedTarget is null (window blur, dragging out of frame, browser DnD
  // quirks). Counting balanced enter/leave events is the robust pattern: we
  // only clear isDragOver when the count drops back to 0.
  const dragDepthRef = useRef(0);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, []);

  const closeMenus = useCallback(() => {
    setFileMenuId(null);
    setFolderMenuId(null);
    setFabOpen(false);
  }, []);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // preventDefault on dragover is what tells the browser this is a valid
    // drop target. Without it, the OS shows the "not allowed" cursor and
    // drop never fires.
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDragState();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      // Previously a silent .catch(logger.error) — user saw nothing if the
      // upload failed. tryWithToast surfaces the failure visibly.
      await tryWithToast(() => onFileUpload(droppedFiles), {
        showToast,
        errorMessage: droppedFiles.length === 1
          ? `Failed to upload "${droppedFiles[0].name}".`
          : `Failed to upload ${droppedFiles.length} files.`,
        tag: 'DragDropUpload',
      });
    }
  }, [onFileUpload, resetDragState, showToast]);

  // Window-level safety net: if the drag is cancelled outside our container
  // (Escape, drop on another window, tab switch), browsers may not fire a
  // matching dragleave for every dragenter and the overlay would stick open.
  // dragend on the drag source + a body-level drop guarantee we reset.
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalEnd = () => resetDragState();
    window.addEventListener('dragend', handleGlobalEnd);
    window.addEventListener('drop', handleGlobalEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalEnd);
      window.removeEventListener('drop', handleGlobalEnd);
    };
  }, [isOpen, resetDragState]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && imagePreview) {
        setImagePreview(null);
      }
      if (imagePreview && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const imageFiles = files.filter(f => IMAGE_EXTENSIONS.has(f.file_name.split('.').pop()?.toLowerCase() || ''));
        const idx = imageFiles.findIndex(f => f.id === imagePreview.file.id);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < imageFiles.length) {
          void loadImagePreview(imageFiles[nextIdx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, imagePreview, files, loadImagePreview]);
  
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
  const { isMobile } = useMobileViewport();

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
    onError: (error) => {
      logger.error('Property switch error:', error);
      showToast('Could not switch property. Please try again.');
    },
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

  // One handler for every kebab button (list/grid, file/folder). Click and
  // touchend both route here so a tap never fires twice.
  const menuTriggerProps = (kind: 'file' | 'folder', id: string) => {
    const toggle = (e: React.SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const wasOpen = (kind === 'file' ? fileMenuId : folderMenuId) === id;
      closeMenus();
      if (wasOpen) return;
      (kind === 'file' ? setFileMenuId : setFolderMenuId)(id);
      calculateMenuPosition(e.currentTarget, id);
    };
    return { onClick: toggle, onTouchEnd: toggle };
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
  const headerHeight = useResponsiveValue('h-28', 'h-32');
  const tableHeaderPadding = useResponsiveValue('py-3', 'py-2');
  const listItemPadding = useResponsiveValue('px-4 py-2.5', 'px-3 py-3');
  const listIconSize = useResponsiveValue(32, 28);
  const listRenameVariant = useResponsiveValue<'full' | 'simple'>('full', 'simple');
  const gridIconSize = useResponsiveValue(48, 56);
  // Grid-view menu trigger lives on top of a thumbnail card so a 44px hit
  // area would cover too much of the artwork. 36px is the largest size that
  // still respects card padding while getting closer to the WCAG minimum.
  // A long-press gesture on the card body is the proper fix and is tracked
  // alongside multi-select (out of scope for this pass).
  const gridMenuButtonSize = '30px';

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
    // Inline validation (folderErrorPopup) is set on input change, and the
    // submit button is disabled when !isFolderNameValid, so by the time we
    // get here the name is structurally valid. The input is also disabled
    // while isCreatingFolder is true (see render), so the "stale validation
    // captured at click time" concern doesn't apply — the user can't edit
    // the name mid-submission.
    if (!isFolderNameValid || isCreatingFolder) return;

    setIsCreatingFolder(true);
    try {
      await onFolderCreate(newFolderName.trim());
      setCreatingFolder(false);
      setNewFolderName('');
      setFolderErrorPopup(null);
    } catch (error) {
      // FolderService throws DUPLICATE_FOLDER on unique-constraint hits;
      // distinguish it from a generic failure so the user knows to pick a
      // different name rather than just "retry".
      const message = error instanceof Error ? error.message : '';
      const isDuplicate = message === 'DUPLICATE_FOLDER' || /duplicate|unique|already exists/i.test(message);
      setFolderErrorPopup(
        isDuplicate
          ? `A folder named "${newFolderName.trim()}" already exists here.`
          : 'Failed to create folder. Please try again.'
      );
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
      // Surface a useful message — the previous silent console.error
      // looked identical to "rename succeeded" from the user's POV.
      // FolderService throws DUPLICATE_FOLDER for unique-constraint hits.
      const message = error instanceof Error ? error.message : '';
      const isDuplicate = message === 'DUPLICATE_FOLDER' || /duplicate|unique|already exists/i.test(message);
      const kind = 'file_name' in item ? 'file' : 'folder';
      showToast(
        isDuplicate
          ? `A ${kind} named "${newName}" already exists here.`
          : `Couldn't rename ${kind}. Please try again.`
      );
      logger.error('Rename failed:', error);
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

  // Open a file the way the device expects: an in-app viewer on mobile, a
  // lightbox for images on desktop, otherwise a new tab.
  const openFileInline = async (file: PropertyFile) => {
    try {
      const [fileUrl, downloadUrl] = await Promise.all([
        getFileSignedUrl(file.property_id, file.file_name, false),
        getFileSignedUrl(file.property_id, file.file_name, true),
      ]);
      const ext = file.file_name.split('.').pop()?.toLowerCase() || '';

      if (isMobile) {
        if (IMAGE_EXTENSIONS.has(ext) || ext === 'pdf') {
          setMobileFileViewer({ isOpen: true, file, fileUrl, downloadUrl });
        } else if (ext === 'txt' || ext === 'csv') {
          try {
            const content = await (await fetch(fileUrl)).text();
            setMobileFileViewer({ isOpen: true, file, fileUrl, downloadUrl, content });
          } catch {
            window.location.href = downloadUrl;
          }
        } else {
          window.location.href = fileUrl;
        }
        return;
      }

      if (IMAGE_EXTENSIONS.has(ext)) {
        setImagePreview({ url: fileUrl, file });
        return;
      }

      // Open the tab synchronously so pop-up blockers treat it as user-initiated.
      const viewer = window.open('', '_blank');
      if (!viewer) {
        showToast('Pop-up blocked. Allow pop-ups to preview files.', 'warning');
        return;
      }

      if (ext === 'pdf') {
        writeViewer(viewer, file.file_name, downloadUrl, `<iframe src="${escapeHtml(fileUrl)}" type="application/pdf"></iframe>`);
      } else if (OFFICE_EXTENSIONS.has(ext)) {
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        writeViewer(viewer, file.file_name, downloadUrl, `<iframe src="${escapeHtml(viewerUrl)}"></iframe>`);
      } else if (ext === 'csv' || ext === 'txt') {
        try {
          const content = await (await fetch(fileUrl)).text();
          const body = ext === 'csv' ? renderCsvTable(content) : `<pre class="content">${escapeHtml(content)}</pre>`;
          writeViewer(viewer, file.file_name, downloadUrl, body);
        } catch {
          viewer.location.href = fileUrl;
        }
      } else {
        viewer.location.href = fileUrl;
      }
    } catch (error) {
      logger.error('Error getting file URL:', error);
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
          {IMAGE_EXTENSIONS.has(fileExtension || '') ? (
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
                  const [headers = [], ...rows] = parseCsv(mobileFileViewer.content);

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

  const toggleViewMode = () => setViewMode(viewMode === 'list' ? 'grid' : 'list');

  const closeSheet = () => {
    onClose();
    setCreatingFolder(false);
    setSearchQuery('');
    setRenamingProperty(false);
  };

  const cancelCreateFolder = () => {
    setCreatingFolder(false);
    setNewFolderName('');
    setFolderErrorPopup(null);
  };

  const commitPropertyRename = async () => {
    setRenamingProperty(false);
    const label = propertyLabelDraft.trim() || null;
    if (!onPropertyRename || label === (property.label ?? null)) return;
    try {
      await onPropertyRename(property, label);
      showToast(label ? 'Renamed' : 'Name removed', 'success');
    } catch (error) {
      logger.error('Rename property failed:', error);
      showToast('Couldn’t rename this property. Please try again.');
    }
  };

  const headerSubtitle = showRealAddress
    ? [streetAddress, locationInfo].filter(Boolean).join(', ')
    : locationInfo;

  // Everything that isn't browsing files lives behind one "more" control.
  const moreGroups: ActionSheetItem[][] = [
    [
      { label: 'Switch property', onSelect: () => setSwitcherOpen(true) },
      { label: viewMode === 'list' ? 'Show as grid' : 'Show as list', onSelect: toggleViewMode },
    ],
    [
      ...(onPropertyRename
        ? [{
            label: property.label ? 'Rename' : 'Add a name',
            onSelect: () => { setPropertyLabelDraft(property.label || ''); setRenamingProperty(true); },
          }]
        : []),
      {
        label: 'Copy address',
        onSelect: () =>
          navigator.clipboard.writeText(property.address)
            .then(() => showToast('Address copied', 'success'))
            .catch(() => showToast('Couldn’t copy the address.')),
      },
    ],
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
      onTouchMove={(e) => {
        // Prevent the map behind from scrolling when touching the backdrop
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div
        className="ios-sheet w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl sm:rounded-[16px] flex flex-col relative overflow-hidden animate-sheet-up"
        style={isMobile ? { height: 'calc(100dvh - var(--safe-top) - 10px)' } : { height: '88vh', maxHeight: '88vh' }}
      >
        
        {isMobile && <div className="ios-grabber" />}
        {/* Nav bar: close, title, and the one place for everything else. */}
        <div className="ios-navbar border-b border-hairline/60 flex-shrink-0">
          <button type="button" className="ios-close" onClick={closeSheet} aria-label="Close">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="min-w-0 text-center px-1">
            {renamingProperty ? (
              <input
                autoFocus
                value={propertyLabelDraft}
                onChange={e => setPropertyLabelDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { renameCancelledRef.current = true; e.currentTarget.blur(); }
                }}
                onBlur={() => {
                  const cancelled = renameCancelledRef.current;
                  renameCancelledRef.current = false;
                  if (cancelled) setRenamingProperty(false);
                  else void commitPropertyRename();
                }}
                placeholder={streetAddress || 'Property name'}
                aria-label="Property name"
                className="w-full text-center text-headline font-semibold bg-surface-2 rounded-lg px-2 py-1 focus:outline-none"
              />
            ) : (
              <>
                <h1 className="text-headline font-semibold truncate" title={displayName}>{displayName}</h1>
                {headerSubtitle && <p className="text-caption text-ink-2 truncate" title={headerSubtitle}>{headerSubtitle}</p>}
              </>
            )}
          </div>
          <button
            type="button"
            className="ios-close justify-self-end"
            onClick={() => setMoreOpen(true)}
            aria-label="More actions"
            aria-haspopup="dialog"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        {/* Main Content Area */}
        <div
          className="flex-1 flex flex-col overflow-hidden relative"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-accent-soft/95 border-2 border-dashed border-accent rounded-xl pointer-events-none">
              <svg className="w-14 h-14 text-accent mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-headline font-semibold text-accent">Drop to upload</p>
              <p className="text-subhead text-accent/80 mt-1">Files will be added to the current folder</p>
            </div>
          )}
          {/* File List Container - Scrollable with satellite image first, then all other content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden file-list mobile-scroll" style={{
            minHeight: '200px',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}>
            {/* Property preview: Street View, Satellite Map, or no image based on configuration */}
            {propertyImageEnabled && (
              streetViewEnabled ? (
                <div className={`relative w-full ${headerHeight} bg-surface-2 border-b border-hairline/60 flex-shrink-0`}>
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
                <div className={`relative w-full ${headerHeight} bg-surface-2 border-b border-hairline/60 flex-shrink-0`}>
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
            <div className="bg-surface sticky top-0 z-50 border-b border-hairline/60">
              {/* Breadcrumbs - compact unified bar */}
              {(breadcrumbPath.length > 0 || selectedFolder !== 'master') && (
                <div className="px-4 py-2 bg-surface border-b border-hairline/60">
                  <div className="flex items-center gap-2 text-footnote text-ink overflow-x-auto">
                    {selectedFolder !== 'master' && (() => {
                      // Resolve the parent of the currently-selected folder so the
                      // back button can both navigate (click) and be a drop target
                      // for moving a dragged file up one level.
                      const currentFolder = folders.find(f => f.id === selectedFolder);
                      const parentId = currentFolder?.parent_id || null;
                      const targetFolderId = parentId; // null = master / root
                      return (
                        <button
                          {...internalDrag.getDropTargetProps({
                            id: 'breadcrumb-back',
                            canAccept: internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.sourceFolderId !== targetFolderId,
                            // Spring-back: hovering the Back button mid-drag pops up
                            // one level so the user can drop into a sibling folder.
                            spring: () => { setSearchQuery(''); onFolderChange(parentId || 'master'); },
                            onDrop: (item) => {
                              if (item.kind !== 'file' || !onFileMove) return;
                              void onFileMove(item.file, targetFolderId);
                            },
                          })}
                          className={`flex items-center gap-1 text-accent font-medium ${
                            internalDrag.activeTargetId === 'breadcrumb-back' ? 'ring-2 ring-accent rounded bg-accent-soft px-1' : ''
                          }`}
                          onClick={() => {
                            setSearchQuery('');
                            onFolderChange(parentId || 'master');
                          }}
                          aria-label="Back"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                      );
                    })()}
                    <button
                      {...internalDrag.getDropTargetProps({
                        id: 'breadcrumb-home',
                        // Master = null folder_id. Don't accept if already at root.
                        canAccept: internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.sourceFolderId !== null,
                        spring: () => { setSearchQuery(''); onFolderChange('master'); },
                        onDrop: (item) => {
                          if (item.kind !== 'file' || !onFileMove) return;
                          void onFileMove(item.file, null);
                        },
                      })}
                      className={`text-ink-2 flex items-center gap-1 flex-shrink-0 ${
                        internalDrag.activeTargetId === 'breadcrumb-home' ? 'ring-2 ring-accent rounded bg-accent-soft px-1' : ''
                      }`}
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
                        <span className="text-ink-3">›</span>
                        <button
                          {...internalDrag.getDropTargetProps({
                            id: `breadcrumb-${folder.id}`,
                            canAccept: internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.sourceFolderId !== folder.id,
                            spring: () => { setSearchQuery(''); onFolderChange(folder.id); },
                            onDrop: (item) => {
                              if (item.kind !== 'file' || !onFileMove) return;
                              void onFileMove(item.file, folder.id);
                            },
                          })}
                          className={`text-accent font-medium whitespace-nowrap ${
                            internalDrag.activeTargetId === `breadcrumb-${folder.id}` ? 'ring-2 ring-accent rounded bg-accent-soft px-1' : ''
                          }`}
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
              <div className={`px-4 ${breadcrumbPath.length > 0 ? 'py-2.5' : 'py-3'} sm:py-3 bg-white`} style={{
                // Ensure search bar is always above mobile browser chrome
                position: 'sticky',
                top: breadcrumbPath.length > 0 ? '0' : '0',
                zIndex: 60, // Higher z-index to ensure it stays above everything
              }}>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ios-search"
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-ink-3 text-white flex items-center justify-center"
                      aria-label="Clear search"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Column Headers - Sticky and always visible */}
              <div className={`hidden sm:grid grid-cols-12 gap-4 px-3 ${tableHeaderPadding} text-footnote border-b border-hairline/60 bg-surface ${viewMode === 'grid' ? 'sm:hidden' : ''}`}>
                <button
                  className="col-span-7 flex items-center gap-1 text-footnote font-medium text-ink-2"
                  onClick={() => toggleSort('name')}
                >
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  className="col-span-3 flex items-center gap-1 text-footnote font-medium text-ink-2"
                  onClick={() => toggleSort('date')}
                >
                  Modified {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  className="col-span-2 flex items-center justify-end gap-1 text-footnote font-medium text-ink-2"
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
                {sortedItems.length === 0 && !searchQuery && (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    {selectedFolder === 'master' ? (
                      <>
                        <svg className="w-12 h-12 text-ink-3 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="text-subhead font-medium text-ink-2">No files yet</p>
                        <p className="text-footnote text-ink-2 mt-1">Upload files or create folders to get started</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-12 h-12 text-ink-3 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        <p className="text-subhead font-medium text-ink-2">This folder is empty</p>
                        <p className="text-footnote text-ink-2 mt-1">Upload files to add them here</p>
                      </>
                    )}
                  </div>
                )}
                {sortedItems.length === 0 && searchQuery && (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <svg className="w-12 h-12 text-ink-3 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <p className="text-subhead font-medium text-ink-2">No results for &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-footnote text-ink-2 mt-1">Try a different name or check your spelling</p>
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
                              {...internalDrag.getDropTargetProps({
                                id: `folder-list-${folder.id}`,
                                // Don't accept a drop FROM this folder back INTO this folder.
                                canAccept: internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.sourceFolderId !== folder.id,
                                // Spring: descend into the folder after the hover delay so the user
                                // can keep dragging into nested folders without releasing.
                                spring: () => { setSearchQuery(''); onFolderChange(folder.id); },
                                onDrop: (item) => {
                                  if (item.kind !== 'file' || !onFileMove) return;
                                  void onFileMove(item.file, folder.id);
                                },
                              })}
                              className={`flex sm:grid sm:grid-cols-12 sm:gap-4 items-center ${listItemPadding} sm:px-3 sm:py-2 min-h-[48px] sm:min-h-[40px] active:bg-surface-2 rounded-lg mb-0.5 ${
                                internalDrag.activeTargetId === `folder-list-${folder.id}` ? 'ring-2 ring-accent bg-accent-soft' : ''
                              }`}
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
                                      <div className="text-body font-medium truncate">
                                        {folder.name}
                                      </div>
                                      <div className="text-footnote text-ink-2 mt-0.5 flex items-center gap-2 sm:hidden">
                                        <span>{formatDate(folder.created_at)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="hidden sm:block sm:col-span-3 text-footnote text-ink-2">
                                {formatDate(folder.created_at)}
                              </div>
                              <div className="relative flex items-center justify-end sm:col-span-2">
                                <button
                                  className="tap-target rounded ml-2 flex items-center justify-center flex-shrink-0"
                                  {...menuTriggerProps('folder', folder.id)}
                                  title="Folder actions"
                                >
                                  <svg className="w-5 h-5 sm:w-4 sm:h-4 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                                  presentation={isMobile ? 'sheet' : 'popover'}
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
                              {...internalDrag.getDragSourceProps({
                                kind: 'file',
                                file,
                                sourceFolderId: file.folder_id,
                              })}
                              className={`flex sm:grid sm:grid-cols-12 sm:gap-4 items-center ${listItemPadding} sm:px-3 sm:py-2 min-h-[48px] sm:min-h-[40px] active:bg-surface-2 rounded-lg mb-0.5 ${
                                internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.file.id === file.id ? 'opacity-40' : ''
                              }`}
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
                                  logger.error('Error opening file:', error);
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
                                      <span className="text-body font-medium truncate">
                                        {getFileNameWithoutExtension(file.file_name)}
                                      </span>
                                      <div className="text-footnote text-ink-2 mt-0.5 flex items-center gap-2 sm:hidden">
                                        <span>{formatDate(file.modified_at || file.uploaded_at)}</span>
                                        <span>•</span>
                                        <span>{formatFileSize(file.file_size)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="hidden sm:block sm:col-span-3 text-footnote text-ink-2">
                                {formatDate(file.modified_at || file.uploaded_at)}
                              </div>
                              <div className="relative flex items-center justify-end sm:col-span-2">
                                <span className="hidden sm:inline-block text-footnote text-ink-2 mr-2">{formatFileSize(file.file_size)}</span>
                                <button
                                  className="tap-target rounded ml-2 flex items-center justify-center flex-shrink-0"
                                  {...menuTriggerProps('file', file.id)}
                                  title="File actions"
                                >
                                  <svg className="w-5 h-5 sm:w-4 sm:h-4 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                                  onDuplicate={onFileCopy}
                                  onDelete={onFileDelete}
                                  menuPosition={menuPosition[file.id] || {}}
                                  menuRef={fileMenuRef}
                                  presentation={isMobile ? 'sheet' : 'popover'}
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
                              {...internalDrag.getDropTargetProps({
                                id: `folder-grid-${folder.id}`,
                                canAccept: internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.sourceFolderId !== folder.id,
                                spring: () => { setSearchQuery(''); onFolderChange(folder.id); },
                                onDrop: (item) => {
                                  if (item.kind !== 'file' || !onFileMove) return;
                                  void onFileMove(item.file, folder.id);
                                },
                              })}
                              className={`flex flex-col items-center p-3 rounded-xl active:bg-surface-2 active:scale-[0.97] transition-transform group relative ${
                                internalDrag.activeTargetId === `folder-grid-${folder.id}` ? 'ring-2 ring-accent bg-accent-soft' : ''
                              }`}
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
                                  className="absolute -top-2 -right-4 rounded-full bg-surface-2/90 text-ink-2 flex items-center justify-center touch-manipulation"
                                  {...menuTriggerProps('folder', folder.id)}
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
                                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-ink" fill="currentColor" viewBox="0 0 24 24">
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
                                  presentation={isMobile ? 'sheet' : 'popover'}
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
                                    <div className="font-medium text-ink truncate text-caption sm:text-footnote leading-tight">
                                      {folder.name}
                                    </div>
                                    <div className="text-caption text-ink-2 mt-0.5">
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
                              {...internalDrag.getDragSourceProps({
                                kind: 'file',
                                file,
                                sourceFolderId: file.folder_id,
                              })}
                              className={`flex flex-col items-center p-3 rounded-xl active:bg-surface-2 active:scale-[0.97] transition-transform group relative ${
                                internalDrag.draggedItem?.kind === 'file' && internalDrag.draggedItem.file.id === file.id ? 'opacity-40' : ''
                              }`}
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
                                  logger.error('Error opening file:', error);
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
                                  className="absolute -top-2 -right-4 rounded-full bg-surface-2/90 text-ink-2 flex items-center justify-center touch-manipulation"
                                  {...menuTriggerProps('file', file.id)}
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
                                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-ink" fill="currentColor" viewBox="0 0 24 24">
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
                                  onDuplicate={onFileCopy}
                                  onDelete={onFileDelete}
                                  menuPosition={menuPosition[file.id] || {}}
                                  menuRef={fileMenuRef}
                                  presentation={isMobile ? 'sheet' : 'popover'}
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
                                    <div className="font-medium text-ink truncate text-caption sm:text-footnote leading-tight">
                                      {getFileNameWithoutExtension(file.file_name)}
                                    </div>
                                    <div className="text-caption text-ink-2 mt-0.5 space-y-0.5">
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
              logger.error('File upload error:', error);
              // You could add a toast notification here
            }
          }
        }} multiple />

        {/* Upload Progress Toasts - Apple-inspired design */}
        {pendingUploads.length > 0 && (
          <div className="fixed z-[9999] left-4 right-4 sm:left-auto sm:right-4 sm:w-96" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
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

        {/* One "+" offering the two ways to add something. */}
        <div
          className="absolute z-30"
          style={{ bottom: 'calc(var(--safe-bottom) + 16px)', right: '16px' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-[52px] h-[52px] rounded-full bg-accent text-white flex items-center justify-center ios-press"
            style={{ boxShadow: '0 4px 16px rgba(10, 122, 255, 0.4)' }}
            onClick={() => setFabOpen(true)}
            aria-label="Add files or a folder"
            aria-haspopup="dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <ActionSheet
          open={fabOpen}
          onClose={() => setFabOpen(false)}
          title={selectedFolder === 'master' ? 'Add to this property' : `Add to “${folders.find(f => f.id === selectedFolder)?.name ?? 'folder'}”`}
          groups={[[
            { label: 'Upload files', onSelect: () => document.getElementById('file-upload-input')?.click() },
            { label: 'New folder', onSelect: () => setCreatingFolder(true) },
          ]]}
        />

        {/* Image Lightbox */}
        {imagePreview && (
          <div
            className="fixed inset-0 z-[999999] bg-black/92 flex flex-col items-center justify-center"
            onClick={() => setImagePreview(null)}
            onTouchEnd={e => { e.preventDefault(); setImagePreview(null); }}
          >
            {/* Close */}
            <button
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:bg-white/30 transition-colors"
              onClick={e => { e.stopPropagation(); setImagePreview(null); }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview.url}
              alt={imagePreview.file.file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
            />
            {/* Caption */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1 px-4">
              <p className="text-white/90 text-sm font-medium text-center">{imagePreview.file.file_name}</p>
              <p className="text-white/50 text-xs">{formatFileSize(imagePreview.file.file_size)}</p>
            </div>
            {/* Navigation arrows
              * Render the buttons unconditionally and disable them at the
              * boundaries. Previously the buttons were removed at the edges,
              * but the keyboard arrow-key handler also silently no-oped, so
              * the user had no feedback that they were at the first/last
              * image. Visible-but-disabled gives both pointer and keyboard
              * users a clear "end of the line" indicator.
              */}
            {(() => {
              const imageFiles = files.filter(f => IMAGE_EXTENSIONS.has(f.file_name.split('.').pop()?.toLowerCase() || ''));
              const idx = imageFiles.findIndex(f => f.id === imagePreview.file.id);
              const hasPrev = idx > 0;
              const hasNext = idx >= 0 && idx < imageFiles.length - 1;
              const navButtonBase = 'absolute top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-white transition-all';
              const navButtonEnabled = 'bg-white/10 hover:bg-white/20 active:bg-white/30';
              const navButtonDisabled = 'bg-white/5 text-white/30 cursor-not-allowed';
              return (
                <>
                  <button
                    className={`${navButtonBase} left-3 ${hasPrev ? navButtonEnabled : navButtonDisabled}`}
                    disabled={!hasPrev}
                    aria-label={hasPrev ? 'Previous image' : 'No previous image'}
                    aria-keyshortcuts="ArrowLeft"
                    onClick={e => {
                      e.stopPropagation();
                      if (!hasPrev) return;
                      void loadImagePreview(imageFiles[idx - 1]);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    className={`${navButtonBase} right-3 ${hasNext ? navButtonEnabled : navButtonDisabled}`}
                    disabled={!hasNext}
                    aria-label={hasNext ? 'Next image' : 'No next image'}
                    aria-keyshortcuts="ArrowRight"
                    onClick={e => {
                      e.stopPropagation();
                      if (!hasNext) return;
                      void loadImagePreview(imageFiles[idx + 1]);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* New folder: an alert with a single field. */}
        {creatingFolder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
            onClick={cancelCreateFolder}
            onTouchEnd={e => { e.preventDefault(); cancelCreateFolder(); }}
          >
            <div
              className="bg-surface/95 backdrop-blur-xl rounded-[14px] w-[270px] overflow-hidden animate-sheet-up"
              role="dialog"
              aria-modal="true"
              aria-label="New folder"
              onClick={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
            >
              <div className="px-4 pt-5 pb-3 text-center">
                <div className="text-headline font-semibold">New folder</div>
                <div className="text-footnote text-ink-2 mt-1">Enter a name for this folder.</div>
                <input
                  ref={folderInputRef}
                  type="text"
                  className="mt-3 w-full h-8 rounded-md border border-hairline bg-surface px-2 text-subhead text-ink focus:outline-none focus:border-accent"
                  placeholder="Name"
                  value={newFolderName}
                  onChange={e => {
                    if (isCreatingFolder) return;
                    setNewFolderName(e.target.value);
                    setFolderErrorPopup(folderNameError(e.target.value));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && isFolderNameValid && !isCreatingFolder) {
                      e.preventDefault();
                      handleCreateFolder();
                    }
                    if (e.key === 'Escape' && !isCreatingFolder) {
                      e.preventDefault();
                      cancelCreateFolder();
                    }
                  }}
                  autoFocus
                  disabled={isCreatingFolder}
                  aria-invalid={Boolean(folderErrorPopup)}
                />
                {folderErrorPopup && (
                  <div className="text-caption text-danger mt-2" role="alert">{folderErrorPopup}</div>
                )}
              </div>
              <div className="grid grid-cols-2 border-t border-hairline/60 divide-x divide-hairline/60">
                <button type="button" className="h-11 text-body text-accent ios-press" onClick={cancelCreateFolder} disabled={isCreatingFolder}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-11 text-body font-semibold text-accent ios-press disabled:opacity-40"
                  onClick={handleCreateFolder}
                  disabled={!isFolderNameValid || isCreatingFolder}
                >
                  {isCreatingFolder ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ActionSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={property.address} groups={moreGroups} />
      {currentPropertyWithFileCount && (
        <PropertySwitcher
          currentProperty={currentPropertyWithFileCount}
          onPropertySelect={switchToProperty}
          open={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

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
                logger.error('Move failed:', error);
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
