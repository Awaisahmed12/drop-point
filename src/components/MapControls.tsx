interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  isMobile?: boolean;
  showDropdown?: boolean;
  onCurrentLocationClick?: () => void;
  currentLocationLoading?: boolean;
  showPropertyInfoCard?: boolean;
  onListViewClick?: () => void;
}

export const MapControls = ({ 
  mapType, 
  onMapTypeChange, 
  showDropdown = false,
  onCurrentLocationClick,
  currentLocationLoading = false,
  showPropertyInfoCard = false,
  onListViewClick
}: MapControlsProps) => {
  // Desktop map type controls (left side)
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
      {/* List View Button */}
      {onListViewClick && (
        <button
          className="px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm"
          onClick={onListViewClick}
          style={{ 
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
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
        </button>
      )}
      
      {/* Current Location Button */}
      <button
        className={`px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm ${
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
        {currentLocationLoading ? 'Locating...' : 'Current Location'}
      </button>
    </div>
  );

  // Mobile controls (right side, circular, Google Maps style)
  // Show when not actively searching or when dropdown is not visible
  const shouldShowMobileControls = !showDropdown;
  
  const mobileControls = shouldShowMobileControls && (
    <div className="absolute right-4 top-20 z-30 sm:hidden flex flex-col gap-2">
      {/* Map Type Toggle */}
      <button
        className="w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer"
        onClick={() => onMapTypeChange(mapType === 'satellite' ? 'roadmap' : 'satellite')}
        style={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        {mapType === 'satellite' ? (
          /* Map icon for when in satellite mode */
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
            <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18"></polygon>
            <line x1="9" y1="1" x2="9" y2="21"></line>
            <line x1="15" y1="6" x2="15" y2="16"></line>
          </svg>
        ) : (
          /* Satellite icon for when in map mode */
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
            <path d="M4.93 4.93l14.14 14.14"></path>
            <path d="m18.5 12.5-1.8-1.8a4 4 0 0 0-5.5-5.5l-1.8-1.8"></path>
            <path d="M8.5 8.5 7 7a4 4 0 0 0-5 5l1.5 1.5"></path>
            <path d="m16 16 1.5 1.5a4 4 0 0 0 5-5L21 11"></path>
          </svg>
        )}
      </button>

      {/* List View Button */}
      {onListViewClick && (
        <button
          className="w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer"
          onClick={onListViewClick}
          style={{ 
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
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
        </button>
      )}
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
           bottom: showPropertyInfoCard ? '220px' : '110px' // Reduced normal position from 128px to 110px
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
      {desktopMapControls}
      {desktopCurrentLocationButton}
      {mobileControls}
      {mobileCurrentLocationButton}
    </>
  );
}; 