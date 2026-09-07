import type { MapType } from '../../types';

interface MapControlsProps {
  mapType: MapType;
  onMapTypeChange: (type: MapType) => void;
  onCurrentLocationClick: () => void;
  /** Hide while the user is mid-task (searching, reviewing a pin, in the sheet). */
  hidden?: boolean;
}

const LocationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Exactly two floating controls on the map: a Map / Satellite segmented
 * control and a current-location button. Zooming is pinch, scroll, or
 * double-tap, the same as every native map.
 */
export const MapControls = ({ mapType, onMapTypeChange, onCurrentLocationClick, hidden = false }: MapControlsProps) => {
  if (hidden) return null;
  const isSatellite = mapType === 'hybrid';

  const segmented = (
    <div className="ios-segmented ios-float" role="group" aria-label="Map style">
      {([['roadmap', 'Map'], ['hybrid', 'Satellite']] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="ios-segment"
          aria-pressed={(value === 'hybrid') === isSatellite}
          onClick={() => onMapTypeChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const locationButton = (
    <button
      type="button"
      className="ios-float w-11 h-11 rounded-full flex items-center justify-center text-accent ios-press"
      onClick={onCurrentLocationClick}
      aria-label="Go to my location"
      title="My location"
    >
      <LocationIcon />
    </button>
  );

  return (
    <>
      {/* Desktop: style top-left, location top-right. */}
      <div className="hidden sm:block absolute top-4 left-4 z-30">{segmented}</div>
      <div className="hidden sm:block absolute top-4 right-4 z-30">{locationButton}</div>

      {/* Phone: style centered under the search field, location by the thumb. */}
      <div className="sm:hidden absolute left-1/2 -translate-x-1/2 z-30" style={{ top: 'calc(var(--safe-top) + 66px)' }}>
        {segmented}
      </div>
      <div className="sm:hidden absolute right-4 z-30" style={{ bottom: 'calc(var(--tabbar-total) + 16px)' }}>
        {locationButton}
      </div>
    </>
  );
};
