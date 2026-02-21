import { useState, useRef, useEffect } from 'react';
import type { Property } from '../../types';

interface PropertyInfoCardProps {
  address: string;
  addressLoading: boolean;
  property?: Property | null;
  onSelect: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
  onPropertyUpdate?: (property: Property) => void;
  onPropertySave?: (property: Property) => Promise<void>;
  onHeightChange?: (height: number) => void;
}

export const PropertyInfoCard = ({ 
  address, 
  addressLoading, 
  property,
  onSelect, 
  onMouseEnter, 
  onMouseLeave,
  onClose,
  onPropertyUpdate,
  onPropertySave,
  onHeightChange
}: PropertyInfoCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState(property?.label || '');
  const [isSaving, setIsSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure card height and report changes
  useEffect(() => {
    if (cardRef.current && onHeightChange) {
      const resizeObserver = new ResizeObserver(() => {
        if (cardRef.current) {
          onHeightChange(cardRef.current.offsetHeight);
        }
      });
      
      resizeObserver.observe(cardRef.current);
      
      // Initial measurement
      onHeightChange(cardRef.current.offsetHeight);
      
      return () => resizeObserver.disconnect();
    }
  }, [onHeightChange, isEditing]); // Re-measure when editing state changes

  // Parse address to show street and location separately
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

  const { streetAddress, locationInfo } = parseAddress(address);
  const displayName = property?.label || streetAddress || address;
  const showRealAddress = property?.label && property.label.trim() !== streetAddress;

  // Save custom name to database or update local property
  const handleSaveName = async () => {
    setIsSaving(true);
    try {
      if (property?.id && onPropertyUpdate) {
        // Saved property - update in database
        const { supabase } = await import('../utils/supabaseClient');
        const { error } = await supabase
          .from('properties')
          .update({ label: customName.trim() || null })
          .eq('id', property.id);

        if (error) {
          console.error('Error updating property label:', error);
          return;
        }

        // Update the property object
        const updatedProperty = { ...property, label: customName.trim() || null };
        onPropertyUpdate(updatedProperty);
      } else {
        // Unsaved property - automatically save it when renamed
        if (onPropertySave && property) {
          const updatedProperty = { ...property, label: customName.trim() || null };
          await onPropertySave(updatedProperty);
        } else if (onPropertyUpdate && property) {
          // Fallback to just updating local state
          const updatedProperty = { ...property, label: customName.trim() || null };
          onPropertyUpdate(updatedProperty);
        }
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating property label:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit mode
  const handleStartEdit = () => {
    setCustomName(property?.label || streetAddress || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setCustomName(property?.label || '');
    setIsEditing(false);
  };
  return (
    <div className="absolute left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4"
         style={{ bottom: '88px' }}
         onClick={e => e.stopPropagation()}
         onPointerDown={e => e.stopPropagation()}>
      <div 
        ref={cardRef}
        className="bg-white rounded-2xl shadow-xl p-4 flex flex-col gap-3 border border-gray-200 animate-fade-in relative"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {onClose && !isEditing && (
          <button
            aria-label="Close"
            className="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation(); // Prevent event from bubbling up to map
              onClose();
            }}
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="w-full">
          {addressLoading ? (
            <div className="flex items-center gap-2 text-gray-900 text-base font-semibold">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading address...
            </div>
          ) : (
            <>
              {/* Property Name Section */}
              {isEditing ? (
                <div className="w-full space-y-3">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSaving) {
                        e.preventDefault();
                        handleSaveName();
                      } else if (e.key === 'Escape' && !isSaving) {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    className="w-full px-3 py-2 text-base font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={streetAddress || "Enter property name"}
                    autoFocus
                    disabled={isSaving}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveName}
                      disabled={isSaving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  {/* Main Name Display */}
                  <div className="flex items-center gap-2">
                    <h3 className="text-gray-900 text-base font-semibold break-words">
                      {displayName}
                    </h3>
                    {/* Allow renaming for both saved and unsaved properties */}
                    <button
                      onClick={handleStartEdit}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit property name"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Real Address (when custom name is used) */}
                  {showRealAddress && (
                    <div className="text-sm text-gray-600">
                      {streetAddress}
                    </div>
                  )}

                  {/* Location Info */}
                  {locationInfo && (
                    <div className="text-xs text-gray-500">
                      {locationInfo}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <button
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold shadow hover:bg-blue-700 transition-all disabled:opacity-60 cursor-pointer"
          disabled={addressLoading || !address || address === 'No address found' || address === 'Error fetching address'}
          onClick={() => {
            onSelect();
          }}
        >
          {property?.id ? 'Open' : 'Select'}
        </button>
      </div>
    </div>
  );
}; 