import { logger } from '../utils/logger';
import { useState, useCallback, useRef, useEffect } from 'react';
import { US_CENTER, DEFAULT_ZOOM, DEFAULT_MAP_TYPE } from '../../constants';

/**
 * Hook for managing map-related state
 * Handles map center, zoom, map type, and map instance
 */
export function useMapState() {
  const [mapCenter, setMapCenter] = useState(US_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState<string>(DEFAULT_MAP_TYPE);
  const [mapFirstIdle, setMapFirstIdle] = useState(false);
  const [initialCenterResolved, setInitialCenterResolved] = useState(false);

  // Throttle map position saves
  const lastSaveTimeRef = useRef(0);
  const saveMapPositionThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 1000) {
      lastSaveTimeRef.current = now;
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
    }
  }, [map]);

  // Load saved map position on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('droppoint-map-position');
      if (saved) {
        try {
          const position = JSON.parse(saved);
          setMapCenter({ lat: position.lat, lng: position.lng });
          setZoom(position.zoom || DEFAULT_ZOOM);
        } catch (error) {
          logger.error('[MapState] Error loading saved position:', error);
        }
      }
    }
  }, []);

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

    window.addEventListener('beforeunload', saveMapPosition);
    return () => {
      window.removeEventListener('beforeunload', saveMapPosition);
    };
  }, [map]);

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
    saveMapPositionThrottled
  };
}

