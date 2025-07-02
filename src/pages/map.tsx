import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

import { supabase } from '../utils/supabaseClient';
import { GoogleMap, LoadScript } from '@react-google-maps/api';

import type { Prediction, Property, PropertyFile, PropertyFolder, PendingUpload } from '../../types';
import { 
  containerStyle, 
  US_CENTER, 
  GOOGLE_MAPS_API_KEY, 
  GOOGLE_MAP_LIBRARIES, 
  DEFAULT_ZOOM, 
  SEARCH_ZOOM, 
  MAP_TYPE_KEY, 
  DEFAULT_MAP_TYPE 
} from '../../constants';
import { 
  getAddressFromCache, 
  saveAddressToCache
} from '../../utils/propertyCache';
import { MapSearch } from '../components/MapSearch';
import { MapControls } from '../components/MapControls';
import { PropertyInfoCard } from '../components/PropertyInfoCard';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';

import { MoveModal } from '../components/MoveModal';
import { getUniqueFileName, sanitizeFileName } from '../../utils/fileManagement';

// Constants moved to constants/index.ts

// Types moved to types/index.ts

// Duplicate components removed - now using extracted components

// Row component moved to PropertyDetailsModal

export default function MapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState(US_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState<string>(DEFAULT_MAP_TYPE);
  const [address, setAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const justSelectedRef = useRef(false);

  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);

  // Add state for uploaded files
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);

  // Will be used for property save-on-upload logic
  const [snappedLatLng, setSnappedLatLng] = useState<{lat: number, lng: number} | null>(null);

  // Custom autocomplete state (used by internal search handling)
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);



  // Replace folders state with backend-driven state
  const [folders, setFolders] = useState<PropertyFolder[]>([]);

  // Add state for folders and folder selection (move above all usages)
  const [selectedFolder, setSelectedFolder] = useState('master');

  // Folder validation moved to PropertyDetailsModal

  // Add state for pending uploads
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  // Add ref for menu click outside
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);

  // Add state for renaming files
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);

  // Add state for move modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFileTarget, setMoveFileTarget] = useState<PropertyFile | null>(null);

  // Sorting moved to PropertyDetailsModal

  // Add loading states
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);

  // Add these near the top of the MapPage component, with other state declarations
  // Cache for property data
  const [propertyCache, setPropertyCache] = useState<Record<string, {
    files: PropertyFile[];
    folders: PropertyFolder[];
    lastFetched: number;
  }>>({});

  // Cache timeout in milliseconds (5 minutes)
  const CACHE_TIMEOUT = 5 * 60 * 1000;

  // Address caching moved to utils/propertyCache.ts

  // Cache functions moved to utils/propertyCache.ts

  // Quick check if property exists
  const checkPropertyExists = async (address: string): Promise<boolean> => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return false;

    // First check cache
    const cacheKey = `${user.data.user.id}-${address}`;
    const cached = propertyCache[cacheKey];
    if (cached && (Date.now() - cached.lastFetched) < CACHE_TIMEOUT) {
      return true;
    }

    // If not in cache, do a lightweight query
    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.data.user.id)
      .eq('address', address);
    
    return count ? count > 0 : false;
  };

  // Function to check if property data is cached and valid
  const isPropertyDataCached = useCallback(async (address: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const cacheKey = `${user.id}-${address}`;
    const cached = propertyCache[cacheKey];
    return cached && (Date.now() - cached.lastFetched) < CACHE_TIMEOUT;
  }, [propertyCache, CACHE_TIMEOUT]);

  // Function to cache property data
  const cachePropertyData = useCallback(async (address: string, files: PropertyFile[], folders: PropertyFolder[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cacheKey = `${user.id}-${address}`;
    setPropertyCache(prev => ({
      ...prev,
      [cacheKey]: {
        files,
        folders,
        lastFetched: Date.now()
      }
    }));
  }, []);

  // Function to get cached property data
  const getCachedPropertyData = useCallback(async (address: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const cacheKey = `${user.id}-${address}`;
    const cached = propertyCache[cacheKey];
    if (cached && (Date.now() - cached.lastFetched) < CACHE_TIMEOUT) {
      return cached;
    }
    return null;
  }, [propertyCache, CACHE_TIMEOUT]);

  // Auth guard
  useEffect(() => {
    const getUser = async () => {
      const result = await supabase.auth.getUser();
      if (!result.data.user) {
        router.replace('/');
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  // Try to get user's geolocation on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // If denied or unavailable, do nothing (fallback to US_CENTER)
        }
      );
    }
  }, []);

  // Fetch predictions as user types
  useEffect(() => {
    let active = true;
    if (inputValue && !justSelectedRef.current) {
      fetchPredictions(inputValue).then((results) => {
        if (active) {
          setPredictions(results);
        }
      });
    } else {
      setPredictions([]);
    }
    justSelectedRef.current = false;
    return () => {
      active = false;
    };
  }, [inputValue]);



  // Helper to compare coordinates with a small threshold
  function coordsChanged(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null) {
    if (!a || !b) return true;
    return Math.abs(a.lat - b.lat) > 0.00001 || Math.abs(a.lng - b.lng) > 0.00001;
  }

  // On dragend or zoom_changed, set hasInteracted and fetch address if center changed
  const handleUserInteraction = useCallback(async () => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        const coords = { lat: center.lat(), lng: center.lng() };
        if (coordsChanged(lastFetchedCenter.current, coords)) {
          lastFetchedCenter.current = coords;
          setHasInteracted(true);
          setInputValue('');
          
          // Check address cache first
          const cached = getAddressFromCache(coords.lat, coords.lng);
          if (cached) {
            setAddress(cached.address);
            setSnappedLatLng(cached.snappedLatLng);
            setAddressLoading(false);

            // Try to prefetch property data if this is a saved property
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: property } = await supabase
                .from('properties')
                .select('*')
                .eq('user_id', user.id)
                .eq('address', cached.address)
                .maybeSingle();

              if (property) {
                // Check if we already have this property's data cached
                const isCached = await isPropertyDataCached(cached.address);
                if (!isCached) {
                  // Start prefetching the property's files and folders
                  const [folderResult, filesResult] = await Promise.all([
                    supabase
                      .from('property_folders')
                      .select('*')
                      .eq('property_id', property.id)
                      .eq('user_id', user.id)
                      .is('deleted_at', null)
                      .order('created_at', { ascending: true }),
                    supabase
                      .from('property_files')
                      .select('*')
                      .eq('property_id', property.id)
                      .order('uploaded_at', { ascending: false })
                  ]);

                  if (folderResult.data && filesResult.data) {
                    await cachePropertyData(cached.address, filesResult.data, folderResult.data);
                  }
                }
              }
            }
          } else {
            fetchAddress(coords.lat, coords.lng);
          }
        }
      }
    }
  }, [map, isPropertyDataCached, cachePropertyData]);

  // Only listen for dragend and zoom_changed for user interaction
  useEffect(() => {
    if (map) {
      const dragendListener = map.addListener('dragend', handleUserInteraction);
      const zoomListener = map.addListener('zoom_changed', handleUserInteraction);
      return () => {
        if (dragendListener) dragendListener.remove();
        if (zoomListener) zoomListener.remove();
      };
    }
  }, [map, handleUserInteraction]);



  // Click outside handler removed - dropdown handled by MapSearch component

  // On mount, read map type from localStorage
  useEffect(() => {
    const storedType = typeof window !== 'undefined' ? localStorage.getItem(MAP_TYPE_KEY) : null;
    if (storedType === 'roadmap' || storedType === 'satellite') {
      setMapType(storedType);
    } else {
      setMapType(DEFAULT_MAP_TYPE);
    }
  }, []);

  // When mapType changes, save to localStorage and update map if loaded
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MAP_TYPE_KEY, mapType);
    }
    if (map) {
      map.setMapTypeId(mapType as google.maps.MapTypeId);
    }
  }, [mapType, map]);

  // Update fetchAddress to use cache
  const fetchAddress = async (lat: number, lng: number) => {
    // Check cache first
    const cached = getAddressFromCache(lat, lng);
    if (cached) {
      setAddress(cached.address);
      setSnappedLatLng(cached.snappedLatLng);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    setAddress('');
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.results && data.results[0]) {
        const address = data.results[0].formatted_address;
        const snapped = data.results[0].geometry.location;
        const snappedLatLng = { lat: snapped.lat, lng: snapped.lng };
        
        setAddress(address);
        setSnappedLatLng(snappedLatLng);
        
        // Save to cache
        saveAddressToCache(lat, lng, address, snappedLatLng);
      } else {
        setAddress('No address found');
        setSnappedLatLng(null);
        saveAddressToCache(lat, lng, 'No address found', null);
      }
    } catch {
      setAddress('Error fetching address');
      setSnappedLatLng(null);
      saveAddressToCache(lat, lng, 'Error fetching address', null);
    }
    setAddressLoading(false);
  };

  async function fetchPredictions(input: string): Promise<Prediction[]> {
    if (!input) return [];
    const url = `/api/autocomplete?query=${encodeURIComponent(input)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.predictions || [];
  }

  async function geocodePlaceId(placeId: string): Promise<{ lat: number; lng: number } | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  }

  // handleSearch removed - search handled by MapSearch component

  // Helper to select a prediction object
  const selectPredictionByPrediction = async (prediction: Prediction) => {
    if (!prediction) return;
    justSelectedRef.current = true;
    setInputValue(prediction.description);
    setPredictions([]);
    const loc = await geocodePlaceId(prediction.place_id);
    if (loc) {
      setMapCenter(loc);
      setZoom(SEARCH_ZOOM);
      setHasInteracted(true);
      lastFetchedCenter.current = loc;
      
      // First check if we have this address cached
      const cached = getAddressFromCache(loc.lat, loc.lng);
      if (cached) {
        setAddress(cached.address);
        setSnappedLatLng(cached.snappedLatLng);
        setAddressLoading(false);
        
        // Try to prefetch property data
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: property } = await supabase
            .from('properties')
            .select('*')
            .eq('user_id', user.id)
            .eq('address', cached.address)
            .maybeSingle();

          if (property) {
            // Check if we already have this property's data cached
            const isCached = await isPropertyDataCached(cached.address);
            if (!isCached) {
              // Start prefetching the property's files and folders
              const [folderResult, filesResult] = await Promise.all([
                supabase
                  .from('property_folders')
                  .select('*')
                  .eq('property_id', property.id)
                  .eq('user_id', user.id)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: true }),
                supabase
                  .from('property_files')
                  .select('*')
                  .eq('property_id', property.id)
                  .order('uploaded_at', { ascending: false })
              ]);

              if (folderResult.data && filesResult.data) {
                await cachePropertyData(cached.address, filesResult.data, folderResult.data);
              }
            }
          }
        }
      } else {
        // If not cached, fetch address and then try to prefetch property data
        const res = await fetch(`/api/reverse-geocode?lat=${loc.lat}&lng=${loc.lng}`);
        const data = await res.json();
        if (data.results && data.results[0]) {
          const address = data.results[0].formatted_address;
          const snapped = data.results[0].geometry.location;
          const snappedLatLng = { lat: snapped.lat, lng: snapped.lng };
          
          setAddress(address);
          setSnappedLatLng(snappedLatLng);
          saveAddressToCache(loc.lat, loc.lng, address, snappedLatLng);

          // Try to prefetch property data
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: property } = await supabase
              .from('properties')
              .select('*')
              .eq('user_id', user.id)
              .eq('address', address)
              .maybeSingle();

            if (property) {
              // Check if we already have this property's data cached
              const isCached = await isPropertyDataCached(address);
              if (!isCached) {
                // Start prefetching the property's files and folders
                const [folderResult, filesResult] = await Promise.all([
                  supabase
                    .from('property_folders')
                    .select('*')
                    .eq('property_id', property.id)
                    .eq('user_id', user.id)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: true }),
                  supabase
                    .from('property_files')
                    .select('*')
                    .eq('property_id', property.id)
                    .order('uploaded_at', { ascending: false })
                ]);

                if (folderResult.data && filesResult.data) {
                  await cachePropertyData(address, filesResult.data, folderResult.data);
                }
              }
            }
          }
        } else {
          setAddress('No address found');
          setSnappedLatLng(null);
          saveAddressToCache(loc.lat, loc.lng, 'No address found', null);
        }
      }

      if (map) {
        map.panTo(loc);
        map.setZoom(SEARCH_ZOOM);
      }
    }
  };

  // Modify the fetchFiles function to use cache
  const fetchFiles = useCallback(async () => {
    if (!savedProperty) return;
    
    // Handle new properties (not saved to DB yet)
    if (!savedProperty.id) {
      setFolders([]);
      setPropertyFiles([]);
      setFoldersLoading(false);
      setFilesLoading(false);
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setFoldersLoading(true);
    setFilesLoading(true);

    try {
      // Check cache first
      const cached = await getCachedPropertyData(savedProperty.address);
      if (cached) {
        console.log('Using cached property data');
        setFolders(cached.folders);
        setPropertyFiles(cached.files);
        setFoldersLoading(false);
        setFilesLoading(false);
        return;
      }

      console.log('Cache miss - fetching property data');
      
      // If not cached, fetch as normal
      const [folderResult, filesResult] = await Promise.all([
        supabase
          .from('property_folders')
          .select('*')
          .eq('property_id', savedProperty.id)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('property_files')
          .select('*')
          .eq('property_id', savedProperty.id)
          .order('uploaded_at', { ascending: false })
      ]);

      if (folderResult.data) {
        setFolders(folderResult.data);
      }

      if (filesResult.data) {
        setPropertyFiles(filesResult.data);
      }

      // Cache the fetched data
      if (folderResult.data && filesResult.data) {
        await cachePropertyData(savedProperty.address, filesResult.data, folderResult.data);
      }
    } catch (error) {
      console.error('Error fetching property data:', error);
    } finally {
      setFoldersLoading(false);
      setFilesLoading(false);
    }
  }, [savedProperty, getCachedPropertyData, cachePropertyData]);

  // Fetch files for the selected property
  useEffect(() => {
    if (showDetailsModal && savedProperty) {
      // Only fetch if we don't have the data in cache
      const checkCache = async () => {
        const cached = await getCachedPropertyData(savedProperty.address);
        if (!cached) {
          fetchFiles();
        }
      };
      checkCache();
    }
  }, [showDetailsModal, savedProperty, fetchFiles, getCachedPropertyData]);

  // shortAddress function moved to PropertyDetailsModal

  // Folder creation moved to PropertyDetailsModal

  // Centralized handler for renaming files and folders
  async function handleRename(item: PropertyFile | PropertyFolder, newName: string) {
    const originalName = 'file_name' in item ? item.file_name : item.name;
    const trimmedNewName = newName.trim();
    
    console.log('✏️ [RENAME] Starting rename operation');
    console.log('✏️ [RENAME] Item type:', 'file_name' in item ? 'file' : 'folder');
    console.log('✏️ [RENAME] Original name:', originalName);
    console.log('✏️ [RENAME] New name (trimmed):', trimmedNewName);
    
    if (!trimmedNewName || trimmedNewName === originalName) {
      console.log('✏️ [RENAME] No change needed, cancelling rename');
      setRenamingFileId(null);
      return;
    }
  
    // Type guard
    const isFile = 'file_name' in item;
    console.log('✏️ [RENAME] Is file:', isFile);
  
    try {
      if (isFile) {
        const file = item as PropertyFile;
        console.log('✏️ [RENAME] Processing file rename - File ID:', file.id, 'Property ID:', file.property_id);
        
        // Sanitize the new filename for storage
        const sanitizedNewName = sanitizeFileName(trimmedNewName);
        console.log('✏️ [RENAME] Sanitized new name:', sanitizedNewName);
        
        if (!sanitizedNewName) {
          console.log('✏️ [RENAME] Sanitization resulted in empty name, throwing error');
          throw new Error('Invalid file name after sanitization.');
        }
        
        // File-specific logic
        const existingFile = propertyFiles.find(f => f.folder_id === file.folder_id && f.file_name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== file.id);
        if (existingFile) {
          console.log('✏️ [RENAME] File with this name already exists:', existingFile.file_name);
          throw new Error('A file with this name already exists in this folder.');
        }

        const oldPath = file.file_url;
        const newPath = `${file.property_id}/${sanitizedNewName}`;
        console.log('✏️ [RENAME] Storage paths - Old:', oldPath, 'New:', newPath);
        
        console.log('✏️ [RENAME] Moving file in storage...');
        const { error: moveError } = await supabase.storage.from('property-files').move(oldPath, newPath);
        if (moveError) {
          console.log('✏️ [RENAME] Storage move error:', moveError);
          throw new Error(`Storage error: ${moveError.message}`);
        }
        console.log('✏️ [RENAME] Storage move successful');

        console.log('✏️ [RENAME] Updating database record...');
        const { error: dbError } = await supabase.from('property_files').update({
          file_name: sanitizedNewName,
          file_url: newPath,
        }).eq('id', file.id);
        
        if (dbError) {
          console.log('✏️ [RENAME] Database update error:', dbError);
          throw dbError;
        }
        console.log('✏️ [RENAME] Database update successful');

        console.log('✏️ [RENAME] Updating local state...');
        setPropertyFiles(files => files.map(f => f.id === file.id ? { ...f, file_name: sanitizedNewName, file_url: newPath } : f));
        
      } else {
        const folder = item as PropertyFolder;
        console.log('✏️ [RENAME] Processing folder rename - Folder ID:', folder.id);
        
        // For folders, we can be less restrictive with sanitization
        const sanitizedNewName = trimmedNewName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
        console.log('✏️ [RENAME] Sanitized folder name:', sanitizedNewName);
        
        // Folder-specific logic
        const existingFolder = folders.find(f => f.parent_id === folder.parent_id && f.name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== folder.id);
        if (existingFolder) {
          console.log('✏️ [RENAME] Folder with this name already exists:', existingFolder.name);
          throw new Error('A folder with this name already exists here.');
        }
        
        console.log('✏️ [RENAME] Updating folder in database...');
        const { error } = await supabase.from('property_folders').update({ name: sanitizedNewName }).eq('id', folder.id);
        if (error) {
          console.log('✏️ [RENAME] Folder database update error:', error);
          throw error;
        }
        console.log('✏️ [RENAME] Folder database update successful');

        console.log('✏️ [RENAME] Updating folder local state...');
        setFolders(folders => folders.map(f => f.id === folder.id ? { ...f, name: sanitizedNewName } : f));
      }
      
      console.log('✏️ [RENAME] Rename operation completed successfully');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Rename failed';
      console.log('✏️ [RENAME] Rename operation failed:', errorMessage);
      alert(`Rename failed: ${errorMessage}`);
    } finally {
      console.log('✏️ [RENAME] Clearing rename state');
      setRenamingFileId(null);
    }
  }

  // Handler for deleting a file
  async function handleDeleteFile(file: PropertyFile) {
    if (!file) return;

    const isConfirmed = window.confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`);

    if (isConfirmed) {
        try {
            // 1. Delete from storage
            const { error: storageError } = await supabase.storage
                .from('property-files')
                .remove([`${file.property_id}/${file.file_name}`]);

            if (storageError) {
                console.warn('Storage deletion warning (may be harmless if file was already gone):', storageError.message);
            }

            // 2. Delete from database
            const { error: dbError } = await supabase
                .from('property_files')
                .delete()
                .eq('id', file.id);

            if (dbError) throw dbError;

            // 3. Update local state
            setPropertyFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
            alert(`Failed to delete file: ${errorMessage}`);
        } finally {
            setFileMenuId(null);
        }
    } else {
        setFileMenuId(null);
    }
  }

  // Handler for deleting a folder
  async function handleDeleteFolder(folder: PropertyFolder) {
    if (!folder) return;

    const hasChildrenFolders = folders.some(f => f.parent_id === folder.id);
    const hasChildrenFiles = propertyFiles.some(f => f.folder_id === folder.id);

    if (hasChildrenFolders || hasChildrenFiles) {
        alert("Folder must be empty before it can be deleted.");
        setFolderMenuId(null);
        return;
    }

    const isConfirmed = window.confirm(`Are you sure you want to delete the folder "${folder.name}"?`);

    if (isConfirmed) {
        try {
            // Soft delete from the database
            const { error } = await supabase
                .from('property_folders')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', folder.id);

            if (error) throw error;

            // Update local state
            setFolders(prevFolders => prevFolders.filter(f => f.id !== folder.id));
        
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete folder';
            alert(`Failed to delete folder: ${errorMessage}`);
        } finally {
            setFolderMenuId(null);
        }
    } else {
        setFolderMenuId(null);
    }
  }

  // Add beforeunload warning if uploads are pending
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingUploads.some(p => p.status === 'uploading')) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingUploads]);

  // Clear pendingUploads and propertyFiles when switching properties
  useEffect(() => {
    setPendingUploads([]);
    setPropertyFiles([]);
  }, [savedProperty?.id]);

  // File utility functions moved to utils/fileManagement.ts

  // File upload handling
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log('📁 [UPLOAD] File input changed');
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log('📁 [UPLOAD] No files selected');
      return;
    }
    if (!savedProperty?.id) {
      console.log('📁 [UPLOAD] No saved property ID, aborting upload');
      alert('Please save the property first before uploading files.');
      return;
    }
    const propertyId = savedProperty.id;
    const folderIdForUpload = selectedFolder === 'master' ? null : selectedFolder;
    console.log('📁 [UPLOAD] Property ID:', propertyId, 'Folder ID:', folderIdForUpload);
    
    const filesArray = Array.from(files);
    console.log('📁 [UPLOAD] Files to upload:', filesArray.map(f => f.name));

    // Create pending uploads for each file
    const newPendingUploads: PendingUpload[] = filesArray.map(file => {
      console.log('📁 [UPLOAD] Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Generate unique file name for this folder
      const existingFiles = propertyFiles.filter(f => 
        folderIdForUpload ? f.folder_id === folderIdForUpload : !f.folder_id
      );
      const existingNames = existingFiles.map(f => f.file_name);
      console.log('📁 [UPLOAD] Existing files in folder:', existingNames);
      
      const baseName = sanitizeFileName(file.name); // Sanitize the original filename first
      console.log('📁 [UPLOAD] Base name after sanitization:', baseName);
      let uniqueName = baseName;
      let counter = 1;
      while (existingNames.includes(uniqueName)) {
        const [name, ext] = baseName.includes('.') 
          ? [baseName.substring(0, baseName.lastIndexOf('.')), baseName.substring(baseName.lastIndexOf('.'))]
          : [baseName, ''];
        uniqueName = `${name} (${counter})${ext}`;
        counter++;
        console.log('📁 [UPLOAD] Name conflict, trying:', uniqueName);
      }
      console.log('📁 [UPLOAD] Final unique name:', uniqueName);

      const uploadId = Math.random().toString(36).substring(2, 15);
      
      // Create abort controller for cancellation
      const abortController = new AbortController();
      
      const cancel = () => {
        console.log('📁 [UPLOAD] Cancelling upload for:', uniqueName);
        abortController.abort();
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      };

      const retry = () => {
        console.log('📁 [UPLOAD] Retrying upload for:', uniqueName);
        // Reset and restart upload
        setPendingUploads(prev => prev.map(p => 
          p.id === uploadId ? { ...p, status: 'uploading', progress: 0, error: undefined } : p
        ));
        startSingleUpload(uploadId, file, uniqueName, propertyId, folderIdForUpload, abortController);
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
        abortController
      };
    });

    console.log('📁 [UPLOAD] Created pending uploads:', newPendingUploads.map(p => ({ id: p.id, name: p.name })));
    setPendingUploads(prev => [...prev, ...newPendingUploads]);

    // Start uploads for each file
    newPendingUploads.forEach(pending => {
      if (pending.abortController) {
        startSingleUpload(pending.id, pending.file, pending.name, propertyId, folderIdForUpload, pending.abortController);
      }
    });

    e.target.value = '';
  }

  // Function to handle single file upload with progress tracking
  const startSingleUpload = async (
    uploadId: string, 
    file: File, 
    uniqueName: string, 
    propertyId: string, 
    folderIdForUpload: string | null,
    abortController: AbortController
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      console.log('📁 [UPLOAD] User authenticated:', user.id);

      const filePath = `${propertyId}/${uniqueName}`;
      
      console.log('📁 [UPLOAD] Starting upload - File:', uniqueName, 'Path:', filePath, 'Folder ID:', folderIdForUpload);

      // Use Supabase's upload method with proper progress tracking
      console.log('📁 [UPLOAD] Uploading to Supabase storage...');
      
      // Create a promise that tracks progress
      const uploadWithProgress = new Promise<{ path: string }>((resolve, reject) => {
        // Set up abort signal
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Simulate progress for now - Supabase doesn't expose upload progress directly
        let progress = 0;
        const progressInterval = setInterval(() => {
          if (progress < 90) {
            progress += Math.random() * 20;
            if (progress > 90) progress = 90;
            console.log('📁 [UPLOAD] Progress for', uniqueName, ':', Math.round(progress) + '%');
            setPendingUploads(prev => prev.map(p => 
              p.id === uploadId ? { ...p, progress: Math.round(progress) } : p
            ));
          }
        }, 200);

        // Perform the actual upload
        supabase.storage
          .from('property-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          })
          .then(({ data, error }) => {
            clearInterval(progressInterval);
            
            if (error) {
              console.log('📁 [UPLOAD] Supabase upload error:', error);
              reject(error);
            } else {
              console.log('📁 [UPLOAD] Supabase upload successful:', data);
              // Set progress to 100%
              setPendingUploads(prev => prev.map(p => 
                p.id === uploadId ? { ...p, progress: 100 } : p
              ));
              resolve({ path: data.path });
            }
          })
          .catch((err) => {
            clearInterval(progressInterval);
            reject(err);
          });
      });

      const uploadResult = await uploadWithProgress;
      
      console.log('📁 [UPLOAD] Storage upload successful:', uploadResult);

      // Insert database record
      const dbRecord = {
        property_id: propertyId,
        file_name: uniqueName,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
        user_id: user.id,
        file_type: file.type,
        file_size: file.size,
        folder_id: folderIdForUpload,
        modified_at: new Date(file.lastModified).toISOString(),
      };

      console.log('📁 [UPLOAD] Inserting DB record:', dbRecord);

      const { error: dbError } = await supabase.from('property_files').insert([dbRecord]);

      if (dbError) {
        console.log('📁 [UPLOAD] Database insert error:', dbError);
        throw dbError;
      }

      console.log('📁 [UPLOAD] Database insert successful for:', uniqueName);
      
      // Mark as successful
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, status: 'success', progress: 100 } : p
      ));

      // Refresh file list
      const result = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false });

      if (result.data) {
        console.log('📁 [UPLOAD] File list refreshed, found', result.data.length, 'files');
        setPropertyFiles(result.data);
      }

    } catch (err) {
      if (abortController.signal.aborted) {
        console.log('📁 [UPLOAD] Upload cancelled for:', uniqueName);
        return; // Don't update state if cancelled
      }

      console.log('📁 [UPLOAD] Upload error for', uniqueName, ':', err);
      
      let errorMsg = 'Upload failed';
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err && typeof err === 'object') {
        if ('message' in err && typeof (err as { message: string }).message === 'string') {
          errorMsg = (err as { message: string }).message;
        } else if ('error' in err && typeof (err as { error: string }).error === 'string') {
          errorMsg = (err as { error: string }).error;
        }
      }

      console.log('📁 [UPLOAD] Processed error message:', errorMsg);
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, status: 'error', error: errorMsg, progress: 100 } : p
      ));
    }
  };

  // Function to dismiss pending uploads
  const dismissPendingUpload = (uploadId: string) => {
    setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
  };

  // Update click outside handler to close any open menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking on a menu button
      if (target.closest('button[title="Folder actions"]') || target.closest('button[title="File actions"]')) {
        return;
      }
      
      // Don't close if clicking inside a menu
      if (target.closest('[role="menu"]') || target.closest('.absolute.right-0.mt-2')) {
        return;
      }
      
      // Close folder menu if click is outside
      if (folderMenuRef.current && !folderMenuRef.current.contains(target)) {
        setFolderMenuId(null);
      }
      // Close file menu if click is outside
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuId(null);
      }
    }

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Add state for action menus
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);

  // Utility function moved to utils/fileManagement.ts

  // File/folder sorting and filtering moved to PropertyDetailsModal

  // Debug effect for renamingFileId changes
  useEffect(() => {
    console.log('renamingFileId changed:', renamingFileId);
  }, [renamingFileId]);

  // Debug effect for menu state changes
  useEffect(() => {
    console.log('folderMenuId changed:', folderMenuId);
  }, [folderMenuId]);

  useEffect(() => {
    console.log('fileMenuId changed:', fileMenuId);
  }, [fileMenuId]);

  // Utility function moved to utils/fileManagement.ts

  // FileIcon component moved to src/components/FileIcon.tsx

  // Add state for hover loading
  // Address hover removed (was unused)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to prefetch property data
  const prefetchPropertyData = async (address: string) => {
    // Quick check if property exists and isn't already cached
    const exists = await checkPropertyExists(address);
    const isCached = await isPropertyDataCached(address);
    if (!exists || isCached) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch the property first
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .eq('address', address)
      .maybeSingle();

    if (!property) return;

    // Then fetch folders and files
    const [folderResult, filesResult] = await Promise.all([
      supabase
        .from('property_folders')
        .select('*')
        .eq('property_id', property.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('property_files')
        .select('*')
        .eq('property_id', property.id)
        .order('uploaded_at', { ascending: false })
    ]);

    if (folderResult.data && filesResult.data) {
      await cachePropertyData(address, filesResult.data, folderResult.data);
    }
  };

  // Add hover handlers to the Select button
  const handlePropertyHover = (address: string) => {
          // Address hover removed
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set new timeout
    hoverTimeoutRef.current = setTimeout(() => {
      prefetchPropertyData(address);
    }, 500); // Wait 500ms before starting prefetch
  };

  const handlePropertyHoverEnd = () => {
    // Address hover removed
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <LoadScript
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        libraries={GOOGLE_MAP_LIBRARIES}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={setMap}
          mapTypeId={mapType as google.maps.MapTypeId}
          options={{
            tilt: 0,
            rotateControl: false,
            gestureHandling: 'greedy',
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
          }}
        >
          {/* Central cursor overlay */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-30"
            style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              {/* White outline for contrast */}
              <line x1="18" y1="6" x2="18" y2="30" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="18" x2="30" y2="18" stroke="white" strokeWidth="5" strokeLinecap="round" />
              {/* Blue crosshair */}
              <line x1="18" y1="6" x2="18" y2="30" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="18" x2="30" y2="18" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              {/* Center dot */}
              <circle cx="18" cy="18" r="3" fill="#2563eb" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        </GoogleMap>
        <MapSearch
          onPlaceSelect={selectPredictionByPrediction}
          inputValue={inputValue}
          onInputChange={setInputValue}
          predictions={predictions}
          onPredictionsChange={setPredictions}
        />
        <MapControls 
          mapType={mapType}
          onMapTypeChange={setMapType}
        />
        {hasInteracted && address && (
          <PropertyInfoCard
            address={address}
            addressLoading={addressLoading}
            onMouseEnter={() => handlePropertyHover(address)}
            onMouseLeave={handlePropertyHoverEnd}
            onSelect={async () => {
              if (map) {
                const center = map.getCenter();
                // Try to fetch property from Supabase by address and user
                const { data: { user } } = await supabase.auth.getUser();
                let dbProperty = null;
                if (user) {
                  const { data: existing } = await supabase
                    .from('properties')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('address', address)
                    .maybeSingle();
                  dbProperty = existing;
                }
                            if (dbProperty) {
              setSavedProperty(dbProperty);
              // Check if we have cached data
              const cached = await getCachedPropertyData(address);
              if (cached) {
                // Use cached data immediately
                setFolders(cached.folders);
                setPropertyFiles(cached.files);
                setFoldersLoading(false);
                setFilesLoading(false);
              } else {
                // No cached data - set loading states before opening modal
                setFoldersLoading(true);
                setFilesLoading(true);
              }
            } else {
              setSavedProperty({
                address,
                lat: center?.lat() ?? 0,
                lng: center?.lng() ?? 0,
                label: null,
                notes: null,
                id: null, // Not saved yet
              });
              // New property - set loading states
              setFoldersLoading(true);
              setFilesLoading(true);
            }
            setShowDetailsModal(true);
              }
            }}
          />
        )}
        <PropertyDetailsModal
          isOpen={showDetailsModal}
          property={savedProperty}
          snappedLatLng={snappedLatLng}
          onClose={() => setShowDetailsModal(false)}
          folders={folders}
          files={propertyFiles}
          foldersLoading={foldersLoading}
          filesLoading={filesLoading}
          selectedFolder={selectedFolder}
          onFolderChange={setSelectedFolder}
          onFileUpload={(files: FileList) => {
            handleFileInputChange({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
          }}
          onFileDelete={handleDeleteFile}
          onFileRename={handleRename}
          onFolderCreate={async (name: string) => {
            // Folder creation now handled entirely by PropertyDetailsModal
            console.log('Folder creation request for:', name);
          }}
          onFolderDelete={handleDeleteFolder}
          pendingUploads={pendingUploads}
          getCachedPropertyData={getCachedPropertyData}
          cachePropertyData={cachePropertyData}
          onDismiss={dismissPendingUpload}
        />

      </LoadScript>
      {/* MoveModal for files */}
      {showMoveModal && moveFileTarget && (
        <MoveModal
          open={showMoveModal}
          folders={folders}
          currentItemId={moveFileTarget.id}
          currentItemType="file"
          currentFolderId={moveFileTarget.folder_id}
          onMove={async (targetFolderId) => {
            // Only rename if moving to a different folder
            let newName = moveFileTarget.file_name;
            if (moveFileTarget.folder_id !== targetFolderId) {
              newName = getUniqueFileName(moveFileTarget.file_name, targetFolderId, propertyFiles);
              newName = sanitizeFileName(newName);
            }
            if (!newName) {
              alert('Invalid file name. Please rename your file and try again.');
              return;
            }
            // If name changed, update both storage and DB
            if (newName !== moveFileTarget.file_name) {
              // Rename in storage: copy to new name, then delete old
              const oldPath = `${moveFileTarget.property_id}/${moveFileTarget.file_name}`;
              const newPath = `${moveFileTarget.property_id}/${newName}`;
              await supabase.storage.from('property-files').copy(oldPath, newPath);
              await supabase.storage.from('property-files').remove([oldPath]);
              await supabase.from('property_files').update({
                folder_id: targetFolderId,
                file_name: newName,
                file_url: newPath,
              }).eq('id', moveFileTarget.id);
            } else {
              // Just update folder_id
              await supabase.from('property_files').update({ folder_id: targetFolderId }).eq('id', moveFileTarget.id);
            }
            setShowMoveModal(false);
            setMoveFileTarget(null);
            // Refresh files
            const result = await supabase
              .from('property_files')
              .select('*')
              .eq('property_id', moveFileTarget.property_id)
              .order('uploaded_at', { ascending: false });
            if (result.data) setPropertyFiles(result.data);
          }}
          onCancel={() => {
            setShowMoveModal(false);
            setMoveFileTarget(null);
          }}
        />
      )}
    </div>
  );
}
 