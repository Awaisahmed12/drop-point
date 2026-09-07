import type { MapType, Property } from '../../types';

interface MapControlsProps {
  mapType: MapType;
  onMapTypeChange: (type: MapType) => void;
  showDropdown?: boolean;
  onCurrentLocationClick?: () => void;
  showPropertyInfoCard?: boolean;
  isPropertyModalOpen?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  propertyCardHeight?: number;
  selectedProperty?: Property | null;
}

const floatingShadow = { boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' };

const LocationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Floating map controls. The map-type control is a single binary toggle
 * (Map / Satellite) on every screen size: one decision instead of three
 * options, and the same control wherever the user looks for it.
 */
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
  selectedProperty = null,
}: MapControlsProps) => {
  const isSatellite = mapType === 'hybrid';
  const toggleMapType = () => onMapTypeChange(isSatellite ? 'roadmap' : 'hybrid');

  const mapTypeToggle = (
    <button
      className="flex bg-white rounded-full p-1 gap-0.5"
      style={floatingShadow}
      onClick={toggleMapType}
      role="switch"
      aria-checked={isSatellite}
      aria-label="Satellite imagery"
    >
      {(['Map', 'Satellite'] as const).map(label => {
        const active = (label === 'Satellite') === isSatellite;
        return (
          <span
            key={label}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </span>
        );
      })}
    </button>
  );

  // Hide the floating mobile controls while the user is mid-task (searching,
  // reviewing a pin, or inside the details modal) so nothing competes for
  // attention with the current step.
  const shouldShowMobileControls = !showDropdown && !selectedProperty && !isPropertyModalOpen && !showPropertyInfoCard;

  // Keep the location/zoom stack above the property card without colliding
  // with the search bar.
  const mobileStackBottom = () => {
    if (propertyCardHeight <= 0) return 180;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    return Math.min(88 + propertyCardHeight + 52, viewportHeight - 96 - 200);
  };

  return (
    <>
      {/* Desktop: map type top-left, location top-right */}
      <div className="hidden sm:flex absolute top-4 left-4 z-30">{mapTypeToggle}</div>
      {onCurrentLocationClick && (
        <div className="hidden sm:flex absolute top-4 right-4 z-30">
          <button
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors active:scale-95"
            onClick={onCurrentLocationClick}
            title="Current location"
            aria-label="Recenter map on current location"
            style={floatingShadow}
          >
            <LocationIcon />
          </button>
        </div>
      )}

      {/* Mobile: same toggle, below the search bar */}
      {shouldShowMobileControls && (
        <div className="absolute right-4 top-20 z-30 sm:hidden">{mapTypeToggle}</div>
      )}

      {shouldShowMobileControls && onCurrentLocationClick && (
        <div
          className="absolute right-4 z-50 sm:hidden flex flex-col gap-2"
          style={{ bottom: `${mobileStackBottom()}px` }}
        >
          <button
            className="w-11 h-11 rounded-full bg-white text-gray-600 flex items-center justify-center hover:text-blue-600 active:scale-95 transition-all"
            onClick={onCurrentLocationClick}
            style={floatingShadow}
            aria-label="Current location"
          >
            <LocationIcon />
          </button>

          {(onZoomIn || onZoomOut) && (
            <div className="flex flex-col rounded-full overflow-hidden bg-white" style={floatingShadow}>
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
      )}
    </>
  );
};
