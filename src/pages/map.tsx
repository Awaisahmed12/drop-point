import { logger } from '../utils/logger';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { useMapState } from '../hooks/useMapState';
import { usePropertyState } from '../hooks/usePropertyState';
import { usePropertyData } from '../hooks/usePropertyData';
import { useSearchState } from '../hooks/useSearchState';
import { useModalState } from '../hooks/useModalState';
import { useUploadState } from '../hooks/useUploadState';
import { useMenuState } from '../hooks/useMenuState';
import type { Prediction, Property, PropertyFile, PropertyFolder, PendingUpload, PropertyWithFileCount } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';
import { getUniqueFileName, getDuplicateFileName, sanitizeFileName } from '../../utils/fileManagement';
import { getAddressFromCache, saveAddressToCache } from '../../utils/propertyCache';
import { getUserUsageBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES } from '../../constants';
import { MapSearch } from '../components/MapSearch';
import { MapControls } from '../components/MapControls';
import { PropertyInfoCard } from '../components/PropertyInfoCard';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { CurrentLocationIndicator } from '../components/CurrentLocationIndicator';
import { withAuth } from '../components/withAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { propertyService, fileService, folderService } from '../services';
import { useToast } from '../contexts/ToastContext';
import { prefetchPropertyData, getPropertyDataSync, setPropertyDataCache } from '../hooks/usePropertyPrefetch';
import { wasRecentTouch } from '../utils/ghostClick';

import {
  mapContainerStyleWithSidebar,
  US_CENTER,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAP_LIBRARIES,
  DEFAULT_ZOOM,
  SEARCH_ZOOM,
  CURRENT_LOCATION_ZOOM,
  CURRENT_LOCATION_ZOOM_DEEP,
  MAP_TYPE_KEY,
  DEFAULT_MAP_TYPE,
  COORDINATE_THRESHOLD
} from '../../constants';

// Constants moved to constants/index.ts

// Types moved to types/index.ts

// Duplicate components removed - now using extracted components

// Row component moved to PropertyDetailsModal

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

function MapPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'droppoint-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAP_LIBRARIES,
  });
  const router = useRouter();
  const { getMobileStyles, mobileClasses } = useMobileViewport();
  const { showToast } = useToast();
  
  // Extract state management into custom hooks
  const mapState = useMapState();
  const propertyState = usePropertyState();
  const propertyData = usePropertyData();
  const searchState = useSearchState();
  const modalState = useModalState();
  const uploadState = useUploadState();
  const menuState = useMenuState();

  // Destructure for easier access
  const {
    mapCenter, setMapCenter, map, setMap, zoom, setZoom, mapType, setMapType,
    mapFirstIdle, setMapFirstIdle, initialCenterResolved, setInitialCenterResolved,
    saveMapPositionThrottled
  } = mapState;

  const {
    userProperties, setUserProperties, selectedProperty, setSelectedProperty,
    savedProperty, setSavedProperty, propertiesLoaded,
    loadUserProperties
  } = propertyState;

  const {
    propertyFiles, setPropertyFiles, folders, setFolders,
    selectedFolder, setSelectedFolder, foldersLoading, setFoldersLoading,
    filesLoading, setFilesLoading, setPropertyCache,
    isPropertyDataCached, cachePropertyData, getCachedPropertyData
  } = propertyData;

  const {
    inputValue, setInputValue, predictions, setPredictions,
    showDropdown, setShowDropdown
  } = searchState;

  const {
    showDetailsModal, setShowDetailsModal, address, setAddress,
    addressLoading, setAddressLoading, snappedLatLng, setSnappedLatLng
  } = modalState;

  const {
    pendingUploads, setPendingUploads, setRenamingFileId
  } = uploadState;

  const {
    setFolderMenuId, setFileMenuId,
    folderMenuRef, fileMenuRef
  } = menuState;

  // Local state and refs
  const [loading, setLoading] = useState(true);
  const justSelectedRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  // Suppresses ghost clicks that fire on the map after touch-dismissing the info card
  const suppressMapClickRef = useRef(false);

  // Track staged zoom behavior for current location (first -> deep)
  const currentLocationZoomStageRef = useRef<'none' | 'first' | 'deep'>('none');
  // Count of pending programmatic zoom changes to ignore in onZoomChanged
  const programmaticZoomChangesRef = useRef(0);
  // Track stage internally only for logic decisions; store in ref to avoid unused state
  const currentLocationStageRef = useRef<'none' | 'first' | 'deep'>('none');

  // Optimistic auth guard: render immediately; redirect only if unauthenticated when check resolves
  useEffect(() => {
    setLoading(false);
    supabase.auth.getUser().then((result) => {
      if (!result.data.user) {
        router.replace('/');
      }
    });
  }, [router]);

  // Load user properties on mount
  useEffect(() => {
    loadUserProperties();
  }, [loadUserProperties]);

  // Save map position when leaving the page
  useEffect(() => {
    const saveMapPosition = () => {
      if (map && typeof window !== 'undefined') {
        const center = map.getCenter();
        const currentZoom = map.getZoom();
        if (center && currentZoom) {
          const position = {
            lat: center.lat(),
            lng: center.lng(),
            zoom: currentZoom
          };
          sessionStorage.setItem('droppoint-map-position', JSON.stringify(position));
        }
      }
    };

    // Save position when user navigates away
    const handleBeforeUnload = () => {
      saveMapPosition();
    };

    // Save position when component unmounts
    const handleUnload = () => {
      saveMapPosition();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
      
      // Also save when routing occurs (Next.js specific)
      const handleRouteChange = () => {
        saveMapPosition();
      };
      
      router.events?.on('routeChangeStart', handleRouteChange);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('unload', handleUnload);
        router.events?.off('routeChangeStart', handleRouteChange);
      };
    }
  }, [map, router]);

  // Background preload user properties for instant list view
  useEffect(() => {
    const preloadUserProperties = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
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
          }
        }
      } catch (error) {
        logger.error('[PRELOAD] Error preloading properties:', error);
      }
    };

    // Start preloading after a short delay to not block initial map load
    const timer = setTimeout(preloadUserProperties, 1000);
    return () => clearTimeout(timer);
  }, [
    setMapCenter,
    setZoom,
    setSavedProperty,
    setPropertyFiles,
    setFolders,
    setSelectedFolder,
    setFoldersLoading,
    setFilesLoading,
    setAddress,
    setSnappedLatLng,
    setShowDetailsModal
  ]);

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
        } catch (error) {
          logger.error('Error parsing saved map position:', error);
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
          logger.error('Error parsing saved property data:', error);
        }
      }
    }
  }, []);

  // NOTE: in-app focus current location listener is attached after handler declaration (below)

  // Resolve initial center BEFORE the map displays to avoid flashes from US center -> current location
  useEffect(() => {
    if (initialCenterResolved) return;

    let resolved = false;
    const resolveFallback = async () => {
      if (resolved) return;
      resolved = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: properties } = await supabase
            .from('properties')
            .select('lat,lng')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (properties && properties.length > 0) {
            setMapCenter({ lat: properties[0].lat, lng: properties[0].lng });
            setZoom(14);
            setInitialCenterResolved(true);
            return;
          }
        }
      } catch {}
      setMapCenter(US_CENTER);
      setZoom(5);
      setInitialCenterResolved(true);
    };

    const focusCurrent = typeof window !== 'undefined' && sessionStorage.getItem('droppoint-focus-current') === '1';
    if (focusCurrent) {
      try { sessionStorage.removeItem('droppoint-focus-current'); } catch {}
      // Pre-arm: next tap will deep-zoom if we are already at initial zoom.
      currentLocationZoomStageRef.current = 'first';
      currentLocationStageRef.current = 'first';
    }

    // If the user has a previously saved map position and we're not forcing current location,
    // restore that position immediately (already loaded by useMapState) and skip geolocation.
    const hasSavedPosition = typeof window !== 'undefined' && !!sessionStorage.getItem('droppoint-map-position');
    if (!focusCurrent && hasSavedPosition) {
      setInitialCenterResolved(true);
      return;
    }

    // No saved position (or explicit focusCurrent): try geolocation so the map opens at the
    // user's current location. Wait for the browser permission dialog — no short fallback timer.
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (resolved) return;
          resolved = true;
          setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          setZoom(DEFAULT_ZOOM);
          currentLocationZoomStageRef.current = 'none';
          currentLocationStageRef.current = 'none';
          setInitialCenterResolved(true);
        },
        () => {
          resolveFallback();
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    } else {
      resolveFallback();
    }
  }, [initialCenterResolved, setInitialCenterResolved, setMapCenter, setZoom]);

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
  }, [inputValue, setPredictions]);



  // (Removed) Per-tick zoom sync to avoid jank; zoom is now synced on 'idle'

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
  }, [setMapType]);

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
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
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
      logger.error('📍 [GEOCODE] Error fetching address:', error);
      
      let errorAddress = 'Error fetching address';
      
      // Check if it's a JSON parsing error
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        logger.error('📍 [GEOCODE] JSON parsing error - likely API key issue');
        errorAddress = 'Address lookup failed - check API key';
      }
      
      setAddress(errorAddress);
      setSnappedLatLng(null);
      saveAddressToCache(lat, lng, errorAddress, null);
    }
    setAddressLoading(false);
  }, [setAddress, setAddressLoading, setSnappedLatLng]); // State setters are stable, cache utilities are pure

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
      logger.error('Error fetching predictions:', error);
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
      logger.error('Error geocoding place ID:', error);
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
      
      // Handle synthetic user property predictions (place_id starts with 'user_property_')
      if (prediction.place_id.startsWith('user_property_')) {
        const propertyId = prediction.property_id;
        if (propertyId) {
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
      } else {
        // Handle Google prediction that matches a user property
        const propertyId = prediction.property_id;
        if (propertyId) {
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
        setFolders(cached.folders);
        setPropertyFiles(cached.files);
        setFoldersLoading(false);
        setFilesLoading(false);
        return;
      }

      
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
      logger.error('Error fetching property data:', error);
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
    
    if (!trimmedNewName || trimmedNewName === originalName) {
      setRenamingFileId(null);
      return;
    }
  
    // Type guard
    const isFile = 'file_name' in item;
    try {
      if (isFile) {
        const file = item as PropertyFile;
        
        // Sanitize the new filename for storage
        const sanitizedNewName = sanitizeFileName(trimmedNewName);
        
        if (!sanitizedNewName) {
          throw new Error('Invalid file name after sanitization.');
        }
        
        // File-specific logic
        const existingFile = propertyFiles.find(f => f.folder_id === file.folder_id && f.file_name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== file.id);
        if (existingFile) {
          throw new Error('A file with this name already exists in this folder.');
        }

        // Use service to rename file
        const updatedFile = await fileService.renameFile(file, sanitizedNewName);
        setPropertyFiles(files => files.map(f => f.id === file.id ? updatedFile : f));
        
      } else {
        const folder = item as PropertyFolder;
        
        // For folders, we can be less restrictive with sanitization
        const sanitizedNewName = trimmedNewName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
        
        // Folder-specific logic
        const existingFolder = folders.find(f => f.parent_id === folder.parent_id && f.name.toLowerCase() === sanitizedNewName.toLowerCase() && f.id !== folder.id);
        if (existingFolder) {
          throw new Error('A folder with this name already exists here.');
        }
        
        // Use service to rename folder
        const updatedFolder = await folderService.renameFolder(folder, sanitizedNewName);
        setFolders(folders => folders.map(f => f.id === folder.id ? updatedFolder : f));
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Rename failed';
      logger.error('[RENAME] Rename operation failed:', errorMessage);
      showToast(`Rename failed: ${errorMessage}`);
    } finally {
      setRenamingFileId(null);
    }
  }

  // Handler for deleting a file
  async function handleDeleteFile(file: PropertyFile) {
    if (!file) return;

    const isConfirmed = window.confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`);

    if (isConfirmed) {
        try {
            // Use service to delete file
            await fileService.deleteFile(file);

            // Update local state
            setPropertyFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
            showToast(`Failed to delete file: ${errorMessage}`);
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
        showToast('Folder must be empty before it can be deleted.', 'warning');
        setFolderMenuId(null);
        return;
    }

    const isConfirmed = window.confirm(`Are you sure you want to delete the folder "${folder.name}"?`);

    if (isConfirmed) {
        try {
            // Use service to delete folder
            await folderService.deleteFolder(folder.id);

            // Update local state
            setFolders(prevFolders => prevFolders.filter(f => f.id !== folder.id));
        
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete folder';
            showToast(`Failed to delete folder: ${errorMessage}`);
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

      // Resolve property id locally
      let propertyId: string | null = savedProperty?.id ?? null;

      // Ensure property is saved before creating folders
      if (!propertyId) {
        if (!savedProperty) {
          showToast('Please select a property first.', 'warning');
          return;
        }
        try {
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

          if (saveError || !newProperty) {
            logger.error('📁 [FOLDERS] Error auto-saving property before folder creation:', saveError);
            showToast('Failed to save property. Please try again.');
            return;
          }

          // Update state and capture id for immediate use
          setSavedProperty(newProperty);
          propertyId = newProperty.id;

          // Optional: refresh pins (non-blocking)
          loadUserProperties();
        } catch (err) {
          logger.error('📁 [FOLDERS] Unexpected error auto-saving property:', err);
          showToast('Failed to save property. Please try again.');
          return;
        }
      }

      if (!propertyId) {
        showToast('Failed to resolve property. Please try again.');
        return;
      }

      const parentId = selectedFolder === 'master' ? null : selectedFolder;

      const { data, error } = await supabase
        .from('property_folders')
        .insert({
          property_id: propertyId,
          user_id: user.id,
          parent_id: parentId,
          name: trimmed,
        })
        .select('*')
        .single();

      if (error) {
        logger.error('📁 [FOLDERS] Error creating folder:', error);
        showToast('Could not create folder. Please try again.');
        return;
      }

      if (data) {
        setFolders(prev => [...prev, data]);
      }
    } catch (err) {
      logger.error('📁 [FOLDERS] Unexpected error creating folder:', err);
      showToast('Could not create folder. Please try again.');
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
  }, [savedProperty?.id, setPendingUploads]);

  // File utility functions moved to utils/fileManagement.ts

  // File upload handling
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }
    
    if (!savedProperty) {
      showToast('Please select a property first before uploading files.', 'warning');
      return;
    }

    let propertyId: string = savedProperty.id || '';
    
    // If property doesn't have an ID yet, save it to the database first
    if (!propertyId) {
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          showToast('You must be logged in to upload files.');
          return;
        }

        // Save the property to the database using service
        const newProperty = await propertyService.createProperty({
          address: savedProperty.address,
          lat: savedProperty.lat,
          lng: savedProperty.lng,
          label: savedProperty.label,
          notes: savedProperty.notes
        });

        // Update the saved property with the new ID
        if (!newProperty.id) {
          throw new Error('Property could not be saved. Please try again.');
        }
        propertyId = newProperty.id;
        setSavedProperty(newProperty);
        
        // Refresh user properties to show the new property as a permanent pin
        await loadUserProperties();
        
        // Add small delay to ensure property is fully propagated in Supabase
        // This is especially important on mobile networks with higher latency
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify the property was actually saved and is accessible
        const verified = await propertyService.verifyProperty(propertyId);
        if (!verified) {
          throw new Error('Property was not properly saved. Please try again.');
        }
        
      } catch (error) {
        logger.error('📁 [UPLOAD] Error auto-saving property:', error);
        showToast('Failed to save property. Please try again.');
        return;
      }
    }

    const folderIdForUpload = selectedFolder === 'master' ? null : selectedFolder;
    
    const filesArray = Array.from(files);

    // Create pending uploads for each file
    const newPendingUploads: PendingUpload[] = filesArray.map(file => {
      // Generate unique file name for this folder
      const existingFiles = propertyFiles.filter(f => 
        folderIdForUpload ? f.folder_id === folderIdForUpload : !f.folder_id
      );
      const existingNames = existingFiles.map(f => f.file_name);
      
      const baseName = sanitizeFileName(file.name); // Sanitize the original filename first
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
      
      // Create abort controller for cancellation
      const abortController = new AbortController();
      
      const cancel = () => {
        abortController.abort();
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      };

      const retry = () => {
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
      throw new Error('User not authenticated');
    }
    
    // Enforce free-tier quota before uploading
    try {
      const usedBytes = await getUserUsageBytes(user.id);
      const projected = usedBytes + file.size;
      if (projected > FREE_TIER_MAX_BYTES) {
        showToast('Storage limit reached (5 GB). Delete files to free up space.', 'warning');
        // Remove pending upload entry if present
        setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
        return;
      }
    } catch (err) {
      logger.error('[USAGE] Failed to check usage. Blocking upload for safety.', err);
      showToast('Unable to verify storage usage. Please try again shortly.');
      setPendingUploads(prev => prev.filter(p => p.id !== uploadId));
      return;
    }
    
    // Optimized upload with single progress update
    const filePath = `${propertyId}/${uniqueName}`;
    
    try {
      // Upload file using service
      await fileService.uploadFile(file, propertyId, uniqueName, folderIdForUpload);

      // Update progress to 90% after storage upload
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, progress: 90 } : p
      ));

      // Create database record using service (with retry logic built-in)
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
          break; // Success
        } catch (error) {
          lastError = error;
          retryCount++;
          if (retryCount < maxRetries) {
            const waitTime = 500 * retryCount;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (retryCount >= maxRetries && lastError) {
        throw lastError;
      }
      
      // Mark as successful
      setPendingUploads(prev => prev.map(p => 
        p.id === uploadId ? { ...p, status: 'success', progress: 100 } : p
      ));

      // Refresh file list using service
      const files = await fileService.getPropertyFiles(propertyId);
      setPropertyFiles(files);
      
      // Update cache immediately for instant access
      const currentAddress = address || '';
      if (currentAddress) {
        const cacheKey = `${user.id}-${currentAddress}`;
        setPropertyCache(prev => ({
          ...prev,
          [cacheKey]: {
            files,
            folders: prev[cacheKey]?.folders || [],
            lastFetched: Date.now()
          }
        }));
      }

    } catch (error) {
      logger.error('[UPLOAD] Upload failed:', error);
      
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
  }, [fileMenuRef, folderMenuRef, setFileMenuId, setFolderMenuId]);

  // Menu state is now managed by useMenuState hook

  // Utility function moved to utils/fileManagement.ts

  // File/folder sorting and filtering moved to PropertyDetailsModal


  // Utility function moved to utils/fileManagement.ts

  // FileIcon component moved to src/components/FileIcon.tsx









  // Add state for current location loading
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  // Suppress linting warning - keeping for potential future use
  void currentLocationLoading;

  // Track property card height for mobile controls positioning
  const [propertyCardHeight, setPropertyCardHeight] = useState(0);

  // Track if property details were opened from the List page
  const [cameFromListView, setCameFromListView] = useState(false);

  // Current location handler
  const handleCurrentLocationClick = useCallback(() => {
    // Clear any selected property/address when focusing on current location
    setSelectedProperty(null);
    setAddress('');
    setAddressLoading(false);
    
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser.');
      return;
    }

    // Helper function to handle successful position retrieval
    const handlePositionSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const newCenter = { lat: latitude, lng: longitude };
      
      // Keep it simple: always perform a visible action.
      const mediumZoom = CURRENT_LOCATION_ZOOM;
      const deepZoom = CURRENT_LOCATION_ZOOM_DEEP;
      const currentZoom = map?.getZoom?.() ?? zoom;
      const centerNowA = map?.getCenter?.();
      const isCloseToLocation = centerNowA
        ? (Math.abs(centerNowA.lat() - newCenter.lat) < COORDINATE_THRESHOLD && Math.abs(centerNowA.lng() - newCenter.lng) < COORDINATE_THRESHOLD)
        : (Math.abs(mapCenter.lat - newCenter.lat) < COORDINATE_THRESHOLD && Math.abs(mapCenter.lng - newCenter.lng) < COORDINATE_THRESHOLD);
      const isAtMediumZoom = Math.abs((currentZoom || 0) - mediumZoom) < 0.25;

      let targetZoom = mediumZoom;
      if (currentLocationZoomStageRef.current === 'none' || !isCloseToLocation) {
        // If stage is 'none' (reset after user interaction) or moved away, always go to medium zoom first
        targetZoom = mediumZoom;
        currentLocationZoomStageRef.current = 'first';
        currentLocationStageRef.current = 'first';
      } else if (currentLocationZoomStageRef.current === 'first' && isAtMediumZoom) {
        // Already at medium zoom and in 'first' stage → deep zoom
        targetZoom = deepZoom;
        currentLocationZoomStageRef.current = 'deep';
        currentLocationStageRef.current = 'deep';
      } else {
        // Default: go to medium zoom
        targetZoom = mediumZoom;
        currentLocationZoomStageRef.current = 'first';
        currentLocationStageRef.current = 'first';
      }

      // Update map center and zoom programmatically (avoid resetting stage)
      // If user is already very close to the target center, avoid an extra panTo
      const centerNowB = map?.getCenter?.();
      const isClose = centerNowB
        ? (Math.abs(centerNowB.lat() - newCenter.lat) < COORDINATE_THRESHOLD && Math.abs(centerNowB.lng() - newCenter.lng) < COORDINATE_THRESHOLD)
        : false;
      const forcePan = true;
      setMapCenter(newCenter);
      setZoom(targetZoom);
      if (map) {
        if (!isClose || forcePan) map.panTo(newCenter);
        // Track programmatic zoom change
        programmaticZoomChangesRef.current += 1;
        map.setZoom(targetZoom);
      }

      // Clear search input
      setInputValue('');
      
      // Check cache first
      const cached = getAddressFromCache(latitude, longitude);
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
        fetchAddress(latitude, longitude);
      }
      
      setCurrentLocationLoading(false);
    };

    // Helper function to handle errors with fallback
    const handlePositionError = (error: GeolocationPositionError, isFallback: boolean = false) => {
      logger.error('[GEOLOCATION] Error:', {
        code: error.code,
        message: error.message,
        isFallback
      });

      // If permission is denied, don't try fallback - show error immediately
      if (error.code === error.PERMISSION_DENIED) {
        setCurrentLocationLoading(false);
        currentLocationZoomStageRef.current = 'none';
        currentLocationStageRef.current = 'none';
        
        showToast('Location access denied. Enable location permissions in your browser settings.');
        return;
      }

      // If high accuracy failed with POSITION_UNAVAILABLE or TIMEOUT, try fallback with lower accuracy
      if (!isFallback && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname === '');
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            handlePositionSuccess(position);
          },
          (fallbackError) => {
            logger.error('[GEOLOCATION] Fallback also failed:', fallbackError.message);
            handlePositionError(fallbackError, true);
          },
          {
            enableHighAccuracy: false, // Allow IP/WiFi-based positioning
            timeout: isLocalhost ? 30000 : 25000, // Even longer timeout for lower accuracy (30s on localhost, 25s otherwise)
            maximumAge: 900000 // Accept cached location up to 15 minutes (very lenient)
          }
        );
        return;
      }

      // Both attempts failed or other error - show alert
      setCurrentLocationLoading(false);
      currentLocationZoomStageRef.current = 'none';
      currentLocationStageRef.current = 'none';

      // Comprehensive diagnostic information
      const diagnostics = {
        errorCode: error.code,
        errorMessage: error.message,
        wasFallback: isFallback,
        attempts: isFallback ? 'Both high accuracy and low accuracy failed' : 'Single attempt failed',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: new Date().toISOString()
      };
      
      logger.error('[GEOLOCATION] DIAGNOSTICS - Both attempts failed:', diagnostics);
      
      let errorMessage = 'Unable to retrieve your location.';
      let debugInfo = '';
      
      switch (error.code) {
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location Services Unavailable';
          const browserName = typeof navigator !== 'undefined' 
            ? (navigator.userAgent.includes('Chrome') ? 'Chrome' : 
               navigator.userAgent.includes('Safari') ? 'Safari' : 
               navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser')
            : 'Browser';
          
          debugInfo = `Diagnostics show this is a SYSTEM-LEVEL issue, not an app issue:\n\n` +
            `Browser permissions: GRANTED\n` +
            `macOS Location Services: Enabled (confirmed)\n` +
            `GPS location: Unavailable\n` +
            `IP/WiFi location: Unavailable\n\n` +
            `Troubleshooting Steps:\n\n` +
            `1. Try Safari - Open this site in Safari to test if it's a Chrome-specific issue\n` +
            `2. Restart Chrome - Close all Chrome windows and reopen\n` +
            `3. Check System Preferences:\n` +
            `   • System Preferences > Security & Privacy > Privacy > Location Services\n` +
            `   • Make sure ${browserName} is checked and enabled\n` +
            `   • Try unchecking and re-checking ${browserName}\n` +
            `4. Disable VPN - If you're using a VPN, try disabling it temporarily\n` +
            `5. Test other sites - Visit maps.google.com and see if it can get your location\n` +
            `6. Restart macOS - Sometimes location services need a system restart\n\n` +
            `If Safari works but Chrome doesn't: Chrome may need to be re-authorized.\n` +
            `If neither works: macOS Location Services may need repair.`;
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out.';
          debugInfo = 'Both attempts timed out. This suggests location services are slow or blocked.';
          break;
        default:
          errorMessage = `Location error (${error.code}): ${error.message}`;
          debugInfo = 'An unexpected geolocation error occurred.';
      }
      
      showToast(errorMessage);
    };

    setCurrentLocationLoading(true);
    
    // Try a different approach: use watchPosition with a timeout instead of getCurrentPosition
    // watchPosition sometimes works better in certain browsers/situations
    let watchId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let positionReceived = false;
    
    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    
    const attemptWatch = (useHighAccuracy: boolean) => {
      const options: PositionOptions = {
        enableHighAccuracy: useHighAccuracy,
        timeout: 30000, // 30 second timeout
        maximumAge: 86400000 // Accept cached up to 24 hours
      };
      
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!positionReceived) {
            positionReceived = true;
            cleanup();
            handlePositionSuccess(position);
          }
        },
        (error) => {
          if (positionReceived) return; // Already handled
          
          logger.error(`[GEOLOCATION] watchPosition error (highAccuracy: ${useHighAccuracy}):`, error);
          
          if (error.code === error.PERMISSION_DENIED) {
            cleanup();
            handlePositionError(error, false);
            return;
          }
          
          // If this was low accuracy attempt, try high accuracy
          if (!useHighAccuracy && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            cleanup();
            attemptWatch(true);
            return;
          }
          
          // If high accuracy also failed or other error, fall back to getCurrentPosition
          cleanup();
          
          // Final fallback: try getCurrentPosition with simplest options
          const simpleOptions: PositionOptions = {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 86400000
          };
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              handlePositionSuccess(position);
            },
            (error) => {
              logger.error('[GEOLOCATION] All methods failed:', error);
              handlePositionError(error, true);
            },
            simpleOptions
          );
        },
        options
      );
      
      // Set a timeout to cancel watch if it takes too long
      timeoutId = setTimeout(() => {
        if (!positionReceived && watchId !== null) {
          cleanup();
          if (!useHighAccuracy) {
            attemptWatch(true);
          } else {
            // Try getCurrentPosition as final fallback
            navigator.geolocation.getCurrentPosition(
              (position) => {
                handlePositionSuccess(position);
              },
              (error) => {
                logger.error('[GEOLOCATION] All location methods exhausted:', error);
                handlePositionError(error, true);
              },
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 86400000 }
            );
          }
        }
      }, 35000); // 35 second timeout (slightly longer than watchPosition timeout)
    };
    
    // Start with low accuracy watch
    attemptWatch(false);
  }, [
    map,
    isPropertyDataCached,
    cachePropertyData,
    zoom,
    mapCenter.lat,
    mapCenter.lng,
    fetchAddress,
    setSelectedProperty,
    setAddress,
    setAddressLoading,
    setInputValue,
    setMapCenter,
    setSnappedLatLng,
    setZoom,
    setCurrentLocationLoading
  ]);

  // Zoom handlers for mobile controls
  const handleZoomIn = useCallback(() => {
    if (map) {
      const currentZoom = map.getZoom() || zoom;
      const newZoom = Math.min(currentZoom + 1, 21); // Max zoom is 21
      map.setZoom(newZoom);
      setZoom(newZoom);
    }
  }, [map, zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    if (map) {
      const currentZoom = map.getZoom() || zoom;
      const newZoom = Math.max(currentZoom - 1, 1); // Min zoom is 1
      map.setZoom(newZoom);
      setZoom(newZoom);
    }
  }, [map, zoom, setZoom]);

  // Support in-app focus current location requests (from bottom nav Map when already on map)
  useEffect(() => {
    const handler = () => {
      handleCurrentLocationClick();
    };
    window.addEventListener('droppoint-focus-current-request', handler);
    return () => window.removeEventListener('droppoint-focus-current-request', handler);
  }, [handleCurrentLocationClick]);

  // Support toggling map type when user taps Map tab while already on the Map page
  useEffect(() => {
    const toggleHandler = () => {
      setMapType((prev) => (prev === 'roadmap' ? 'hybrid' : prev === 'hybrid' ? 'satellite' : 'roadmap'));
    };
    window.addEventListener('droppoint-toggle-map-type', toggleHandler);
    return () => window.removeEventListener('droppoint-toggle-map-type', toggleHandler);
  }, [setMapType]);

  // Pre-warm the most recently visited properties so the first pin click is instant.
  // Fires once after the property list loads, staggered to avoid competing with the
  // initial page render. Properties are already ordered by updated_at desc.
  useEffect(() => {
    if (!propertiesLoaded || userProperties.length === 0) return;
    const toPreload = userProperties.slice(0, 5);
    toPreload.forEach((p, i) => {
      if (p.id) setTimeout(() => prefetchPropertyData(p.id!), i * 300);
    });
  }, [propertiesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle map click to drop new pin
  const handleMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;

    // Eat ghost clicks: either the explicit suppress flag set by onClose,
    // or a recent touch anywhere on the page (belt-and-suspenders).
    if (suppressMapClickRef.current || wasRecentTouch()) {
      suppressMapClickRef.current = false;
      return;
    }

    // Don't drop pins if search is focused or if search elements are visible
    if (showDropdown || document.activeElement?.tagName === 'INPUT') {
      return;
    }
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    // Check if this might be a double-click by tracking recent clicks
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    lastClickTimeRef.current = currentTime;
    
    // If clicks are happening rapidly (within 300ms), it's likely a double-click for zoom
    if (timeSinceLastClick < 300) {
      return; // Don't drop pins during double-clicking
    }
    
    // Add a small delay to detect if this is part of a double-click sequence
    setTimeout(async () => {
      // Check if another click happened shortly after (indicating double-click)
      if (Date.now() - lastClickTimeRef.current < 250) {
        return;
      }
      
      // Single click confirmed - proceed with pin drop
      // Clear any existing selected property that isn't saved
      if (selectedProperty && !selectedProperty.id) {
        setSelectedProperty(null);
      }
      
      // Get a human-readable address for the pin location
      setAddressLoading(true);
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.results && data.results[0]) {
          const address = data.results[0].formatted_address;
          
          // Create new property for pin using EXACT clicked coordinates
          // Users can drop pins wherever they want, not snapped to geocoding API location
          const newProperty: Property = {
            id: null, // Will be assigned when saved
            address,
            lat: lat, // Use exact clicked coordinates
            lng: lng, // Use exact clicked coordinates
            label: null,
            notes: null,
          };
          
          // Set as current property and show info card
          setSelectedProperty(newProperty);
          setAddress(address);
          // Don't set snappedLatLng - we're using exact coordinates
          setSnappedLatLng(null);
          
          // Cache the address with exact coordinates
          saveAddressToCache(lat, lng, address, { lat, lng });
        } else {
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
        logger.error('[PINS] Address lookup failed:', error);
        // Keep the original property with coordinates - no error handling needed
      } finally {
        setAddressLoading(false);
      }
    }, 250); // Wait 250ms to detect double-click
  }, [selectedProperty, showDropdown, setSelectedProperty, setAddressLoading, setAddress, setSnappedLatLng]);

  // Handle property pin click - show selection card and prefetch in background
  const handlePropertyPinClick = useCallback(async (property: Property) => {
    // Clear old property data only when switching to a different property
    if (savedProperty && savedProperty.id && savedProperty.id !== property.id) {
      setFolders([]);
      setPropertyFiles([]);
    }

    setSelectedFolder('master');
    setSelectedProperty(property);
    setSavedProperty(property);
    setAddress(property.address);
    setSnappedLatLng({ lat: property.lat, lng: property.lng });

    // Fast path: synchronous module-level cache hit (pre-warmed on hover or on load)
    if (property.id) {
      const cached = getPropertyDataSync(property.id);
      if (cached) {
        setFolders(cached.folders);
        setPropertyFiles(cached.files);
        setFoldersLoading(false);
        setFilesLoading(false);
        return;
      }
    }

    // Slow path: fetch from Supabase
    if (property.id) {
      setFoldersLoading(true);
      setFilesLoading(true);
      try {
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

          if (folderResult.data) setFolders(folderResult.data);
          if (filesResult.data) setPropertyFiles(filesResult.data);
          if (folderResult.data && filesResult.data) {
            setPropertyDataCache(property.id, filesResult.data, folderResult.data);
            void cachePropertyData(property.address, filesResult.data, folderResult.data);
          }
        }
      } catch (error) {
        logger.error('📍 [PINS] Error loading property data:', error);
      } finally {
        setFoldersLoading(false);
        setFilesLoading(false);
      }
    } else {
      setFolders([]);
      setPropertyFiles([]);
    }

    // Do not open modal immediately; wait for user to confirm via selection card
  }, [
    savedProperty,
    setFolders,
    setPropertyFiles,
    setSelectedFolder,
    setSelectedProperty,
    setSavedProperty,
    setAddress,
    setSnappedLatLng,
    setFoldersLoading,
    setFilesLoading,
    cachePropertyData,
  ]);

  // Handle sidebar property click — skip PropertyInfoCard floater, open modal directly
  const handleSidebarPropertySelect = useCallback(async (property: Property) => {
    // Clear old data only when switching to a different property
    if (savedProperty && savedProperty.id && savedProperty.id !== property.id) {
      setFolders([]);
      setPropertyFiles([]);
    }

    setSelectedFolder('master');
    setSavedProperty(property);
    setAddress(property.address);
    setSnappedLatLng({ lat: property.lat, lng: property.lng });

    // Pan map to property
    if (map) {
      map.panTo({ lat: property.lat, lng: property.lng });
      map.setZoom(SEARCH_ZOOM);
    }
    setMapCenter({ lat: property.lat, lng: property.lng });
    setZoom(SEARCH_ZOOM);

    // Open modal immediately — no confirmation card needed
    setShowDetailsModal(true);

    // Fast path: synchronous module-level cache hit
    if (property.id) {
      const cached = getPropertyDataSync(property.id);
      if (cached) {
        setFolders(cached.folders);
        setPropertyFiles(cached.files);
        setFoldersLoading(false);
        setFilesLoading(false);
        return;
      }
    }

    // Slow path: fetch from Supabase
    if (property.id) {
      setFoldersLoading(true);
      setFilesLoading(true);
      try {
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
          if (folderResult.data) setFolders(folderResult.data);
          if (filesResult.data) setPropertyFiles(filesResult.data);
          if (folderResult.data && filesResult.data) {
            setPropertyDataCache(property.id, filesResult.data, folderResult.data);
            void cachePropertyData(property.address, filesResult.data, folderResult.data);
          }
        }
      } catch (error) {
        logger.error('[SIDEBAR] Error loading property data:', error);
      } finally {
        setFoldersLoading(false);
        setFilesLoading(false);
      }
    } else {
      setFolders([]);
      setPropertyFiles([]);
    }
  }, [
    savedProperty, map,
    setFolders, setPropertyFiles, setSelectedFolder, setSavedProperty,
    setAddress, setSnappedLatLng, setMapCenter, setZoom,
    setShowDetailsModal, setFoldersLoading, setFilesLoading, cachePropertyData,
  ]);

  // Handle property selection from quick access
  const handleQuickAccessPropertySelect = useCallback(async (property: PropertyWithFileCount) => {
    
    // Convert PropertyWithFileCount to Property
    const propertyObj: Property = {
      id: property.id,
      address: property.address,
      lat: property.lat,
      lng: property.lng,
      label: property.label,
      notes: property.notes,
    };
    
    // Center map on the selected property
    if (map) {
      map.panTo({ lat: property.lat, lng: property.lng });
      map.setZoom(SEARCH_ZOOM); // Use same zoom as search
    }
    setMapCenter({ lat: property.lat, lng: property.lng });
    setZoom(SEARCH_ZOOM);
    
    // Handle the property selection (same as clicking a pin)
    await handlePropertyPinClick(propertyObj);
  }, [map, handlePropertyPinClick, setMapCenter, setZoom]);

  // Handle map container click - close dropdown and blur inputs
  const handleMapContainerClick = useCallback(() => {
    setShowDropdown(false);
    // Also blur any focused input to ensure search is completely unfocused
    if (document.activeElement?.tagName === 'INPUT') {
      (document.activeElement as HTMLElement).blur();
    }
  }, [setShowDropdown]);

  // Close details modal; navigate back to list if initiated from there
  const handleDetailsModalClose = useCallback(() => {
    setShowDetailsModal(false);
    try {
      const cameFrom = typeof window !== 'undefined' ? sessionStorage.getItem('droppoint-came-from-list') : null;
      if (cameFrom === '1') {
        sessionStorage.removeItem('droppoint-came-from-list');
        router.push('/list');
        return;
      }
    } catch {}
    if (cameFromListView) {
      setCameFromListView(false);
      router.push('/list');
    }
  }, [cameFromListView, router, setShowDetailsModal, setCameFromListView]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${mobileClasses.fullScreen}`}
           style={getMobileStyles('page')}>
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <Head>
        <title>Map View - DropPoint Real Estate Document Management</title>
        <meta name="description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
        <meta property="og:title" content="Map View - DropPoint Real Estate Document Management" />
        <meta property="og:description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
        <meta property="twitter:title" content="Map View - DropPoint Real Estate Document Management" />
        <meta property="twitter:description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
      </Head>
      <WebSidebar
        properties={userProperties}
        selectedPropertyId={savedProperty?.id}
        onPropertySelect={handleSidebarPropertySelect}
      />
      <div className={`flex-1 relative overflow-hidden ${mobileClasses.fullScreen}`}
           style={getMobileStyles('page')}>
      {/* Google Maps loader */}
      {!isLoaded || !initialCenterResolved ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading map…</p>
        </div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center text-red-600">Failed to load map.</div>
      ) : (
        <div className="w-full h-full" onClick={handleMapContainerClick}>
          <GoogleMap
          mapContainerStyle={mapContainerStyleWithSidebar}
          center={mapCenter}
          onLoad={(mapInstance) => {
            setMap(mapInstance);
            // Set initial zoom once; let gestures control subsequent zoom levels
            if (typeof zoom === 'number') {
              mapInstance.setZoom(zoom);
            }
            // Mark first idle when map stabilizes
            mapInstance.addListener('idle', () => {
              setMapFirstIdle(true);
              // Sync zoom only after interactions settle to avoid jank on mobile
              const z = mapInstance.getZoom();
              if (z !== undefined && z !== null) {
                setZoom(z);
              }
              // Save map position when interactions settle
              saveMapPositionThrottled();
            });
          }}
          onClick={handleMapClick}
          onDblClick={() => {
            // Google Maps will handle the zoom automatically
            // Just update our click tracking to prevent pin drops
            lastClickTimeRef.current = Date.now();
            // Don't reset stage on double-click zoom
          }}
          onZoomChanged={() => {
            // Avoid per-tick zoom state updates during pinch to keep interactions smooth
            // Ignore zoom changes until we've resolved initial center
            if (!initialCenterResolved) return;
            if (programmaticZoomChangesRef.current > 0) {
              programmaticZoomChangesRef.current -= 1;
              return;
            }
            // Don't reset stage on zoom - let users zoom without losing button state
          }}
          onDragStart={() => {
            currentLocationZoomStageRef.current = 'none';
            currentLocationStageRef.current = 'none';
          }}
          onDragEnd={() => {
            currentLocationZoomStageRef.current = 'none';
            currentLocationStageRef.current = 'none';
            // Save map position after dragging
            if (map && typeof window !== 'undefined') {
              const center = map.getCenter();
              const currentZoom = map.getZoom();
              if (center && currentZoom) {
                const position = {
                  lat: center.lat(),
                  lng: center.lng(),
                  zoom: currentZoom
                };
                sessionStorage.setItem('droppoint-map-position', JSON.stringify(position));
              }
            }
          }}
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
          {/* Property pins - render only after propertiesLoaded to reduce re-renders */}
          {propertiesLoaded && userProperties.map((property) => (
            <Marker
              key={property.id || `temp-${property.lat}-${property.lng}`}
              position={{ lat: property.lat, lng: property.lng }}
              icon={createPropertyPinIcon(selectedProperty?.id === property.id)}
              onClick={() => handlePropertyPinClick(property)}
              onMouseOver={() => property.id && prefetchPropertyData(property.id)}
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

          {/* Current location indicator with blue dot and accuracy circle */}
          <CurrentLocationIndicator 
            map={map}
            isVisible={true}
          />
        </GoogleMap>
        </div>
      )}
        {/* Defer overlays until map is first idle to avoid layout flashes */}
        {(mapFirstIdle || !isLoaded) && (
          <MapSearch
          onPlaceSelect={selectPredictionByPrediction}
          inputValue={inputValue}
          onInputChange={setInputValue}
          predictions={predictions}
          onPredictionsChange={setPredictions}
          onShowDropdownChange={setShowDropdown}
          onPropertySelect={handleQuickAccessPropertySelect}
          />
        )}
        {(mapFirstIdle || !isLoaded) && (
                    <MapControls
            mapType={mapType}
            onMapTypeChange={setMapType}
            showDropdown={showDropdown}
            onCurrentLocationClick={handleCurrentLocationClick}
            showPropertyInfoCard={Boolean(selectedProperty && address)}
            isPropertyModalOpen={showDetailsModal}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            propertyCardHeight={selectedProperty && address ? propertyCardHeight : 0}
            selectedProperty={selectedProperty}
          />
        )}

        {/* Mobile bottom nav */}
        <MobileBottomNav onList={() => router.push('/list')} />

        {/* Show PropertyInfoCard for both newly dropped and existing pins */}
        {selectedProperty && address && (
          <PropertyInfoCard
            address={address}
            addressLoading={addressLoading}
            property={selectedProperty}
            onMouseEnter={() => {}}
            onMouseLeave={() => {}}
            onClose={() => {
              // Suppress the ghost click that fires on the map ~300ms after a touch dismiss
              suppressMapClickRef.current = true;
              setTimeout(() => { suppressMapClickRef.current = false; }, 600);
              setSelectedProperty(null);
              setAddress('');
              setPropertyCardHeight(0);
            }}
            onPropertyUpdate={(updatedProperty) => {
              setSelectedProperty(updatedProperty);
              setSavedProperty(updatedProperty);
              // Update the property in the userProperties list
              setUserProperties(prev => 
                prev.map(p => p.id === updatedProperty.id ? updatedProperty : p)
              );
            }}
            onPropertySave={async (propertyToSave) => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  logger.error('No user found for property save');
                  return;
                }

                // Save the property to database
                const { data: savedPropertyData, error } = await supabase
                  .from('properties')
                  .insert({
                    user_id: user.id,
                    address: propertyToSave.address,
                    lat: propertyToSave.lat,
                    lng: propertyToSave.lng,
                    label: propertyToSave.label,
                    notes: propertyToSave.notes
                  })
                  .select()
                  .single();

                if (error) {
                  logger.error('Error saving property:', error);
                  return;
                }

                // Update the property with the new ID
                const savedProperty = { ...propertyToSave, id: savedPropertyData.id };
                setSelectedProperty(savedProperty);
                setSavedProperty(savedProperty);
                
                // Add to userProperties list
                setUserProperties(prev => [...prev, savedProperty]);
                
              } catch (error) {
                logger.error('Error saving property:', error);
              }
            }}
            onHeightChange={setPropertyCardHeight}
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
                // Existing property: clear old data first if switching properties
                if (savedProperty && savedProperty.id !== selectedProperty.id) {
                  setFolders([]);
                  setPropertyFiles([]);
                }
                // Ensure data is ready (cache or background-fetched), then open modal
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
              setPropertyCardHeight(0); // Reset height when card is closed
            }}
          />
        )}
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-xl p-6 max-w-md mx-4">
                <h2 className="text-xl font-semibold mb-2">Error Loading Property</h2>
                <p className="text-gray-600 mb-4">There was an error loading the property details. Please try again.</p>
                <button
                  onClick={handleDetailsModalClose}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
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
          onFileMove={async (file: PropertyFile, targetFolderId: string | null) => {
            try {
              const movingToDifferentFolder = file.folder_id !== targetFolderId;
              let newFileName: string | undefined = undefined;
              
              if (movingToDifferentFolder) {
                // Generate unique name if needed
                newFileName = sanitizeFileName(getUniqueFileName(file.file_name, targetFolderId, propertyFiles));
                if (!newFileName) {
                  showToast('Invalid file name. Please rename your file and try again.', 'warning');
                  return;
                }
                // Only use new name if it's different
                if (newFileName === file.file_name) {
                  newFileName = undefined;
                }
              }

              // Use service to move file
              const updatedFile = await fileService.moveFile(file, targetFolderId, newFileName);
              
              // Optimistic UI update
              setPropertyFiles(prev => prev.map(f => f.id === file.id ? updatedFile : f));

              // Refresh from server for consistency
              const files = await fileService.getPropertyFiles(file.property_id);
              setPropertyFiles(files);
            } catch (error) {
              logger.error('[MOVE] Error moving file:', error);
              showToast(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          onFileCopy={async (file: PropertyFile) => {
            try {
              // Resolve a non-colliding destination name in the SAME folder.
              // getDuplicateFileName handles the "name - Copy", "name - Copy (2)",
              // ... escalation and also strips an existing copy suffix so a
              // duplicate of a duplicate doesn't become "name - Copy - Copy".
              const duplicateName = getDuplicateFileName(file.file_name, file.folder_id, propertyFiles);
              const sanitized = sanitizeFileName(duplicateName);
              if (!sanitized) {
                showToast('Could not generate a valid duplicate name.', 'warning');
                return;
              }
              const newFile = await fileService.copyFile(file, sanitized);
              // Optimistic insert; we trust the service response.
              setPropertyFiles(prev => [newFile, ...prev]);
              showToast(`Duplicated as "${newFile.file_name}"`, 'success');
            } catch (error) {
              logger.error('[COPY] Error duplicating file:', error);
              showToast(`Failed to duplicate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
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
            
            // Update address and coordinates to match the switched property (for image header update)
            setAddress(property.address);
            setSnappedLatLng({ lat: property.lat, lng: property.lng });
            
          }}
          onMapMove={(lat, lng) => {
            // Update map center when switching properties
            setMapCenter({ lat, lng });
            if (map) {
              map.panTo({ lat, lng });
            }
          }}
        />
        </ErrorBoundary>

      </div>
    </div>
  );
}

// Wrap with auth protection - require authentication
export default withAuth(MapPage, { requireAuth: true });
