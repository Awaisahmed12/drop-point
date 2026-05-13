import { Property } from '../../types';

interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite' | 'hybrid') => void;
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
  const desktopMapButtonBase = 'px-3 py-1 rounded font-semibold text-sm cursor-pointer';
  const desktopMapButtonActive = 'bg-blue-600 text-white';
  const desktopMapButtonInactive = 'bg-white text-gray-800 border border-gray-300';
  const desktopActionButtonBase = 'px-4 py-3 rounded-lg shadow-lg border bg-white text-gray-700 border-gray-300 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-xl cursor-pointer font-semibold text-sm';
  const floatingButtonShadow = { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' };
  const mobileFabBase = 'w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl cursor-pointer';
  const mobileActionButtonBase = 'relative w-11 h-11 rounded-full shadow-lg border-2 bg-white text-gray-700 border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-xl active:scale-[0.98] cursor-pointer';

  // Desktop map type controls — segmented pill (left side)
  const mapTypes: { value: 'roadmap' | 'hybrid' | 'satellite'; label: string }[] = [
    { value: 'roadmap', label: 'Map' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'satellite', label: 'Satellite' },
  ];
  const desktopMapControls = (
    <div className="hidden sm:flex absolute top-4 left-4 z-30">
      <div className="flex bg-white rounded-full p-1 gap-0.5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' }}>
        {mapTypes.map(({ value, label }) => (
          <button
            key={value}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              mapType === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={() => onMapTypeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  // Desktop current location button — icon only
  const desktopCurrentLocationButton = onCurrentLocationClick && (
    <div className="hidden sm:flex absolute top-4 right-4 z-30">
      <button
        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors active:scale-95"
        onClick={onCurrentLocationClick}
        title="Current location"
        aria-label="Recenter map on current location"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );

  // Mobile controls (right side, circular, Google Maps style)
  // Show when not actively searching or when dropdown is not visible
  // AND when no property interaction is happening
  const shouldShowMobileControls = !showDropdown && !selectedProperty && !isPropertyModalOpen && !showPropertyInfoCard;

  // Keep only the map-type toggle as a floating side button on mobile
  // Cycle: roadmap → hybrid → satellite → roadmap
  const nextMapType = mapType === 'roadmap' ? 'hybrid' : mapType === 'hybrid' ? 'satellite' : 'roadmap';
  const mapTypeLabel = mapType === 'roadmap' ? 'Map' : mapType === 'hybrid' ? 'Hybrid' : 'Sat';

  const mobileControls = shouldShowMobileControls && (
    <div className="absolute right-4 top-20 z-30 sm:hidden flex flex-col gap-2">
      <button
        className="px-3 h-9 rounded-full bg-white text-gray-700 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
        style={floatingButtonShadow}
        onClick={() => onMapTypeChange(nextMapType)}
        aria-label="Toggle map type"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18" />
          <line x1="9" y1="1" x2="9" y2="21" />
          <line x1="15" y1="6" x2="15" y2="16" />
        </svg>
        {mapTypeLabel}
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

  const fabStyle = { boxShadow: '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)' };

  const mobileCurrentLocationButton = shouldShowMobileControls && onCurrentLocationClick && (
    <div
      className="absolute right-4 z-50 sm:hidden flex flex-col gap-2"
      style={{ bottom: `${calculateMobileButtonPosition()}px` }}
    >
      {/* Location */}
      <button
        className="w-11 h-11 rounded-full bg-white text-gray-600 flex items-center justify-center hover:text-blue-600 active:scale-95 transition-all"
        onClick={onCurrentLocationClick}
        style={fabStyle}
        aria-label="Current location"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Zoom stack */}
      {(onZoomIn || onZoomOut) && (
        <div className="flex flex-col rounded-full overflow-hidden bg-white" style={fabStyle}>
          {onZoomIn && (
            <button
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 border-b border-gray-100 transition-colors"
              onClick={onZoomIn}
              aria-label="Zoom in"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
          {onZoomOut && (
            <button
              className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 transition-colors"
              onClick={onZoomOut}
              aria-label="Zoom out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
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