import { logger } from '../utils/logger';
import React, { useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useRouter } from 'next/router';
import { PropertyDetailsModal } from '../components/PropertyDetailsModal';
import { MapSearch } from '../components/MapSearch';
import { MapControls } from '../components/MapControls';
import { PropertyInfoCard } from '../components/PropertyInfoCard';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { CurrentLocationIndicator } from '../components/CurrentLocationIndicator';
import { withAuth } from '../components/withAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { useMapState } from '../hooks/useMapState';
import { usePropertyState } from '../hooks/usePropertyState';
import { usePropertyData } from '../hooks/usePropertyData';
import { useSearchState } from '../hooks/useSearchState';
import { useModalState } from '../hooks/useModalState';
import { useSheetHistory } from '../hooks/useSheetHistory';
import { usePropertyFileActions } from '../hooks/usePropertyFileActions';
import { prefetchPropertyData, getPropertyDataSync, setPropertyDataCache, warmHeroImage } from '../hooks/usePropertyPrefetch';
import { useToast } from '../contexts/ToastContext';
import { propertyService } from '../services';
import { supabase } from '../utils/supabaseClient';
import { wasRecentTouch } from '../utils/ghostClick';
import { getAddressFromCache, saveAddressToCache } from '../../utils/propertyCache';
import type { Prediction, Property } from '../../types';
import {
  mapContainerStyleWithSidebar,
  US_CENTER,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAP_LIBRARIES,
  DEFAULT_ZOOM,
  SEARCH_ZOOM,
  CURRENT_LOCATION_ZOOM,
  CURRENT_LOCATION_ZOOM_DEEP,
  COORDINATE_THRESHOLD,
} from '../../constants';

type LatLng = { lat: number; lng: number };

const createPropertyPinIcon = (selected: boolean = false) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="37" rx="6" ry="3" fill="rgba(0,0,0,0.2)"/>
      <path d="M16 2C9.925 2 5 6.925 5 13C5 21.5 16 36 16 36S27 21.5 27 13C27 6.925 22.075 2 16 2Z"
            fill="${selected ? '#1d4ed8' : '#2563eb'}" stroke="white" stroke-width="2"/>
      <path d="M11 12L16 8L21 12V21H19V15H13V21H11V12Z" fill="white"/>
    </svg>
  `)}`,
  scaledSize: new google.maps.Size(32, 40),
  anchor: new google.maps.Point(16, 38),
});

const isNear = (a: LatLng, b: LatLng) =>
  Math.abs(a.lat - b.lat) < COORDINATE_THRESHOLD && Math.abs(a.lng - b.lng) < COORDINATE_THRESHOLD;

/** Reverse-geocode through the server proxy, memoized by coordinates. */
async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; snappedLatLng: LatLng | null } | null> {
  const cached = getAddressFromCache(lat, lng);
  if (cached) return cached;

  const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`Reverse geocode failed: HTTP ${res.status}`);
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;

  const result = {
    address: first.formatted_address as string,
    snappedLatLng: { lat: first.geometry.location.lat, lng: first.geometry.location.lng },
  };
  saveAddressToCache(lat, lng, result.address, result.snappedLatLng);
  return result;
}

function geocodePlaceId(placeId: string): Promise<LatLng | null> {
  return new Promise(resolve => {
    try {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails({ placeId }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        } else {
          resolve(null);
        }
      });
    } catch (error) {
      logger.error('Error geocoding place ID:', error);
      resolve(null);
    }
  });
}

function MapPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'droppoint-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAP_LIBRARIES,
  });
  const router = useRouter();
  const { getMobileStyles, mobileClasses } = useMobileViewport();
  const { showToast } = useToast();

  const {
    mapCenter, setMapCenter, map, setMap, zoom, setZoom, mapType, setMapType,
    mapFirstIdle, setMapFirstIdle, initialCenterResolved, setInitialCenterResolved,
    saveMapPosition, saveMapPositionThrottled, hasSavedPosition,
  } = useMapState();

  const {
    userProperties, setUserProperties, selectedProperty, setSelectedProperty,
    savedProperty, setSavedProperty, propertiesLoaded, loadUserProperties,
  } = usePropertyState();

  const {
    propertyFiles, setPropertyFiles, folders, setFolders,
    selectedFolder, setSelectedFolder, foldersLoading, setFoldersLoading,
    filesLoading, setFilesLoading,
  } = usePropertyData();

  const { inputValue, setInputValue, predictions, setPredictions, showDropdown, setShowDropdown } = useSearchState();

  const {
    showDetailsModal, setShowDetailsModal, address, setAddress,
    addressLoading, setAddressLoading, snappedLatLng, setSnappedLatLng,
  } = useModalState();

  const lastClickTimeRef = useRef(0);
  // Suppresses the ghost click Google Maps receives after touch-dismissing the info card.
  const suppressMapClickRef = useRef(false);
  // First tap on "current location" zooms to neighborhood level; a second tap
  // while already there zooms to street level. Any drag resets the cycle.
  const currentLocationStageRef = useRef<'none' | 'first' | 'deep'>('none');
  // Ignore results from an older property load that resolves after a newer one started.
  const loadRequestRef = useRef(0);

  useEffect(() => {
    loadUserProperties();
  }, [loadUserProperties]);

  // Persist the viewport when navigating to another page.
  useEffect(() => {
    router.events.on('routeChangeStart', saveMapPosition);
    return () => router.events.off('routeChangeStart', saveMapPosition);
  }, [router, saveMapPosition]);

  // Resolve the initial center before showing the map so it doesn't flash
  // from the US center to the real starting point.
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
            setZoom(DEFAULT_ZOOM);
            setInitialCenterResolved(true);
            return;
          }
        }
      } catch {}
      setMapCenter(US_CENTER);
      setZoom(5);
      setInitialCenterResolved(true);
    };

    // The bottom nav sets this flag when the user taps "Map" from another page.
    const focusCurrent = sessionStorage.getItem('droppoint-focus-current') === '1';
    if (focusCurrent) {
      sessionStorage.removeItem('droppoint-focus-current');
      currentLocationStageRef.current = 'first';
    }

    if (!focusCurrent && hasSavedPosition()) {
      setInitialCenterResolved(true);
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          if (resolved) return;
          resolved = true;
          setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          setZoom(DEFAULT_ZOOM);
          currentLocationStageRef.current = 'none';
          setInitialCenterResolved(true);
        },
        () => resolveFallback(),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
    } else {
      resolveFallback();
    }
  }, [initialCenterResolved, setInitialCenterResolved, setMapCenter, setZoom, hasSavedPosition]);

  // Pre-warm the most recent properties so the first pin click is instant.
  useEffect(() => {
    if (!propertiesLoaded || userProperties.length === 0) return;
    userProperties.slice(0, 5).forEach((p, i) => {
      if (p.id) setTimeout(() => prefetchPropertyData(p.id!, p), i * 300);
    });
  }, [propertiesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Property loading
  // ---------------------------------------------------------------------------

  /** Files/folders for a saved property: shared cache first, then Supabase. */
  const loadPropertyData = useCallback(async (property: Property) => {
    const requestId = ++loadRequestRef.current;
    if (!property.id) {
      setFolders([]);
      setPropertyFiles([]);
      setFoldersLoading(false);
      setFilesLoading(false);
      return;
    }

    const cached = getPropertyDataSync(property.id);
    if (cached) {
      setFolders(cached.folders);
      setPropertyFiles(cached.files);
      setFoldersLoading(false);
      setFilesLoading(false);
      return;
    }

    setFoldersLoading(true);
    setFilesLoading(true);
    try {
      const { files, folders: loadedFolders } = await propertyService.getPropertyData(property.id);
      setPropertyDataCache(property.id, files, loadedFolders);
      if (requestId !== loadRequestRef.current) return;
      setFolders(loadedFolders);
      setPropertyFiles(files);
    } catch (error) {
      logger.error('[PROPERTY] Error loading property data:', error);
      showToast('Could not load this property’s files.');
    } finally {
      if (requestId === loadRequestRef.current) {
        setFoldersLoading(false);
        setFilesLoading(false);
      }
    }
  }, [setFolders, setPropertyFiles, setFoldersLoading, setFilesLoading, showToast]);

  const panTo = useCallback((target: LatLng, targetZoom = SEARCH_ZOOM) => {
    setMapCenter(target);
    setZoom(targetZoom);
    if (map) {
      map.panTo(target);
      map.setZoom(targetZoom);
    }
  }, [map, setMapCenter, setZoom]);

  /**
   * Make a saved property current. With `openModal` the details open right
   * away (sidebar); otherwise the confirmation card shows first (pin click,
   * search) while the data loads in the background.
   */
  const selectProperty = useCallback((property: Property, options: { openModal?: boolean } = {}) => {
    if (savedProperty?.id && savedProperty.id !== property.id) {
      setFolders([]);
      setPropertyFiles([]);
    }
    setSelectedFolder('master');
    setSavedProperty(property);
    setAddress(property.address);
    setAddressLoading(false);
    setSnappedLatLng({ lat: property.lat, lng: property.lng });
    // The card is up; by the time "Open" is tapped the hero photo is already here.
    warmHeroImage(property.lat, property.lng);
    if (options.openModal) {
      setSelectedProperty(null);
      setShowDetailsModal(true);
    } else {
      setSelectedProperty(property);
    }
    void loadPropertyData(property);
  }, [
    savedProperty, loadPropertyData, setFolders, setPropertyFiles, setSelectedFolder, setSavedProperty,
    setAddress, setAddressLoading, setSnappedLatLng, setSelectedProperty, setShowDetailsModal,
  ]);

  const openPropertyById = useCallback((id: string) => {
    const match = userProperties.find(p => p.id === id);
    if (!match) return false;
    selectProperty(match, { openModal: true });
    return true;
  }, [userProperties, selectProperty]);

  // Back/Forward move between properties and folders; a link opens a property.
  const sheetHistory = useSheetHistory({
    isOpen: showDetailsModal,
    propertyId: savedProperty?.id ?? null,
    selectedFolder,
    ready: propertiesLoaded,
    openPropertyById,
    closeSheet: () => setShowDetailsModal(false),
    setSelectedFolder,
  });

  /** Show the "add property" card for a location that isn't saved yet. */
  const proposeNewProperty = useCallback((location: LatLng, resolvedAddress: string, snapped: LatLng | null) => {
    setSelectedProperty({ id: null, address: resolvedAddress, lat: location.lat, lng: location.lng, label: null, notes: null });
    setAddress(resolvedAddress);
    setSnappedLatLng(snapped);
  }, [setSelectedProperty, setAddress, setSnappedLatLng]);

  /** Persist a not-yet-saved pin before its first upload or folder. */
  const ensurePropertyId = useCallback(async (): Promise<string | null> => {
    if (!savedProperty) {
      showToast('Please select a property first.', 'warning');
      return null;
    }
    if (savedProperty.id) return savedProperty.id;
    try {
      const created = await propertyService.createProperty({
        address: savedProperty.address,
        lat: savedProperty.lat,
        lng: savedProperty.lng,
        label: savedProperty.label,
        notes: savedProperty.notes,
      });
      if (!created.id) throw new Error('Property could not be saved.');
      setSavedProperty(created);
      void loadUserProperties();
      return created.id;
    } catch (error) {
      logger.error('[PROPERTY] Error auto-saving property:', error);
      showToast('Failed to save property. Please try again.');
      return null;
    }
  }, [savedProperty, setSavedProperty, loadUserProperties, showToast]);

  const fileActions = usePropertyFileActions({
    property: savedProperty,
    files: propertyFiles,
    setFiles: setPropertyFiles,
    folders,
    setFolders,
    selectedFolder,
    ensurePropertyId,
  });

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  const handlePlaceSelect = useCallback(async (prediction: Prediction) => {
    // Saved property: jump straight to it.
    if (prediction.property_id) {
      const known = userProperties.find(p => p.id === prediction.property_id)
        ?? await propertyService.getPropertyById(prediction.property_id).catch(() => null);
      if (known) {
        panTo({ lat: known.lat, lng: known.lng });
        selectProperty(known);
        return;
      }
    }

    const location = await geocodePlaceId(prediction.place_id);
    if (!location) {
      showToast('Could not locate that address.');
      return;
    }
    panTo(location);

    // Resolve the canonical formatted address so it matches what a dropped
    // pin would store; that lets us recognize an already-saved property.
    setAddressLoading(true);
    try {
      const geo = await reverseGeocode(location.lat, location.lng).catch(() => null);
      const resolvedAddress = geo?.address ?? prediction.description;
      const existing = userProperties.find(p => p.address === resolvedAddress);
      if (existing) {
        selectProperty(existing);
      } else {
        proposeNewProperty(location, resolvedAddress, geo?.snappedLatLng ?? location);
      }
    } finally {
      setAddressLoading(false);
    }
  }, [userProperties, panTo, selectProperty, proposeNewProperty, setAddressLoading, showToast]);

  // ---------------------------------------------------------------------------
  // Map interactions
  // ---------------------------------------------------------------------------

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;

    if (suppressMapClickRef.current || wasRecentTouch()) {
      suppressMapClickRef.current = false;
      return;
    }
    if (showDropdown || document.activeElement?.tagName === 'INPUT') return;

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    // Google fires click twice for a double-click zoom; only a lone click drops a pin.
    const now = Date.now();
    const sinceLast = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;
    if (sinceLast < 300) return;

    setTimeout(async () => {
      if (Date.now() - lastClickTimeRef.current < 250) return;

      setAddressLoading(true);
      try {
        const geo = await reverseGeocode(lat, lng);
        // Pins keep the exact clicked coordinates; the address is descriptive only.
        proposeNewProperty({ lat, lng }, geo?.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, null);
      } catch (error) {
        logger.error('[PINS] Address lookup failed:', error);
        showToast('Could not look up an address for that spot.');
      } finally {
        setAddressLoading(false);
      }
    }, 250);
  }, [showDropdown, proposeNewProperty, setAddressLoading, showToast]);

  const handleCurrentLocationClick = useCallback(() => {
    setSelectedProperty(null);
    setAddress('');

    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by this browser.');
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      const target = { lat: position.coords.latitude, lng: position.coords.longitude };
      const center = map?.getCenter();
      const alreadyThere = center ? isNear({ lat: center.lat(), lng: center.lng() }, target) : isNear(mapCenter, target);
      const atNeighborhoodZoom = Math.abs((map?.getZoom() ?? zoom) - CURRENT_LOCATION_ZOOM) < 0.25;
      const goDeep = alreadyThere && atNeighborhoodZoom && currentLocationStageRef.current === 'first';

      currentLocationStageRef.current = goDeep ? 'deep' : 'first';
      panTo(target, goDeep ? CURRENT_LOCATION_ZOOM_DEEP : CURRENT_LOCATION_ZOOM);
      setInputValue('');
    };

    const onError = (error: GeolocationPositionError, isRetry: boolean) => {
      if (error.code === error.PERMISSION_DENIED) {
        showToast('Location access denied. Enable location permissions in your browser settings.');
        return;
      }
      if (!isRetry) {
        // Precise positioning failed or timed out; accept a coarse fix.
        navigator.geolocation.getCurrentPosition(onSuccess, e => onError(e, true), {
          enableHighAccuracy: false, timeout: 20000, maximumAge: 900000,
        });
        return;
      }
      logger.error('[GEOLOCATION] Failed:', error.code, error.message);
      showToast(error.code === error.TIMEOUT ? 'Location request timed out. Please try again.' : 'Unable to determine your location.');
    };

    navigator.geolocation.getCurrentPosition(onSuccess, e => onError(e, false), {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 60000,
    });
  }, [map, mapCenter, zoom, panTo, setSelectedProperty, setAddress, setInputValue, showToast]);

  // Re-tapping the active Map tab on mobile flips Map / Satellite.
  const handleMapTabReclick = useCallback(() => {
    setMapType(prev => (prev === 'roadmap' ? 'hybrid' : 'roadmap'));
  }, [setMapType]);

  const handleSidebarPropertySelect = useCallback((property: Property) => {
    panTo({ lat: property.lat, lng: property.lng });
    selectProperty(property, { openModal: true });
    if (property.id) sheetHistory.open(property.id);
  }, [panTo, selectProperty, sheetHistory]);

  const dismissInfoCard = useCallback(() => {
    setSelectedProperty(null);
    setAddress('');
  }, [setSelectedProperty, setAddress]);

  const armMapClickSuppression = useCallback(() => {
    // The close gesture's synthesized click can reach Google Maps' native
    // listener after the card is gone and drop a pin under it. Swallow it.
    suppressMapClickRef.current = true;
    setTimeout(() => { suppressMapClickRef.current = false; }, 1200);
  }, []);

  const handleInfoCardSelect = useCallback(() => {
    if (!selectedProperty) return;
    if (!selectedProperty.id) {
      setSavedProperty({ ...selectedProperty, address });
      setFolders([]);
      setPropertyFiles([]);
      setFoldersLoading(false);
      setFilesLoading(false);
      setSelectedFolder('master');
    } else {
      setSavedProperty(selectedProperty);
      sheetHistory.open(selectedProperty.id);
    }
    setShowDetailsModal(true);
    dismissInfoCard();
  }, [
    selectedProperty, address, dismissInfoCard, setSavedProperty, setFolders, setPropertyFiles,
    setFoldersLoading, setFilesLoading, setSelectedFolder, setShowDetailsModal, sheetHistory,
  ]);

  /** Rename from inside the sheet. An unsaved pin just carries the label until it's persisted. */
  const handlePropertyRename = useCallback(async (property: Property, label: string | null) => {
    if (!property.id) {
      setSavedProperty(prev => (prev ? { ...prev, label } : prev));
      return;
    }
    const updated = await propertyService.updateProperty(property.id, { label });
    setSavedProperty(updated);
    setUserProperties(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  }, [setSavedProperty, setUserProperties]);

  const showInfoCard = Boolean(selectedProperty && address);

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <Head>
        <title>Map View - DropPoint Real Estate Document Management</title>
        <meta name="description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
        <meta property="og:title" content="Map View - DropPoint Real Estate Document Management" />
        <meta property="og:description" content="Interactive map interface for managing real estate properties and documents. Select properties, upload files, and organize your real estate portfolio with our map-based system." />
      </Head>
      <WebSidebar
        properties={userProperties}
        selectedPropertyId={savedProperty?.id}
        onPropertySelect={handleSidebarPropertySelect}
      />
      <div className={`flex-1 relative overflow-hidden ${mobileClasses.fullScreen}`} style={getMobileStyles('page')}>
        {!isLoaded || !initialCenterResolved ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ground">
            <div className="w-8 h-8 border-[3px] border-surface-2 border-t-accent rounded-full animate-spin" />
            <p className="text-subhead text-ink-2">Loading map…</p>
          </div>
        ) : loadError ? (
          <div className="absolute inset-0 flex items-center justify-center text-body text-danger px-6 text-center">The map couldn’t load. Check your connection and try again.</div>
        ) : (
          <div
            className="w-full h-full"
            onClick={() => {
              setShowDropdown(false);
              if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLElement).blur();
            }}
          >
            <GoogleMap
              mapContainerStyle={mapContainerStyleWithSidebar}
              center={mapCenter}
              onLoad={mapInstance => {
                setMap(mapInstance);
                mapInstance.setZoom(zoom);
                mapInstance.addListener('idle', () => {
                  setMapFirstIdle(true);
                  const z = mapInstance.getZoom();
                  if (typeof z === 'number') setZoom(z);
                  saveMapPositionThrottled();
                });
              }}
              onClick={handleMapClick}
              onDblClick={() => { lastClickTimeRef.current = Date.now(); }}
              onDragStart={() => { currentLocationStageRef.current = 'none'; }}
              onDragEnd={() => {
                currentLocationStageRef.current = 'none';
                saveMapPosition();
              }}
              mapTypeId={mapType}
              options={{
                tilt: 0,
                rotateControl: false,
                gestureHandling: 'greedy',
                mapTypeControl: false,
                fullscreenControl: false,
                streetViewControl: false,
                clickableIcons: false,
                disableDefaultUI: true,
                colorScheme: 'FOLLOW_SYSTEM',
                styles: [
                  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
                  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                ],
              }}
            >
              {propertiesLoaded && userProperties.map(property => (
                <Marker
                  key={property.id || `temp-${property.lat}-${property.lng}`}
                  position={{ lat: property.lat, lng: property.lng }}
                  icon={createPropertyPinIcon(selectedProperty?.id === property.id)}
                  onClick={() => selectProperty(property)}
                  onMouseOver={() => property.id && prefetchPropertyData(property.id, property)}
                  title={property.address}
                />
              ))}

              {selectedProperty && !selectedProperty.id && (
                <Marker
                  key={`new-pin-${selectedProperty.lat}-${selectedProperty.lng}`}
                  position={{ lat: selectedProperty.lat, lng: selectedProperty.lng }}
                  icon={createPropertyPinIcon(true)}
                  title={selectedProperty.address || 'New Property'}
                />
              )}

              <CurrentLocationIndicator map={map} isVisible={true} />
            </GoogleMap>
          </div>
        )}

        {/* Overlays wait for the first idle so they don't shift during map layout. */}
        {(mapFirstIdle || !isLoaded) && (
          <>
            <MapSearch
              onPlaceSelect={handlePlaceSelect}
              inputValue={inputValue}
              onInputChange={setInputValue}
              predictions={predictions}
              onPredictionsChange={setPredictions}
              onShowDropdownChange={setShowDropdown}
            />
            <MapControls
              mapType={mapType}
              onMapTypeChange={setMapType}
              onCurrentLocationClick={handleCurrentLocationClick}
              hidden={showDropdown || showInfoCard || showDetailsModal}
            />
          </>
        )}

        <MobileBottomNav onList={() => router.push('/list')} onMapTabReclick={handleMapTabReclick} />

        {selectedProperty && address && (
          <PropertyInfoCard
            address={address}
            addressLoading={addressLoading}
            property={selectedProperty}
            onCloseStart={armMapClickSuppression}
            onClose={() => {
              armMapClickSuppression();
              dismissInfoCard();
            }}
            onSelect={handleInfoCardSelect}
          />
        )}

        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-surface rounded-[16px] p-6 max-w-sm mx-4">
                <h2 className="text-headline font-semibold mb-1">Couldn’t open this property</h2>
                <p className="text-subhead text-ink-2 mb-4">Something went wrong loading its files. Close and try again.</p>
                <button type="button" onClick={sheetHistory.close} className="ios-button ios-button-primary">
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
            onClose={sheetHistory.close}
            folders={folders}
            files={propertyFiles}
            foldersLoading={foldersLoading}
            filesLoading={filesLoading}
            selectedFolder={selectedFolder}
            onFolderChange={sheetHistory.changeFolder}
            onFileUpload={fileActions.uploadFiles}
            onFileDelete={fileActions.deleteFile}
            onFileRename={fileActions.renameItem}
            onFileMove={fileActions.moveFile}
            onFileCopy={fileActions.copyFile}
            onFolderCreate={fileActions.createFolder}
            onFolderDelete={fileActions.deleteFolder}
            pendingUploads={fileActions.pendingUploads}
            onDismiss={fileActions.dismissPendingUpload}
            onPropertyRename={handlePropertyRename}
            onPropertySwitch={(property, files, switchedFolders) => {
              if (property.id) sheetHistory.open(property.id);
              setSavedProperty(property);
              setPropertyFiles(files);
              setFolders(switchedFolders);
              setSelectedFolder('master');
              setFoldersLoading(false);
              setFilesLoading(false);
              setAddress(property.address);
              setSnappedLatLng({ lat: property.lat, lng: property.lng });
            }}
            onMapMove={(lat, lng) => {
              setMapCenter({ lat, lng });
              map?.panTo({ lat, lng });
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default withAuth(MapPage, { requireAuth: true });
