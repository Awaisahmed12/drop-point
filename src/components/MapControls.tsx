interface MapControlsProps {
  mapType: string;
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  isMobile?: boolean;
}

export const MapControls = ({ mapType, onMapTypeChange, isMobile = false }: MapControlsProps) => {
  const containerClasses = isMobile 
    ? "flex gap-2 mt-2 sm:hidden"
    : "hidden sm:flex absolute top-6 left-6 z-30 gap-2 bg-white rounded-lg shadow-lg p-2";

  return (
    <div className={containerClasses}>
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
}; 