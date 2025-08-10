import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import { useMobileViewport } from '../hooks/useMobileViewport';
import type { Prediction, Property, PropertyFile, PropertyFolder, PendingUpload } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';
import { ListView } from '../components/ListView';
import { MoveModal } from '../components/MoveModal';
import { getUniqueFileName, sanitizeFileName } from '../../utils/fileManagement';
import { getAddressFromCache, saveAddressToCache } from '../../utils/propertyCache';
import { getUserUsageBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES } from '../../constants';
import { MapSearch } from '../components/MapSearch';
import { MapControls } from '../components/MapControls';
import { PropertyInfoCard } from '../components/PropertyInfoCard';
import { MobileBottomNav } from '../components/MobileBottomNav';

import { 
  containerStyle, 
  US_CENTER, 
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAP_LIBRARIES, 
  DEFAULT_ZOOM, 
  SEARCH_ZOOM, 
  CURRENT_LOCATION_ZOOM,
  CURRENT_LOCATION_ZOOM_DEEP,
  MAP_TYPE_KEY, 
  DEFAULT_MAP_TYPE 
} from '../../constants';

// Constants moved to constants/index.ts

// Types moved to types/index.ts

// Duplicate components removed - now using extracted components

// Row component moved to PropertyDetailsModal

// Global cache interface
interface GlobalCache {
  __droppoint_property_cache?: Record<string, {
    files: PropertyFile[];
    folders: PropertyFolder[];
    lastFetched: number;
  }>;
}

// Custom pin icon for properties
const createPropertyPinIcon = (selected: boolean = false) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow -->
      <ellipse cx="16" cy="37" rx="6" ry="3" fill="rgba(0,0,0,0.2)"/>
      <!-- Pin body -->
      <path d="M16 2C9.925 2 5 6.925 5 13C5 21.5 16 36 16 36S27 21.5 27 13C27 6.925 22.075 2 16 2Z" 
            fill="${selected ? '#1d4ed8' : '#2563eb'}" 
            stroke="white" 
            stroke-width="2"/>
      <!-- House icon -->
      <path d="M16 8L12 11.5V20H14V16H18V20H20V11.5L16 8Z" 
            fill="white"/>
      <path d="M11 12L16 8L21 12V21H19V15H13V21H11V12Z" 
            fill="white"/>
    </svg>
  `)}`,
  scaledSize: new google.maps.Size(32, 40),
  anchor: new google.maps.Point(16, 38),
});

