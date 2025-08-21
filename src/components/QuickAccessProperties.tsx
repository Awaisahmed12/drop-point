import { useState, useEffect } from 'react';
import { useUserProperties } from '../hooks/useUserProperties';
import type { PropertyWithFileCount } from '../../types';

interface QuickAccessPropertiesProps {
  onPropertySelect: (property: PropertyWithFileCount) => void;
  isVisible: boolean;
}

export const QuickAccessProperties = ({ 
  onPropertySelect, 
  isVisible 
}: QuickAccessPropertiesProps) => {
  const { properties, loading } = useUserProperties();
  const [recentProperties, setRecentProperties] = useState<PropertyWithFileCount[]>([]);

  useEffect(() => {
    if (properties.length > 0) {
      // Sort by last accessed/updated and take top 4
      const sorted = [...properties].sort((a, b) => {
        const aDate = new Date(a.last_accessed || a.updated_at || a.created_at || '1970-01-01');
        const bDate = new Date(b.last_accessed || b.updated_at || b.created_at || '1970-01-01');
        return bDate.getTime() - aDate.getTime();
      });
      
      setRecentProperties(sorted.slice(0, 4));
    }
  }, [properties]);

  // Parse address for clean display
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

  if (!isVisible || loading || recentProperties.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-xl px-4">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Recent Properties</span>
          </div>
        </div>
        
        {/* Properties List */}
        <div className="divide-y divide-gray-100">
          {recentProperties.map((property) => {
            const { streetAddress, locationInfo } = parseAddress(property.address);
            const displayLabel = property.label || streetAddress;
            
            return (
              <button
                key={property.id}
                onClick={() => onPropertySelect(property)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors duration-150 group flex items-center gap-3"
              >
                {/* Property Icon */}
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
                  </svg>
                </div>
                
                {/* Property Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate text-sm">
                    {displayLabel}
                  </div>
                  {property.label && (
                    <div className="text-xs text-gray-600 truncate">
                      {streetAddress}
                    </div>
                  )}
                  {locationInfo && (
                    <div className="text-xs text-gray-500 truncate">
                      {locationInfo}
                    </div>
                  )}
                </div>
                
                {/* File Count Badge */}
                {property.file_count > 0 && (
                  <div className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                    {property.file_count} {property.file_count === 1 ? 'file' : 'files'}
                  </div>
                )}
                
                {/* Arrow Icon */}
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
