import { logger } from '../utils/logger';
import { useState, useCallback, useRef, useEffect } from 'react';
import { US_CENTER, DEFAULT_ZOOM, DEFAULT_MAP_TYPE, MAP_TYPE_KEY, MAP_POSITION_KEY } from '../../constants';
import type { MapType } from '../../types';

interface SavedPosition {
  lat: number;
  lng: number;
  zoom?: number;
}

const readSavedPosition = (): SavedPosition | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MAP_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') return null;
    return parsed as SavedPosition;
  } catch (error) {
    logger.error('[MapState] Error loading saved position:', error);
    return null;
  }
};

/**
 * Map position, zoom, and type. Position is persisted to sessionStorage so
 * navigating between pages returns to the same view; map type persists in
 * localStorage as a lasting preference.
 *
 * Center/zoom are read synchronously on first render: nothing that depends
 * on them is part of the server-rendered HTML (the map only mounts once the
 * Google script loads), so there is no hydration mismatch to avoid.
 */
export function useMapState() {
  const [mapCenter, setMapCenter] = useState(() => {
    const saved = readSavedPosition();
    return saved ? { lat: saved.lat, lng: saved.lng } : US_CENTER;
  });
  const [zoom, setZoom] = useState(() => readSavedPosition()?.zoom ?? DEFAULT_ZOOM);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapType>(DEFAULT_MAP_TYPE);
  const [mapFirstIdle, setMapFirstIdle] = useState(false);
  const [initialCenterResolved, setInitialCenterResolved] = useState(false);

  // Map type affects the server-rendered controls, so it is read after mount.
  useEffect(() => {
    const stored = localStorage.getItem(MAP_TYPE_KEY);
    // 'satellite' was a third option in earlier builds; it folds into hybrid.
    const restored: MapType | null =
      stored === 'roadmap' ? 'roadmap' : stored === 'hybrid' || stored === 'satellite' ? 'hybrid' : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a persisted preference
    if (restored) setMapType(restored);
  }, []);

  useEffect(() => {
    localStorage.setItem(MAP_TYPE_KEY, mapType);
    map?.setMapTypeId(mapType);
  }, [mapType, map]);

  const saveMapPosition = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    const currentZoom = map.getZoom();
    if (!center || !currentZoom) return;
    sessionStorage.setItem(
      MAP_POSITION_KEY,
      JSON.stringify({ lat: center.lat(), lng: center.lng(), zoom: currentZoom }),
    );
  }, [map]);

  const lastSaveTimeRef = useRef(0);
  const saveMapPositionThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 1000) {
      lastSaveTimeRef.current = now;
      saveMapPosition();
    }
  }, [saveMapPosition]);

  useEffect(() => {
    window.addEventListener('beforeunload', saveMapPosition);
    return () => window.removeEventListener('beforeunload', saveMapPosition);
  }, [saveMapPosition]);

  return {
    mapCenter,
    setMapCenter,
    map,
    setMap,
    zoom,
    setZoom,
    mapType,
    setMapType,
    mapFirstIdle,
    setMapFirstIdle,
    initialCenterResolved,
    setInitialCenterResolved,
    saveMapPosition,
    saveMapPositionThrottled,
    hasSavedPosition: () => readSavedPosition() !== null,
  };
}