export default function MapPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'droppoint-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAP_LIBRARIES,
  });
  const router = useRouter();
  const { getMobileStyles, mobileClasses } = useMobileViewport();
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState(US_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState<string>(DEFAULT_MAP_TYPE);
  
  // Pin system state
  const [userProperties, setUserProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [address, setAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState(false);
  const justSelectedRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);

  // Add state for uploaded files
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);

  // Will be used for property save-on-upload logic
  const [snappedLatLng, setSnappedLatLng] = useState<{lat: number, lng: number} | null>(null);

  // Custom autocomplete state (used by internal search handling)
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

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

  // Track staged zoom behavior for current location (first -> deep)
  const currentLocationZoomStageRef = useRef<'none' | 'first' | 'deep'>('none');

  // (Removed) Live user location dot tracking

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

  // Expose cache globally for property switcher
  useEffect(() => {
    (globalThis as GlobalCache).__droppoint_property_cache = propertyCache;
  }, [propertyCache]);

  // Cache timeout in milliseconds (5 minutes)
  const CACHE_TIMEOUT = 5 * 60 * 1000;

  // Address caching moved to utils/propertyCache.ts

  // Cache functions moved to utils/propertyCache.ts



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
    
    console.log('📁 [CACHE] Property data cached for:', address, `(${files.length} files, ${folders.length} folders)`);
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

  // Optimistic auth guard: render immediately; redirect only if unauthenticated when check resolves
  useEffect(() => {
    setLoading(false);
    supabase.auth.getUser().then((result) => {
      if (!result.data.user) {
        router.replace('/');
      }
    });
  }, [router]);

  // Load user properties as pins
  const loadUserProperties = useCallback(async () => {
    console.log('📍 [PINS] Loading user properties as pins...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('📍 [PINS] Error loading properties:', error);
        return;
      }

      if (properties) {
        setUserProperties(properties);
        console.log('📍 [PINS] Loaded', properties.length, 'property pins');
      }
    } catch (error) {
      console.error('📍 [PINS] Error loading user properties:', error);
    }
  }, []);

  // Load user properties on mount
  useEffect(() => {
    loadUserProperties();
  }, [loadUserProperties]);

  // Background preload user properties for instant list view
  useEffect(() => {
    const preloadUserProperties = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🚀 [PRELOAD] Starting background property preload...');
          
          // Preload properties with file counts
          const { data: propertiesData } = await supabase
            .from('properties')
            .select(`
              id, address, lat, lng, label, notes, created_at, updated_at,
              property_files!inner(id)
            `)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

          if (propertiesData) {
            // Transform to PropertyWithFileCount format and cache
            const propertiesWithCount = propertiesData.map(property => ({
              ...property,
              file_count: property.property_files?.length || 0,
              last_accessed: property.updated_at,
              property_files: undefined // Remove the nested data
            }));

            // Store in sessionStorage for instant access
            sessionStorage.setItem('droppoint-properties-cache', JSON.stringify({
              properties: propertiesWithCount,
              timestamp: Date.now()
            }));

            console.log('🚀 [PRELOAD] Properties cached:', propertiesWithCount.length);
          }
        }
      } catch (error) {
        console.error('🚀 [PRELOAD] Error preloading properties:', error);
      }
    };

    // Start preloading after a short delay to not block initial map load
    const timer = setTimeout(preloadUserProperties, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Restore map position and selected property from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Restore map position
      const savedPosition = sessionStorage.getItem('droppoint-map-position');
      if (savedPosition) {
        try {
          const position = JSON.parse(savedPosition);
          setMapCenter({ lat: position.lat, lng: position.lng });
          if (position.zoom) {
            setZoom(position.zoom);
          }
          // Clear after using
          sessionStorage.removeItem('droppoint-map-position');
        } catch (error) {
          console.error('Error parsing saved map position:', error);
        }
      }

      // Restore selected property
      const savedProperty = sessionStorage.getItem('droppoint-selected-property');
      if (savedProperty) {
        try {
          const propertyData = JSON.parse(savedProperty);
          setSavedProperty(propertyData.property);
          setPropertyFiles(propertyData.files || []);
          setFolders(propertyData.folders || []);
          setSelectedFolder('master');
          setFoldersLoading(false);
          setFilesLoading(false);
          setAddress(propertyData.property.address);
          setSnappedLatLng({ lat: propertyData.property.lat, lng: propertyData.property.lng });
          
          // Open the modal
          setShowDetailsModal(true);
          
          // Clear after using
          sessionStorage.removeItem('droppoint-selected-property');
        } catch (error) {
          console.error('Error parsing saved property data:', error);
        }
      }
    }
  }, []);

  // Try to get user's geolocation on mount (skip if returning from bottom nav quick switch)
  useEffect(() => {
    console.log('🌍 [GEOLOCATION] Checking geolocation support...');
    console.log('🌍 [GEOLOCATION] Navigator available:', typeof navigator !== 'undefined');
    console.log('🌍 [GEOLOCATION] Geolocation available:', typeof navigator !== 'undefined' && 'geolocation' in navigator);
    console.log('🌍 [GEOLOCATION] Secure context (HTTPS):', window.isSecureContext);
    console.log('🌍 [GEOLOCATION] Current protocol:', window.location.protocol);
    console.log('🌍 [GEOLOCATION] Current hostname:', window.location.hostname);
    
    const shouldSkipGeo = typeof window !== 'undefined' && sessionStorage.getItem('droppoint-skip-geo') === '1';
    if (shouldSkipGeo) {
      try { sessionStorage.removeItem('droppoint-skip-geo'); } catch {}
    }

    if (!shouldSkipGeo && typeof window !== 'undefined' && navigator.geolocation) {
      console.log('🌍 [GEOLOCATION] Attempting to get current position on mount...');
      
      // First, check permissions if available
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          console.log('🌍 [GEOLOCATION] Permission status:', result.state);
          console.log('🌍 [GEOLOCATION] Permission details:', result);
        }).catch((err) => {
          console.log('🌍 [GEOLOCATION] Could not check permissions:', err);
        });
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('🌍 [GEOLOCATION] Success on mount:', position.coords);
          console.log('🌍 [GEOLOCATION] Accuracy:', position.coords.accuracy);
          console.log('🌍 [GEOLOCATION] Timestamp:', new Date(position.timestamp));
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          console.log('🌍 [GEOLOCATION] Map center updated to:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('🌍 [GEOLOCATION] Error on mount:', error.code, error.message);
          console.log('🌍 [GEOLOCATION] Error constants:', {
            PERMISSION_DENIED: GeolocationPositionError.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: GeolocationPositionError.POSITION_UNAVAILABLE,
            TIMEOUT: GeolocationPositionError.TIMEOUT
          });
          // If denied or unavailable, do nothing (fallback to US_CENTER)
        },
        {
          enableHighAccuracy: false, // Use false for faster initial load
          timeout: 8000,
          maximumAge: 300000 // 5 minutes cache for initial load
        }
      );
    } else {
      console.log('🌍 [GEOLOCATION] Navigator.geolocation not available');
      console.log('🌍 [GEOLOCATION] Window available:', typeof window !== 'undefined');
      console.log('🌍 [GEOLOCATION] Navigator available:', typeof navigator !== 'undefined');
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



  // Handle zoom changes
  const handleZoomChange = useCallback(() => {
    if (map) {
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined) {
        setZoom(currentZoom);
        
        // Clear any selected new pin if zoomed out too far
        // if (currentZoom < PROPERTY_SELECTION_MIN_ZOOM) {
        //   if (selectedProperty && !selectedProperty.id) {
        //     setSelectedProperty(null);
        //     setAddress('');
        //     setAddressLoading(false);
        //     setSnappedLatLng(null);
        //   }
        // }
      }
    }
  }, [map]);

  // Simplified user interaction handler (mainly for cleanup on zoom changes)
  // const handleUserInteraction = useCallback(async () => {
  //   if (map) {
  //     const currentZoom = map.getZoom();
  //     
  //     // Clear any selected new pin if zoomed out too far
  //     // if (currentZoom !== undefined && currentZoom < PROPERTY_SELECTION_MIN_ZOOM) {
  //     //   if (selectedProperty && !selectedProperty.id) {
  //     //     setSelectedProperty(null);
  //     //     setAddress('');
  //     //     setAddressLoading(false);
  //     //     setSnappedLatLng(null);
  //     //   }
  //     // }
  //   }
  // }, [map, selectedProperty]);

  // Only listen for dragend and zoom_changed for user interaction
  // useEffect(() => {
  //   if (map) {
  //     const dragendListener = map.addListener('dragend', handleUserInteraction);
  //     const zoomListener = map.addListener('zoom_changed', handleUserInteraction);
  //     return () => {
  //       if (dragendListener) dragendListener.remove();
  //       if (zoomListener) zoomListener.remove();
  //     };
  //   }
  // }, [map, handleUserInteraction]);

  // On mount, read map type from localStorage
  useEffect(() => {
    const storedType = typeof window !== 'undefined' ? localStorage.getItem(MAP_TYPE_KEY) : null;
    if (storedType === 'roadmap' || storedType === 'satellite' || storedType === 'hybrid') {
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
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
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
    } catch (error) {
      console.error('📍 [GEOCODE] Error fetching address:', error);
      
      let errorAddress = 'Error fetching address';
      
      // Check if it's a JSON parsing error
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.error('📍 [GEOCODE] JSON parsing error - likely API key issue');
        errorAddress = 'Address lookup failed - check API key';
      }
      
      setAddress(errorAddress);
      setSnappedLatLng(null);
      saveAddressToCache(lat, lng, errorAddress, null);
    }
    setAddressLoading(false);
  };

  async function fetchPredictions(input: string): Promise<Prediction[]> {
    try {
      const response = await fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.predictions || [];
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
    return [];
  }

  async function geocodePlaceId(placeId: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      return new Promise((resolve) => {
        service.getDetails({ placeId }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            resolve({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error geocoding place ID:', error);
      return null;
    }
  }

  // handleSearch removed - search handled by MapSearch component

  // Helper to select a prediction object
  const selectPredictionByPrediction = async (prediction: Prediction) => {
    if (!prediction) return;
    justSelectedRef.current = true;
    setInputValue(prediction.description);
    setPredictions([]);
    
    // Check if this is a user property
    const isUserProperty = prediction.types?.includes('user_property') || prediction.user_property;
    
    if (isUserProperty) {
      // Handle user property selection directly
      const propertyId = prediction.property_id;
      if (propertyId) {
        console.log('🏠 User property selected:', prediction.description);
        
        // Get the property details from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: property } = await supabase
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .eq('user_id', user.id)
            .single();
          
          if (property) {
            const coords = { lat: property.lat, lng: property.lng };
            setMapCenter(coords);
            setZoom(SEARCH_ZOOM);
            
            // Set address directly from database
            setAddress(property.address);
            setSnappedLatLng({ lat: property.lat, lng: property.lng });
            setAddressLoading(false);
            
            // Cache the address
            saveAddressToCache(property.lat, property.lng, property.address, { lat: property.lat, lng: property.lng });
            
            // Try to prefetch property data
            const isCached = await isPropertyDataCached(property.address);
            if (!isCached) {
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
                await cachePropertyData(property.address, filesResult.data, folderResult.data);
              }
            }
            
            if (map) {
              map.panTo(coords);
              map.setZoom(SEARCH_ZOOM);
            }
            
            return; // Exit early for user properties
          }
        }
      }
    }
    
    // Handle regular Google Places prediction
    const loc = await geocodePlaceId(prediction.place_id);
    if (loc) {
      setMapCenter(loc);
      setZoom(SEARCH_ZOOM);
      
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
  /* REMOVED: fetchFiles function is no longer needed - data fetching is now handled directly in the onSelect handler
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
  */

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

  // Handler for creating a new folder under the current selectedFolder
  async function handleCreateFolderByName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!savedProperty || !savedProperty.id) {
        alert('Please save the property before creating folders.');
        return;
      }
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
        console.error('📁 [FOLDERS] Error creating folder:', error);
        alert('Could not create folder. Please try again.');
        return;
      }

      if (data) {
        setFolders(prev => [...prev, data]);
      }
    } catch (err) {
      console.error('📁 [FOLDERS] Unexpected error creating folder:', err);
      alert('Could not create folder.');
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

  // Clear pendingUploads when switching properties
  // Note: propertyFiles are now managed by the property switcher, so we don't clear them here
  useEffect(() => {
    setPendingUploads([]);
  }, [savedProperty?.id]);

  // File utility functions moved to utils/fileManagement.ts

  // File upload handling
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log('📁 [UPLOAD] File input changed');
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log('📁 [UPLOAD] No files selected');
      return;
    }
    
    if (!savedProperty) {
      console.log('📁 [UPLOAD] No property selected, aborting upload');
      alert('Please select a property first before uploading files.');
      return;
    }

    let propertyId: string = savedProperty.id || '';
    
    // If property doesn't have an ID yet, save it to the database first
    if (!propertyId) {
      console.log('📁 [UPLOAD] Property not saved yet, auto-saving to database...');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert('You must be logged in to upload files.');
          return;
        }

        // Save the property to the database
        const { data: newProperty, error: saveError } = await supabase
          .from('properties')
          .insert([{
            user_id: user.id,
            address: savedProperty.address,
            lat: savedProperty.lat,
            lng: savedProperty.lng,
            label: savedProperty.label,
            notes: savedProperty.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (saveError) {
          console.error('📁 [UPLOAD] Error saving property:', saveError);
          alert('Failed to save property. Please try again.');
          return;
        }

        if (!newProperty) {
          console.error('📁 [UPLOAD] No property returned after save');
          alert('Failed to save property. Please try again.');
          return;
        }

        // Update the saved property with the new ID
        propertyId = newProperty.id;
        setSavedProperty(newProperty);
        console.log('📁 [UPLOAD] Property auto-saved with ID:', propertyId);
        
        // Refresh user properties to show the new property as a permanent pin
        await loadUserProperties();
        
        // Add small delay to ensure property is fully propagated in Supabase
        // This is especially important on mobile networks with higher latency
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify the property was actually saved and is accessible
        const { data: verifyProperty, error: verifyError } = await supabase
          .from('properties')
          .select('id')
          .eq('id', propertyId)
          .eq('user_id', user.id)
          .single();
          
        if (verifyError || !verifyProperty) {
          console.error('📁 [UPLOAD] Property verification failed:', verifyError);
          throw new Error('Property was not properly saved. Please try again.');
        }
        
        console.log('📁 [UPLOAD] Property verified, proceeding with uploads');
        
      } catch (error) {
        console.error('📁 [UPLOAD] Error auto-saving property:', error);
        alert('Failed to save property. Please try again.');
        return;
      }
    }

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
        abortController
      };
    });

    console.log('📁 [UPLOAD] Created pending uploads:', newPendingUploads.map(p => ({ id: p.id, name: p.name })));
    setPendingUploads(prev => [...prev, ...newPendingUploads]);

    // Start uploads for each file
    newPendingUploads.forEach(pending => {
      startSingleUpload(pending.id, pending.file, pending.name, propertyId, folderIdForUpload);
    });

    e.target.value = '';
  }

  // Function to handle single file upload with progress tracking
  const startSingleUpload = async (
    uploadId: string, 
    file: File, 
    uniqueName: string, 
    propertyId: string, 
    folderIdForUpload: string | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('📁 [UPLOAD] User not found');
      throw new Error('User not authenticated');
    }

    console.log('📁 [UPLOAD] Starting upload process for:', uniqueName);
    
    // Enforce free-tier quota before uploading
    try {
      const usedBytes = await getUserUsageBytes(user.id);
      const projected = usedBytes + file.size;
      if (projected > FREE_TIER_MAX_BYTES) {
        console.warn('⛔ [UPLOAD] Quota exceeded. Used:', usedBytes, 'Attempting:', file.size);
        alert('Storage limit reached for the free plan (5 GB). Please delete files or upgrade to continue uploading.');
        // Remove pending upload entry if present
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
        return;
      }
    } catch (err) {
      console.error('⚠️ [USAGE] Failed to check usage. Blocking upload for safety.', err);
      alert('Unable to verify your storage usage right now. Please try again shortly.');
      setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      return;
    }
    
    // Optimized upload with single progress update
    const filePath = `${propertyId}/${uniqueName}`;
    
    try {
      // Upload to storage with progress tracking
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('property-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.log('📁 [UPLOAD] Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('📁 [UPLOAD] Storage upload successful:', uploadData.path);

      // Update progress to 90% after storage upload
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, progress: 90 } : p
      ));

      // Insert database record with optimized payload
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

      // Single database insert with retry logic
      let dbError = null;
      let retryCount = 0;
      const maxRetries = 2; // Reduced from 3 for faster failure
      
      while (retryCount < maxRetries) {
        const { error } = await supabase.from('property_files').insert([dbRecord]);
        
        if (!error) {
          break;
        }
        
        dbError = error;
        retryCount++;
        
        console.log(`📁 [UPLOAD] Database insert attempt ${retryCount} failed:`, error);
        
        if (retryCount < maxRetries) {
          const waitTime = 500 * retryCount; // Faster retry: 500ms, 1s
          console.log(`📁 [UPLOAD] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (dbError) {
        console.log('📁 [UPLOAD] Database insert failed after all retries:', dbError);
        throw dbError;
      }

      console.log('📁 [UPLOAD] Database insert successful for:', uniqueName);
      
      // Mark as successful
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, status: 'success', progress: 100 } : p
      ));

      // Optimized file list refresh - only refresh files, not both files and folders
      const result = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false });

      if (result.data) {
        setPropertyFiles(result.data);
        
        // Update cache immediately for instant access
        const currentAddress = address || '';
        if (currentAddress) {
          const cacheKey = `${user.id}-${currentAddress}`;
          setPropertyCache(prev => ({
            ...prev,
            [cacheKey]: {
              files: result.data,
              folders: prev[cacheKey]?.folders || [],
              lastFetched: Date.now()
            }
          }));
        }
      }

      console.log('📁 [UPLOAD] Upload completed successfully for:', uniqueName);

    } catch (error) {
      console.log('📁 [UPLOAD] Upload failed for:', uniqueName, error);
      
      // Mark as failed
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, status: 'error', progress: 0 } : p
      ));

      throw error;
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









  // Add state for current location loading
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);

  // Add state for ListView modal
  const [showListView, setShowListView] = useState(false);
  const [cameFromListView, setCameFromListView] = useState(false);

  // List view navigation handler
  const handleListViewClick = useCallback(() => {
    setShowListView(true);
  }, []);

  // Enhanced close handler that returns to list view if needed
  const handleDetailsModalClose = useCallback(() => {
    setShowDetailsModal(false);
    if (cameFromListView) {
      setCameFromListView(false);
      setShowListView(true);
    }
  }, [cameFromListView]);

  // Current location handler
  const handleCurrentLocationClick = useCallback(() => {
    console.log('🌍 [GEOLOCATION] Current location button clicked');
    
    if (!navigator.geolocation) {
      console.log('🌍 [GEOLOCATION] Geolocation not supported');
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setCurrentLocationLoading(true);
    console.log('🌍 [GEOLOCATION] Starting getCurrentPosition...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('🌍 [GEOLOCATION] Success:', position.coords);
        const { latitude, longitude } = position.coords;
        const newCenter = { lat: latitude, lng: longitude };
        
        console.log('🌍 [GEOLOCATION] New center:', newCenter);
        
        // Determine desired zoom based on current state and stage
        const currentZoom = map?.getZoom?.() ?? zoom;
        const initialZoom = CURRENT_LOCATION_ZOOM;
        const deepZoom = CURRENT_LOCATION_ZOOM_DEEP;

        let targetZoom = initialZoom;
        const stage = currentLocationZoomStageRef.current;

        if (stage === 'none') {
          // First click: if already zoomed deeper than initial, go straight to deep
          targetZoom = currentZoom > initialZoom ? deepZoom : initialZoom;
          currentLocationZoomStageRef.current = 'first';
        } else if (stage === 'first') {
          // Second click: go deeper regardless (unless already deeper)
          targetZoom = Math.max(currentZoom, deepZoom);
          currentLocationZoomStageRef.current = 'deep';
        } else {
          // Subsequent clicks: toggle between initial and deep based on current depth
          targetZoom = currentZoom > initialZoom ? initialZoom : deepZoom;
          currentLocationZoomStageRef.current = currentZoom > initialZoom ? 'first' : 'deep';
        }

        // Update map center and zoom
        setMapCenter(newCenter);
        setZoom(targetZoom);
        
        if (map) {
          console.log('🌍 [GEOLOCATION] Updating map position...');
          map.panTo(newCenter);
          map.setZoom(targetZoom);
        } else {
          console.log('🌍 [GEOLOCATION] Warning: Map not ready yet');
        }

        // Clear search input
        setInputValue('');
        
        // Check cache first
        const cached = getAddressFromCache(latitude, longitude);
        if (cached) {
          console.log('🌍 [GEOLOCATION] Using cached address:', cached.address);
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
              const isCached = await isPropertyDataCached(cached.address);
              if (!isCached) {
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
          // Fetch address for current location
          console.log('🌍 [GEOLOCATION] Fetching address for coordinates...');
          fetchAddress(latitude, longitude);
        }
        
        setCurrentLocationLoading(false);
        console.log('🌍 [GEOLOCATION] Location update complete');
      },
      (error) => {
        setCurrentLocationLoading(false);
        console.log('🌍 [GEOLOCATION] Error:', error);
        console.log('🌍 [GEOLOCATION] Error details:', {
          code: error.code,
          message: error.message,
          PERMISSION_DENIED: error.PERMISSION_DENIED,
          POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
          TIMEOUT: error.TIMEOUT
        });
        
        // Reset zoom stage on error to allow fresh attempt
        currentLocationZoomStageRef.current = 'none';

        let errorMessage = 'Unable to retrieve your location.';
        let debugInfo = '';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
            debugInfo = 'To enable: Click the location icon in your address bar, or go to browser settings > Privacy > Location.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your GPS and internet connection.';
            debugInfo = 'Try: 1) Enable GPS/location services 2) Check internet connection 3) Try again in a few seconds';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            debugInfo = 'The location request took too long. Your device might be having trouble getting a GPS fix.';
            break;
          default:
            errorMessage = `Location error (${error.code}): ${error.message}`;
            debugInfo = 'Unknown geolocation error occurred.';
        }
        
        console.log('🌍 [GEOLOCATION] Debug info:', debugInfo);
        alert(`${errorMessage}\n\n${debugInfo}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout to 15 seconds
        maximumAge: 60000 // Cache location for 1 minute
      }
    );
  }, [map, isPropertyDataCached, cachePropertyData, zoom]);

  // Handle map click to drop new pin
  const handleMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    console.log('📍 [PINS] Map clicked at:', { lat, lng });
    
    // Check if this might be a double-click by tracking recent clicks
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    lastClickTimeRef.current = currentTime;
    
    // If clicks are happening rapidly (within 300ms), it's likely a double-click for zoom
    if (timeSinceLastClick < 300) {
      console.log('📍 [PINS] Double-click detected - allowing zoom behavior only');
      return; // Don't drop pins during double-clicking
    }
    
    // Add a small delay to detect if this is part of a double-click sequence
    setTimeout(async () => {
      // Check if another click happened shortly after (indicating double-click)
      if (Date.now() - lastClickTimeRef.current < 250) {
        console.log('📍 [PINS] Part of double-click sequence - skipping pin drop');
        return;
      }
      
      // Single click confirmed - proceed with pin drop
      // Clear any existing selected property that isn't saved
      if (selectedProperty && !selectedProperty.id) {
        setSelectedProperty(null);
      }

      setAddressLoading(true);
      
      try {
        // Get address for the new pin location
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.results && data.results[0]) {
          const address = data.results[0].formatted_address;
          const snapped = data.results[0].geometry.location;
          const snappedLatLng = { lat: snapped.lat, lng: snapped.lng };
          
          console.log('📍 [PINS] New pin address:', address);
          
          // Create new property for pin
          const newProperty: Property = {
            id: null, // Will be assigned when saved
            address,
            lat: snappedLatLng.lat,
            lng: snappedLatLng.lng,
            label: null,
            notes: null,
          };
          
          // Set as current property and show info card
          setSelectedProperty(newProperty);
          setAddress(address);
          setSnappedLatLng(snappedLatLng);
          
          // Cache the address
          saveAddressToCache(lat, lng, address, snappedLatLng);
          
          console.log('📍 [PINS] New pin ready for property creation');
        } else {
          console.log('📍 [PINS] No address found for pin location');
          setAddress('Location not found');
          
          // Still create a property with coordinates but no address
          const newProperty: Property = {
            id: null,
            address: 'Location not found',
            lat,
            lng,
            label: null,
            notes: null,
          };
          
          setSelectedProperty(newProperty);
        }
      } catch (error) {
        console.error('📍 [PINS] Error creating pin:', error);
        
        let errorAddress = 'Error getting location';
        
        // Check if it's a JSON parsing error
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
          console.error('📍 [PINS] JSON parsing error - likely API key issue');
          errorAddress = 'Address lookup failed - check API key';
        }
        
        setAddress(errorAddress);
        
        // Still create a property with coordinates but error address
        const newProperty: Property = {
          id: null,
          address: errorAddress,
          lat,
          lng,
          label: null,
          notes: null,
        };
        
        setSelectedProperty(newProperty);
      } finally {
        setAddressLoading(false);
      }
    }, 250); // Wait 250ms to detect double-click
  }, [selectedProperty]);

  // Handle property pin click - show selection card and prefetch in background
  const handlePropertyPinClick = useCallback(async (property: Property) => {
    console.log('📍 [PINS] Property pin clicked:', property.address);
    
    setSelectedFolder('master'); // reset folder to root when opening a property
    setSelectedProperty(property);
    setSavedProperty(property);
    setAddress(property.address);
    setSnappedLatLng({ lat: property.lat, lng: property.lng });
    
    // Check cache first for instant loading
    const cached = await getCachedPropertyData(property.address);
    if (cached) {
      console.log('📍 [PINS] Using cached data for property');
      setFolders(cached.folders);
      setPropertyFiles(cached.files);
      setFoldersLoading(false);
      setFilesLoading(false);
    } else {
      console.log('📍 [PINS] Loading fresh data for property');
      setFoldersLoading(true);
      setFilesLoading(true);
      
      try {
        if (property.id) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
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

            if (folderResult.data) {
              setFolders(folderResult.data);
            }
            if (filesResult.data) {
              setPropertyFiles(filesResult.data);
            }
            
            // Cache the data
            if (folderResult.data && filesResult.data) {
              await cachePropertyData(property.address, filesResult.data, folderResult.data);
            }
          }
        } else {
          // New property - clear data
          setFolders([]);
          setPropertyFiles([]);
        }
      } catch (error) {
        console.error('📍 [PINS] Error loading property data:', error);
      } finally {
        setFoldersLoading(false);
        setFilesLoading(false);
      }
    }
    
    // Do not open modal immediately; wait for user to confirm via selection card
  }, [getCachedPropertyData, cachePropertyData]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${mobileClasses.fullScreen}`}
           style={getMobileStyles('page')}>
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`relative w-screen h-screen overflow-hidden ${mobileClasses.fullScreen}`} 
         style={getMobileStyles('page')}>
      <Head>
        <title>Map View - DropPoint Real Estate Document Management</title>
        <meta name="description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
        <meta property="og:title" content="Map View - DropPoint Real Estate Document Management" />
        <meta property="og:description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
        <meta property="twitter:title" content="Map View - DropPoint Real Estate Document Management" />
        <meta property="twitter:description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
      </Head>
      {/* Google Maps loader */}
      {!isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600">Loading map…</div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center text-red-600">Failed to load map.</div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={(mapInstance) => {
            console.log('🗺️ [MAP] Map loaded successfully');
            console.log('🗺️ [MAP] Initial center:', mapCenter);
            console.log('🗺️ [MAP] Initial zoom:', zoom);
            setMap(mapInstance);
          }}
          onClick={handleMapClick}
          onDblClick={() => {
            console.log('📍 [PINS] Double-click detected - allowing Google Maps zoom');
            // Google Maps will handle the zoom automatically
            // Just update our click tracking to prevent pin drops
            lastClickTimeRef.current = Date.now();
          }}
          onZoomChanged={handleZoomChange}
          mapTypeId={mapType as google.maps.MapTypeId}
          options={{
            tilt: 0,
            rotateControl: false,
            gestureHandling: 'greedy',
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false,
            disableDefaultUI: true,
            styles: [
              {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }]
              },
              {
                featureType: 'poi.business',
                stylers: [{ visibility: 'off' }]
              },
              {
                featureType: 'transit',
                stylers: [{ visibility: 'off' }]
              }
            ]
          }}
        >
          {/* Property pins */}
          {userProperties.map((property) => (
            <Marker
              key={property.id || `temp-${property.lat}-${property.lng}`}
              position={{ lat: property.lat, lng: property.lng }}
              icon={createPropertyPinIcon(selectedProperty?.id === property.id)}
              onClick={() => handlePropertyPinClick(property)}
              title={property.address}
            />
          ))}
          
          {/* Temporary pin for newly dropped property */}
          {selectedProperty && !selectedProperty.id && (
            <Marker
              key={`new-pin-${selectedProperty.lat}-${selectedProperty.lng}`}
              position={{ lat: selectedProperty.lat, lng: selectedProperty.lng }}
              icon={createPropertyPinIcon(true)} // Always selected since it's the active new pin
              onClick={() => handlePropertyPinClick(selectedProperty)}
              title={selectedProperty.address || 'New Property'}
            />
          )}

          {/* Mobile live location indicator removed */}
        </GoogleMap>
      )}
        <MapSearch
          onPlaceSelect={selectPredictionByPrediction}
          inputValue={inputValue}
          onInputChange={setInputValue}
          predictions={predictions}
          onPredictionsChange={setPredictions}
          onShowDropdownChange={setShowDropdown}
        />
        <MapControls 
          mapType={mapType}
          onMapTypeChange={setMapType}
          showDropdown={showDropdown}
          onCurrentLocationClick={handleCurrentLocationClick}
          currentLocationLoading={currentLocationLoading}
          showPropertyInfoCard={Boolean(selectedProperty && address)}
          onListViewClick={handleListViewClick}
        />

        {/* Mobile bottom nav */}
        <MobileBottomNav
          onList={() => router.push('/list')}
          onLocate={handleCurrentLocationClick}
          onMap={() => {
            // Cycle map type: roadmap -> hybrid -> satellite -> roadmap
            if (mapType === 'roadmap') setMapType('hybrid');
            else if (mapType === 'hybrid') setMapType('satellite');
            else setMapType('roadmap');
          }}
          locateLabel={currentLocationLoading ? 'Locating' : (zoom > CURRENT_LOCATION_ZOOM ? 'Wider' : 'Current')}
        />

        {/* Show PropertyInfoCard for both newly dropped and existing pins */}
        {selectedProperty && address && (
          <PropertyInfoCard
            address={address}
            addressLoading={addressLoading}
            onMouseEnter={() => {}}
            onMouseLeave={() => {}}
            onSelect={async () => {
              if (!selectedProperty.id) {
                // New, unsaved property: initialize and open modal
                setSavedProperty({
                  address,
                  lat: selectedProperty.lat,
                  lng: selectedProperty.lng,
                  label: null,
                  notes: null,
                  id: null,
                });
                setFolders([]);
                setPropertyFiles([]);
                setFoldersLoading(false);
                setFilesLoading(false);
                setShowDetailsModal(true);
              } else {
                // Existing property: ensure data is ready (cache or background-fetched), then open modal
                const cached = await getCachedPropertyData(selectedProperty.address);
                if (cached) {
                  setFolders(cached.folders);
                  setPropertyFiles(cached.files);
                  setFoldersLoading(false);
                  setFilesLoading(false);
                }
                setSavedProperty(selectedProperty);
                setShowDetailsModal(true);
              }
              // Hide the selection card once modal is opened
              setSelectedProperty(null);
              setAddress('');
            }}
          />
        )}
        <PropertyDetailsModal
          isOpen={showDetailsModal}
          property={savedProperty}
          snappedLatLng={snappedLatLng}
          onClose={handleDetailsModalClose}
          folders={folders}
          files={propertyFiles}
          foldersLoading={foldersLoading}
          filesLoading={filesLoading}
          selectedFolder={selectedFolder}
          onFolderChange={setSelectedFolder}
          onFileUpload={async (files: FileList) => {
            await handleFileInputChange({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
          }}
          onFileDelete={handleDeleteFile}
          onFileRename={handleRename}
          onFolderCreate={handleCreateFolderByName}
          onFolderDelete={handleDeleteFolder}
          pendingUploads={pendingUploads}
          getCachedPropertyData={getCachedPropertyData}
          cachePropertyData={cachePropertyData}
          onDismiss={dismissPendingUpload}
          onPropertySwitch={(property, files, folders) => {
            // Update the current property and its data
            setSavedProperty(property);
            setPropertyFiles(files);
            setFolders(folders);
            setSelectedFolder('master');
            setFoldersLoading(false);
            setFilesLoading(false);
            
            // Update address to match the switched property
            setAddress(property.address);
            
            console.log('🔄 [SWITCH] Property switched to:', property.address, `(${files.length} files, ${folders.length} folders)`);
          }}
          onMapMove={(lat, lng) => {
            // Update map center when switching properties
            setMapCenter({ lat, lng });
            if (map) {
              map.panTo({ lat, lng });
            }
          }}
        />

      
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
      {/* ListView Modal */}
      <ListView
        isOpen={showListView}
        onClose={() => setShowListView(false)}
        onPropertySelect={async (property) => {
          // Close the modal first
          setShowListView(false);
          
          // Set the property data for immediate use (like PropertySwitcher)
          setSavedProperty(property);
          setAddress(property.address);
          setSnappedLatLng({ lat: property.lat, lng: property.lng });
          
          // Background map updates (silent, no UI disruption)
          setMapCenter({ lat: property.lat, lng: property.lng });
          setZoom(SEARCH_ZOOM);
          if (map) {
            map.panTo({ lat: property.lat, lng: property.lng });
            map.setZoom(SEARCH_ZOOM);
          }
          
          // Load property data and open modal immediately (like PropertySwitcher)
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              setFoldersLoading(true);
              setFilesLoading(true);
              
              // Open modal immediately with loading state
              setCameFromListView(true);
              setShowDetailsModal(true);
              
              // Check cache first
              const cached = await getCachedPropertyData(property.address);
              if (cached) {
                setFolders(cached.folders);
                setPropertyFiles(cached.files);
                setFoldersLoading(false);
                setFilesLoading(false);
              } else {
                // Fetch fresh data in background
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

                if (folderResult.data) {
                  setFolders(folderResult.data);
                }
                if (filesResult.data) {
                  setPropertyFiles(filesResult.data);
                }
                
                // Cache the data
                if (folderResult.data && filesResult.data) {
                  await cachePropertyData(property.address, filesResult.data, folderResult.data);
                }
                
                setFoldersLoading(false);
                setFilesLoading(false);
              }
              
              // Reset folder selection
              setSelectedFolder('master');
            }
          } catch (error) {
            console.error('Error loading property data:', error);
            setFoldersLoading(false);
            setFilesLoading(false);
          }
        }}
      />

    </div>
  );
}
 