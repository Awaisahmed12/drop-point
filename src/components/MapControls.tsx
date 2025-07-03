interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  isMobile?: boolean;
  isSearching?: boolean;
}

export const MapControls = ({ mapType, onMapTypeChange, isSearching = false }: MapControlsProps) => {
  // Desktop controls (left side, larger)
  const desktopControls = (
    <div className="hidden sm:flex absolute top-6 left-6 z-30 gap-2 bg-white rounded-lg shadow-lg p-2">
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
  );

  // Mobile controls (top left, compact, under search bar) - hide when searching
  const mobileControls = !isSearching && (
    <div className="absolute top-20 left-4 z-40 sm:hidden">
      <button
        className={`px-3 py-2 rounded-md text-sm font-medium shadow-md border ${
          mapType === 'satellite' 
            ? 'bg-blue-600 text-white border-blue-600' 
            : 'bg-white text-gray-700 border-gray-300'
        } cursor-pointer transition-all duration-200 hover:shadow-lg`}
        onClick={() => onMapTypeChange(mapType === 'satellite' ? 'roadmap' : 'satellite')}
      >
        {mapType === 'satellite' ? 'Map' : 'Satellite'}
      </button>
    </div>
  );

  return (
    <>
      {desktopControls}
      {mobileControls}
    </>
  );
}; 