import Link from 'next/link';
import { Property } from '../../types';

interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite' | 'hybrid') => void;
  isMobile?: boolean;
  showDropdown?: boolean;
  onCurrentLocationClick?: () => void;
  showPropertyInfoCard?: boolean;
  isPropertyModalOpen?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  propertyCardHeight?: number;
  selectedProperty?: Property | null; // Add selectedProperty to props
}

export const MapControls = ({ 
  mapType, 
  onMapTypeChange, 
  showDropdown = false,
  onCurrentLocationClick,
  showPropertyInfoCard = false,
  isPropertyModalOpen = false,
  onZoomIn,
  onZoomOut,
  propertyCardHeight = 0,
  selectedProperty = null, // Add selectedProperty parameter
}: MapControlsProps) => {
  // Desktop map type controls (left side) - now with 3 options
  const desktopMapControls = (
    <div className="hidden sm:flex absolute top-6 left-6 z-30">
      <div className="flex gap-2 bg-white rounded-lg shadow-lg p-2">
        <button
          className={`px-3 py-1 rounded font-semibold text-sm ${
            mapType === 'roadmap' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-800 border border-gray-300'
          } cursor-pointer`}
          onClick={() => onMapTypeChange('roadmap')}
        >
          Map
        </button>
        <button
          className={`px-3 py-1 rounded font-semibold text-sm ${
            mapType === 'hybrid' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-800 border border-gray-300'
          } cursor-pointer`}
          onClick={() => onMapTypeChange('hybrid')}
        >
          Hybrid
        </button>
        <button
          className={`px-3 py-1 rounded font-semibold text-sm ${
            mapType === 'satellite' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-800 border border-gray-300'
          } cursor-pointer`}
          onClick={() => onMapTypeChange('satellite')}
        >
          Satellite
        </button>
      </div>
    </div>
  );

  // Desktop current location button (positioned after search bar)
  const desktopCurrentLocationButton = onCurrentLocationClick && (
    <div className="hidden sm:flex absolute top-6 right-6 z-30 gap-2">
      <Link
        className="px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm"
        href="/account"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M4 21v-2a4 4 0 0 1 3-3.87"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        Account
      </Link>
      {/* List View Button */}
      <Link
        className="px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm"
        href="/list"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        List
      </Link>
      
      {/* Current Location Button */}
      <button
        className={`px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm`}
        onClick={onCurrentLocationClick}
        style={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        {/* Always show static crosshairs/target icon - handles both recenter and deep zoom */}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Current Location
      </button>
    </div>
  );

  // Mobile controls (right side, circular, Google Maps style)
  // Show when not actively searching or when dropdown is not visible
  // AND when no property interaction is happening
  const shouldShowMobileControls = !showDropdown && !selectedProperty && !isPropertyModalOpen && !showPropertyInfoCard;

  // Keep only the map-type toggle as a floating side button on mobile
  const mobileControls = shouldShowMobileControls && (
    <div className="absolute right-4 top-24 z-30 sm:hidden flex flex-col gap-2">
      <button
        className="w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer"
        onClick={() => {
          if (mapType === 'roadmap') {
            onMapTypeChange('hybrid');
          } else if (mapType === 'hybrid') {
            onMapTypeChange('satellite');
          } else {
            onMapTypeChange('roadmap');
          }
        }}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        aria-label="Toggle map type"
      >
        {mapType === 'roadmap' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        ) : mapType === 'hybrid' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.93 4.93l14.14 14.14"></path>
            <path d="m18.5 12.5-1.8-1.8a4 4 0 0 0-5.5-5.5l-1.8-1.8"></path>
            <path d="M8.5 8.5 7 7a4 4 0 0 0-5 5l1.5 1.5"></path>
            <path d="m16 16 1.5 1.5a4 4 0 0 0 5-5L21 11"></path>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18"></polygon>
            <line x1="9" y1="1" x2="9" y2="21"></line>
            <line x1="15" y1="6" x2="15" y2="16"></line>
          </svg>
        )}
      </button>
    </div>
  );

  // Current location button for mobile (separate positioning at bottom)
  // Smart positioning: Calculate exact clearance above PropertyInfoCard
  // Adaptive positioning based on property card height, with search bar as upper limit
  // Positioned much lower for better thumb accessibility
  const calculateMobileButtonPosition = () => {
    const baseOffset = 88; // Bottom nav height
    const cardPadding = 52; // Padding above card
    const searchBarHeight = 96; // Search bar area height (top-6 = 24px + input height + padding)
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    // If property card is visible, position above it
    if (propertyCardHeight > 0) {
      const bottomPosition = baseOffset + propertyCardHeight + cardPadding;
      const maxBottomPosition = viewportHeight - searchBarHeight - 200; // 200px = button stack height
      
      // Use the smaller value to ensure we don't hit the search bar
      return Math.min(bottomPosition, maxBottomPosition);
    }
    
    // Default position when no card - positioned much lower for better thumb accessibility
    return 180; // Changed from 280 to 180 for better thumb reach
  };

  const mobileCurrentLocationButton = shouldShowMobileControls && onCurrentLocationClick && (
    <div className="absolute right-4 z-50 sm:hidden flex flex-col gap-2" 
          style={{
            bottom: `${calculateMobileButtonPosition()}px`
          }}>
      {/* Current Location Button */}
      <button
        className={`relative w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl active:scale-[0.98] cursor-pointer`}
        onClick={onCurrentLocationClick}
        style={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
         {/* Current location GPS pin icon */}
         <svg 
           width="16" 
           height="16" 
           viewBox="0 0 24 24" 
           fill="none" 
           stroke="currentColor" 
           strokeWidth="2" 
           strokeLinecap="round" 
           strokeLinejoin="round"
         >
           <circle cx="12" cy="12" r="10"></circle>
           <line x1="12" y1="2" x2="12" y2="6"></line>
           <line x1="12" y1="18" x2="12" y2="22"></line>
           <line x1="2" y1="12" x2="6" y2="12"></line>
           <line x1="18" y1="12" x2="22" y2="12"></line>
           <circle cx="12" cy="12" r="3"></circle>
         </svg>
        </button>
      
      {/* Zoom In Button */}
      {onZoomIn && (
        <button
          className={`relative w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl active:scale-[0.98] cursor-pointer`}
          onClick={onZoomIn}
          style={{ 
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
          aria-label="Zoom in"
        >
          {/* Plus icon */}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}
      
      {/* Zoom Out Button */}
      {onZoomOut && (
        <button
          className={`relative w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl active:scale-[0.98] cursor-pointer`}
          onClick={onZoomOut}
          style={{ 
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
          aria-label="Zoom out"
        >
          {/* Minus icon */}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <>
      {desktopMapControls}
      {desktopCurrentLocationButton}
      {mobileControls}
      {mobileCurrentLocationButton}
    </>
  );
}; 