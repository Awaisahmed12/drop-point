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

  // Start watching position when component mounts and map is available
  useEffect(() => {
    if (!map || !isVisible || typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const startWatching = () => {
      console.log('🌍 [LOCATION_DOT] Starting location watch');

      const watchOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000 // Allow cached position up to 5 seconds
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy: positionAccuracy } = position.coords;
          console.log('🌍 [LOCATION_DOT] Position update:', { 
            lat: latitude, 
            lng: longitude, 
            accuracy: positionAccuracy 
          });
          
          setCurrentPosition({ lat: latitude, lng: longitude });
          setAccuracy(positionAccuracy || null);
        },
        (error) => {
          console.error('🌍 [LOCATION_DOT] Watch position error:', error);
          // Don't clear position on error - keep last known position
        },
        watchOptions
      );
    };

    // Request permission first, then start watching
    navigator.geolocation.getCurrentPosition(
      () => {
        // Permission granted, start watching
        startWatching();
      },
      (error) => {
        console.log('🌍 [LOCATION_DOT] Initial permission check failed:', error);
        // Don't start watching if permission denied
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // Cleanup function
    return () => {
      if (watchIdRef.current !== null) {
        console.log('🌍 [LOCATION_DOT] Stopping location watch');
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
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
