import { useState, useEffect, useRef } from 'react';
import { Marker, Circle } from '@react-google-maps/api';

interface CurrentLocationIndicatorProps {
  map: google.maps.Map | null;
  isVisible?: boolean;
}

export const CurrentLocationIndicator = ({ 
  map, 
  isVisible = true 
}: CurrentLocationIndicatorProps) => {
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasPositionRef = useRef<boolean>(false); // Track if we've ever received a position

  // Start watching position when component mounts and map is available
  useEffect(() => {
    if (!map || !isVisible || typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const startWatching = (useHighAccuracy: boolean = true) => {
      const watchOptions: PositionOptions = {
        enableHighAccuracy: useHighAccuracy,
        timeout: useHighAccuracy ? 10000 : 15000,
        maximumAge: useHighAccuracy ? 5000 : 300000 // Allow cached position up to 5 seconds for high accuracy, 5 minutes for low accuracy
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy: positionAccuracy } = position.coords;
          hasPositionRef.current = true; // Mark that we've received a position
          setCurrentPosition({ lat: latitude, lng: longitude });
          setAccuracy(positionAccuracy || null);
        },
        (error) => {
          // Handle errors gracefully - don't spam console with transient errors
          const isTransientError = error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT;
          
          if (error.code === error.PERMISSION_DENIED) {
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            return;
          }

          // For transient errors (POSITION_UNAVAILABLE, TIMEOUT)
          if (isTransientError) {
            // If we haven't received a position yet and high accuracy failed, try fallback
            if (!hasPositionRef.current && useHighAccuracy) {
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              startWatching(false); // Retry with lower accuracy
              return;
            }
            
            // If we already have a position, these transient errors are expected and don't need logging
            // The browser's CoreLocation may report kCLErrorLocationUnknown occasionally - this is normal
            return;
          }

          // Don't clear position on error - keep last known position
        },
        watchOptions
      );
    };

    // Request permission first, then start watching with fallback
    const tryGetInitialPosition = (useHighAccuracy: boolean = true) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Permission granted, start watching
          startWatching(useHighAccuracy);
        },
        (error) => {
          // If permission denied, don't retry
          if (error.code === error.PERMISSION_DENIED) {
            return;
          }

          // If high accuracy failed with transient error, try with lower accuracy
          if (useHighAccuracy && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            tryGetInitialPosition(false);
            return;
          }

          // Other errors - start watching anyway (watchPosition handles errors gracefully)
          startWatching(useHighAccuracy);
        },
        { 
          enableHighAccuracy: useHighAccuracy, 
          timeout: useHighAccuracy ? 5000 : 10000,
          maximumAge: useHighAccuracy ? 5000 : 300000
        }
      );
    };

    tryGetInitialPosition();

    // Cleanup function
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      hasPositionRef.current = false; // Reset position tracking
    };
  }, [map, isVisible]);

  // Create custom blue dot icon
  const createLocationDotIcon = () => {
    if (typeof window === 'undefined' || !window.google) return null;

    // Create a blue dot similar to Google Maps
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const size = 24;
    canvas.width = size;
    canvas.height = size;

    if (context) {
      // Draw blue dot with white border
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = 8;
      
      // White border
      context.beginPath();
      context.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
      context.fillStyle = '#FFFFFF';
      context.fill();
      
      // Blue dot
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      context.fillStyle = '#4285F4'; // Google Blue
      context.fill();
      
      // Small white center dot
      context.beginPath();
      context.arc(centerX, centerY, 2, 0, 2 * Math.PI);
      context.fillStyle = '#FFFFFF';
      context.fill();
    }

    return {
      url: canvas.toDataURL(),
      size: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2),
      scaledSize: new google.maps.Size(size, size),
    };
  };

  
  // Don't render if no position or not visible
  if (!currentPosition || !isVisible || !map) {
    return null;
  }

  const locationIcon = createLocationDotIcon();

  return (
    <>
      {/* Accuracy circle (if accuracy is available and reasonable) */}
      {accuracy && accuracy < 1000 && (
        <Circle
          center={currentPosition}
          radius={accuracy}
          options={{
            strokeColor: '#4285F4',
            strokeOpacity: 0.3,
            strokeWeight: 1,
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            clickable: false,
            zIndex: 1,
          }}
        />
      )}
      
      {/* Current location marker */}
      <Marker
        position={currentPosition}
        icon={locationIcon || undefined}
        zIndex={10}
        clickable={false}
        title="Your current location"
      />
    </>
  );
};
