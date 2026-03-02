import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useUserProperties } from '../hooks/useUserProperties';
import type { PropertyWithFileCount } from '../../types';

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
  
  const { properties, loading } = useUserProperties();

  // Filter properties based on search query (keep current property but we'll handle it specially)
  const filteredProperties = properties.filter(property => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const addressLower = property.address.toLowerCase();
    const labelLower = property.label?.toLowerCase() || '';
    
    // Search by custom name (label) first, then by address
    return labelLower.includes(query) || addressLower.includes(query);
  });

  // Sort by last accessed (most recent first)
  const sortedProperties = filteredProperties.sort((a, b) => {
    const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
    const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
    return bDate.getTime() - aDate.getTime();
  });

  // Limit to 20 properties for performance
  const displayProperties = sortedProperties.slice(0, 20);

  // Simple cleanup when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Focus search input when dropdown opens - REMOVED to prevent mobile keyboard popup

  // Handle property selection
  const handlePropertySelect = async (property: PropertyWithFileCount) => {
    await onPropertySelect(property);
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
    <>
      {/* Click blocker overlay when dropdown is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998] bg-transparent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            setSearchQuery('');
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}
      
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
          className={`w-4 h-4 text-gray-700 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Mobile: Large Centered Dropdown */}
      {isOpen && (
        <div className="fixed inset-4 z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col sm:hidden" style={{ 
          top: '10vh',
          bottom: '10vh',
          left: '5vw',
          right: '5vw',
          maxHeight: '80vh'
        }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-200 flex-shrink-0 rounded-t-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Switch Property</h2>
            <button
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by custom name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base text-gray-900 placeholder:text-gray-500"
                style={{ fontSize: '16px' }} // Prevent zoom on iOS
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Properties List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Loading properties...
              </div>
            ) : displayProperties.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchQuery ? 'No properties match your search' : 'No other properties found'}
              </div>
            ) : (
              displayProperties.map((property) => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                const isCurrentProperty = currentProperty && property.id === currentProperty.id;
                
                return (
                  <button
                    key={property.id}
                    onClick={() => !isCurrentProperty && handlePropertySelect(property)}
                    disabled={isCurrentProperty}
                    className={`w-full px-4 py-4 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                      isCurrentProperty 
                        ? 'bg-blue-50 cursor-not-allowed opacity-75' 
                        : 'hover:bg-gray-50 cursor-pointer active:bg-gray-100'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm ${
                          isCurrentProperty ? 'text-blue-700' : 'text-gray-900'
                        }`}>
                          {property.label || streetAddress || property.address}
                        </div>
                        
                        {/* Show real address below custom name, or just location info if no custom name */}
                        {property.label && (
                          <div className={`text-xs mt-1 ${
                            isCurrentProperty ? 'text-blue-600' : 'text-gray-500'
                          } italic`}>
                            {streetAddress}
                          </div>
                        )}
                        
                        {locationInfo && !property.label && (
                          <div className={`text-xs mt-1 ${
                            isCurrentProperty ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {locationInfo}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                          isCurrentProperty 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {property.file_count} file{property.file_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            
            {/* Show more indicator if there are more than 20 properties */}
            {sortedProperties.length > 20 && (
              <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-b-2xl">
                Showing first 20 properties. Use search to find more.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop: Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] hidden sm:block" style={{ 
          zIndex: 9999,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          width: 'min(50vw, 400px)',
          maxHeight: '60vh'
        }}>
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by custom name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Properties List */}
          <div className="overflow-y-auto max-h-72">
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
                const isCurrentProperty = currentProperty && property.id === currentProperty.id;
                
                return (
                  <button
                    key={property.id}
                    onClick={() => !isCurrentProperty && handlePropertySelect(property)}
                    disabled={isCurrentProperty}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-b-0 ${
                      isCurrentProperty 
                        ? 'bg-blue-50 cursor-not-allowed opacity-75' 
                        : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${
                          isCurrentProperty ? 'text-blue-700' : 'text-gray-900'
                        }`}>
                          {property.label || streetAddress || property.address}
                        </div>
                        
                        {/* Show real address below custom name, or just location info if no custom name */}
                        {property.label && (
                          <div className={`text-xs mt-0.5 ${
                            isCurrentProperty ? 'text-blue-600' : 'text-gray-500'
                          } italic`}>
                            {streetAddress}
                          </div>
                        )}
                        
                        {locationInfo && !property.label && (
                          <div className={`text-xs mt-0.5 ${
                            isCurrentProperty ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {locationInfo}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isCurrentProperty 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
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
    </>
  );
}; 