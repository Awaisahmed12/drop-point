interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  isMobile?: boolean;
  showDropdown?: boolean;
  onCurrentLocationClick?: () => void;
  currentLocationLoading?: boolean;
  showPropertyInfoCard?: boolean;
}

export const MapControls = ({ 
  mapType, 
  onMapTypeChange, 
  showDropdown = false,
  onCurrentLocationClick,
  currentLocationLoading = false,
  showPropertyInfoCard = false
}: MapControlsProps) => {
  // Desktop controls (left side, larger)
  const desktopControls = (
    <div className="hidden sm:flex absolute top-6 left-6 z-30 flex-col gap-2">
      {/* Map type controls */}
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
            mapType === 'satellite' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-800 border border-gray-300'
          } cursor-pointer`}
          onClick={() => onMapTypeChange('satellite')}
        >
          Satellite
        </button>
      </div>
      
      {/* Current location button for desktop */}
      {onCurrentLocationClick && (
        <button
          className={`w-10 h-10 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer ${
            currentLocationLoading ? 'opacity-75' : ''
          }`}
          onClick={onCurrentLocationClick}
          disabled={currentLocationLoading}
          style={{ 
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          {currentLocationLoading ? (
            /* Loading spinner */
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          ) : (
            /* Current location GPS pin icon */
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          )}
        </button>
      )}
    </div>
  );

  // Mobile controls (right side, circular, Google Maps style)
  // Show when not actively searching or when dropdown is not visible
  const shouldShowMobileControls = !showDropdown;
  
  const mobileControls = shouldShowMobileControls && (
    <div className="absolute top-20 right-4 z-40 sm:hidden flex flex-col gap-2">
      {/* Map type toggle button */}
      <button
        className={`w-11 h-11 rounded-full shadow-lg border-2 flex items-center justify-center transition-all duration-200 hover:shadow-xl ${
          mapType === 'satellite' 
            ? 'bg-blue-600 text-white border-blue-600' 
            : 'bg-white text-gray-700 border-gray-300'
        } cursor-pointer`}
        onClick={() => onMapTypeChange(mapType === 'satellite' ? 'roadmap' : 'satellite')}
        style={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        {/* Layers icon similar to Google Maps */}
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
          <polygon points="12,2 22,8.5 12,15 2,8.5"></polygon>
          <polyline points="2,17.5 12,24 22,17.5"></polyline>
          <polyline points="2,12.5 12,19 22,12.5"></polyline>
        </svg>
      </button>
    </div>
  );

  // Current location button for mobile (separate positioning at bottom)
  // Smart positioning: Calculate exact clearance above PropertyInfoCard
  // PropertyInfoCard: bottom-6 (24px) + ~144px height = 168px total
  // Add 52px padding for comfortable separation = 220px minimum clearance
  const mobileCurrentLocationButton = shouldShowMobileControls && onCurrentLocationClick && (
    <div className="absolute right-4 z-40 sm:hidden" 
         style={{
           // Dynamic positioning: ensure button is always above PropertyInfoCard with proper spacing
           bottom: showPropertyInfoCard ? '220px' : '128px' // 220px = card height + comfortable spacing, 128px = normal position
         }}>
      <button
        className={`w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer ${
          currentLocationLoading ? 'opacity-75' : ''
        }`}
        onClick={onCurrentLocationClick}
        disabled={currentLocationLoading}
        style={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        {currentLocationLoading ? (
          /* Loading spinner */
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="animate-spin"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        ) : (
          /* Current location GPS pin icon */
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
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        )}
      </button>
    </div>
  );

  return (
    <>
      {desktopControls}
      {mobileControls}
      {mobileCurrentLocationButton}
    </>
  );
}; 