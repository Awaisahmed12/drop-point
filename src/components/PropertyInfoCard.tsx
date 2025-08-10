interface PropertyInfoCardProps {
  address: string;
  addressLoading: boolean;
  onSelect: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const PropertyInfoCard = ({ 
  address, 
  addressLoading, 
  onSelect, 
  onMouseEnter, 
  onMouseLeave 
}: PropertyInfoCardProps) => {
  return (
    <div className="absolute left-1/2 transform -translate-x-1/2 z-30 w-full max-w-md px-4"
         style={{ bottom: '88px' }}>
      <div 
        className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 border border-blue-100 animate-fade-in relative"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="text-gray-900 text-lg font-semibold text-center">
          {addressLoading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading address...
            </div>
          ) : address}
        </div>
        <button
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow hover:bg-blue-700 transition-all disabled:opacity-60 cursor-pointer"
          disabled={addressLoading || !address || address === 'No address found' || address === 'Error fetching address'}
          onClick={() => {
            console.log('🏠 [PROPERTY] Select button clicked for address:', address);
            onSelect();
          }}
        >
          Select
        </button>
      </div>
    </div>
  );
}; 