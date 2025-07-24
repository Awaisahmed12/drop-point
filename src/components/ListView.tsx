import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useUserProperties, type PropertyWithFileCount } from '../hooks/useUserProperties';
import { useMobileViewport } from '../hooks/useMobileViewport';

interface ListViewProps {
  isOpen: boolean;
  onPropertySelect: (property: PropertyWithFileCount) => void;
  onClose: () => void;
}

export const ListView = ({ 
  isOpen,
  onPropertySelect, 
  onClose
}: ListViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { isMobile, getModalDimensions, mobileClasses } = useMobileViewport();
  const { properties, loading, error } = useUserProperties();

  // Parse address for clean display (same as PropertyDetailsModal)
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

  // Filter and sort properties
  const filteredProperties = properties.filter(property => {
    if (!searchQuery.trim()) return true;
    return property.address.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const sortedProperties = filteredProperties.sort((a, b) => {
    const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
    const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
    return bDate.getTime() - aDate.getTime();
  });

  // Auto-focus search when modal opens (desktop only)
  useEffect(() => {
    if (isOpen && !isMobile && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isMobile]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-40 flex ${mobileClasses.modal} justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl flex flex-col border border-blue-100 relative overflow-hidden"
        style={{ 
          borderRadius: '1.5rem', 
          ...getModalDimensions(),
          maxWidth: isMobile ? 'calc(100vw - 24px)' : undefined,
          margin: isMobile ? '12px' : undefined,
        }}
      >
        {/* Header - matches PropertyDetailsModal style */}
        <div className="modal-header-refined flex items-center justify-between px-5 py-4 rounded-t-3xl flex-shrink-0">
          <div className="flex flex-col min-w-0 flex-1 mr-4">
            <h1 className={`property-title ${isMobile ? 'text-lg' : 'text-xl'} font-semibold leading-tight mb-1`} 
                style={{ letterSpacing: '-0.02em' }}>
              Properties
            </h1>
            <p className={`property-location ${isMobile ? 'text-sm' : 'text-base'} font-medium leading-snug text-gray-500`} 
               style={{ letterSpacing: '-0.005em' }}>
              {searchQuery ? (
                `${sortedProperties.length} of ${properties.length} properties`
              ) : (
                `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`
              )}
            </p>
          </div>
          
          {/* Close button - matches PropertyDetailsModal */}
          <button
            className={`close-button ${isMobile ? 'p-2.5' : 'p-2.5'} rounded-full cursor-pointer flex-shrink-0 hover:bg-gray-100 transition-colors`}
            onClick={onClose}
            title="Close"
          >
            <XMarkIcon className={`${isMobile ? 'w-5 h-5' : 'w-5 h-5'} text-gray-500`} />
          </button>
        </div>

        {/* Search Bar - integrated into modal */}
        <div className={`${isMobile ? 'px-6 py-4' : 'px-5 py-4'} border-b border-gray-100 flex-shrink-0`}>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search properties..."
              className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 placeholder-gray-400 ${
                isMobile ? 'text-base' : 'text-sm'
              }`}
              style={{ fontSize: isMobile ? '16px' : undefined }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Properties List - matches PropertyDetailsModal scrollable area */}
        <div className="flex-1 overflow-y-auto file-list overflow-x-visible mobile-scroll" style={{ 
          minHeight: '200px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
          {loading ? (
            // Loading State - matches PropertyDetailsModal style
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading properties...</p>
              </div>
            </div>
          ) : error ? (
            // Error State
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5l-6.928-12c-.77-.833-2.186-.833-2.956 0l-6.928 12c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load properties</h3>
                <p className="text-gray-500">{error}</p>
              </div>
            </div>
          ) : properties.length === 0 ? (
            // Empty State
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No properties yet</h3>
                <p className="text-gray-500 mb-6">Start by selecting a property on the map and uploading some files.</p>
                <button
                  onClick={onClose}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Back to Map
                </button>
              </div>
            </div>
          ) : sortedProperties.length === 0 ? (
            // No Search Results
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MagnifyingGlassIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching properties</h3>
                <p className="text-gray-500">Try adjusting your search terms.</p>
              </div>
            </div>
          ) : (
            // Properties List - styled like PropertyDetailsModal file list
            <div className={`${isMobile ? 'px-6 py-3' : 'px-4 py-2'}`}>
              {sortedProperties.map((property) => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                
                return (
                  <div
                    key={property.id}
                    onClick={() => {
                      onPropertySelect(property);
                      onClose();
                    }}
                    className={`flex items-center justify-between ${isMobile ? 'px-4 py-4' : 'px-3 py-3'} hover:bg-gray-100 rounded-lg transition border border-gray-100 mb-2 cursor-pointer group`}
                    style={{ minHeight: isMobile ? '72px' : '56px' }}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      {/* Property Icon - like folder icon in PropertyDetailsModal */}
                      <div className={`${isMobile ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg bg-blue-100 flex items-center justify-center mr-4 flex-shrink-0`}>
                        <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-blue-600`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Street Address - matches PropertyDetailsModal styling */}
                        <div className={`text-gray-900 font-semibold truncate ${isMobile ? 'text-lg' : 'text-base'} group-hover:text-blue-600 transition-colors`}>
                          {streetAddress || property.address}
                        </div>
                        
                        {/* Location Info and File Count */}
                        <div className={`${isMobile ? 'text-sm mt-1' : 'text-xs mt-0.5'} text-gray-500`}>
                          {isMobile ? (
                            // Mobile: Stack location and file count vertically for better readability
                            <div className="space-y-1">
                              {locationInfo && (
                                <div className="truncate">{locationInfo}</div>
                              )}
                              <div className="text-gray-600 font-medium">
                                {property.file_count} file{property.file_count === 1 ? '' : 's'}
                              </div>
                            </div>
                          ) : (
                            // Desktop: Keep inline with dots
                            <div className="flex items-center gap-2">
                              {locationInfo && (
                                <>
                                  <span className="truncate">{locationInfo}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{property.file_count} file{property.file_count === 1 ? '' : 's'}</span>
                              {property.last_accessed && (
                                <>
                                  <span>•</span>
                                  <span>Last accessed {new Date(property.last_accessed).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Arrow - matches PropertyDetailsModal style */}
                    <div className="ml-4 flex-shrink-0">
                      <svg 
                        className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-gray-300 group-hover:text-blue-600 transition-colors`}
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 