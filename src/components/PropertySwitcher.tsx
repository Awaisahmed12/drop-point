import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useUserProperties, type PropertyWithFileCount } from '../hooks/useUserProperties';
import { useMobileViewport } from '../hooks/useMobileViewport';

interface PropertySwitcherProps {
  currentProperty: PropertyWithFileCount | null;
  onPropertySelect: (property: PropertyWithFileCount) => void;
  disabled?: boolean;
}

export const PropertySwitcher = ({ 
  currentProperty, 
  onPropertySelect, 
  disabled = false 
}: PropertySwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { isMobile } = useMobileViewport();
  const { properties, loading } = useUserProperties();

  // Debug logging
  useEffect(() => {
    console.log('PropertySwitcher - Properties:', properties.length, properties);
    console.log('PropertySwitcher - Current property:', currentProperty);
    console.log('PropertySwitcher - Loading:', loading);
  }, [properties, currentProperty, loading]);

  // Filter properties based on search query and exclude current property
  const filteredProperties = properties.filter(property => {
    if (currentProperty && property.id === currentProperty.id) return false;
    if (!searchQuery) return true;
    return property.address.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort by last accessed (most recent first)
  const sortedProperties = filteredProperties.sort((a, b) => {
    const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
    const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
    return bDate.getTime() - aDate.getTime();
  });

  // Limit to 20 properties for performance
  const displayProperties = sortedProperties.slice(0, 20);

  // Debug logging for filtered properties
  useEffect(() => {
    console.log('PropertySwitcher - Filtered properties:', filteredProperties.length);
    console.log('PropertySwitcher - Display properties:', displayProperties.length, displayProperties);
  }, [filteredProperties, displayProperties]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle property selection
  const handlePropertySelect = (property: PropertyWithFileCount) => {
    onPropertySelect(property);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Parse address for display
  const parseAddress = (fullAddress: string) => {
    if (!fullAddress) return { streetAddress: '', locationInfo: '' };
    
    const parts = fullAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
    
    if (parts.length < 2) {
      return { streetAddress: fullAddress.trim(), locationInfo: '' };
    }
    
    const streetAddress = parts[0];
    const locationInfo = parts.slice(1).join(', ');
    
    return { streetAddress, locationInfo };
  };

  if (loading || !currentProperty) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all duration-200 ${
          disabled 
            ? 'cursor-not-allowed opacity-50' 
            : 'cursor-pointer hover:bg-blue-50 hover:shadow-sm'
        } bg-white/80 border border-gray-200/60 backdrop-blur-sm`}
        onKeyDown={handleKeyDown}
        title="Switch property"
      >
        <span className="text-xs font-medium text-gray-600 hidden sm:inline">
          Switch
        </span>
        <ChevronDownIcon 
          className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} text-gray-700 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] ${
          isMobile 
            ? 'w-80 max-w-[calc(100vw-2rem)]' 
            : 'w-96'
        }`} style={{ 
          zIndex: 9999,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Properties List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Loading properties...
              </div>
            ) : displayProperties.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No properties match your search' : 'No other properties found'}
              </div>
            ) : (
              displayProperties.map((property) => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                
                return (
                  <button
                    key={property.id}
                    onClick={() => handlePropertySelect(property)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate text-sm">
                          {streetAddress || property.address}
                        </div>
                        {locationInfo && (
                          <div className="text-xs text-gray-500 truncate mt-0.5">
                            {locationInfo}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {property.file_count} file{property.file_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Show more indicator if there are more than 20 properties */}
          {sortedProperties.length > 20 && (
            <div className="p-3 border-t border-gray-100 text-center text-xs text-gray-500">
              Showing first 20 properties. Use search to find more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 