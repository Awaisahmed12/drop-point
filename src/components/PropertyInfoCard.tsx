import { logger } from '../utils/logger';
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
  /** Fires on pointerdown of the close button — before the click event in
   *  the same gesture. Lets the parent pre-emptively suppress map-level
   *  click handlers so a click that "leaks through" to Google Maps' native
   *  listener (which doesn't honor React's stopPropagation) doesn't drop
   *  a pin under the card. */
  onCloseStart?: () => void;
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
  onCloseStart,
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
          logger.error('Error updating property label:', error);
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
      logger.error('Error updating property label:', error);
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
    <div
      className="absolute left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4"
      style={{ bottom: '88px' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div 
        ref={cardRef}
        className="bg-white rounded-2xl shadow-xl p-4 flex flex-col gap-3 border border-gray-200 animate-fade-in relative"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {onClose && !isEditing && (
          <button
            aria-label="Close"
            className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 active:scale-90 transition-all duration-150"
            // Fires first in any click/tap gesture — used to set the parent's
            // map-click-suppress flag BEFORE the click event reaches Google
            // Maps' native listener. Without this the synthesized click on
            // mobile (or a Google listener that runs before our React onClick
            // in some browser/lib combos) drops a pin underneath the closing
            // card, immediately re-opening a new card at those coordinates.
            onPointerDown={(e) => {
              e.stopPropagation();
              onCloseStart?.();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            title="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                  <div className="flex items-center gap-1.5 group/name">
                    <h3 className="text-gray-900 text-base font-semibold break-words">
                      {displayName}
                    </h3>
                    {/* Edit name — visible on hover only */}
                    <button
                      onClick={handleStartEdit}
                      className="p-1 text-gray-300 hover:text-blue-600 opacity-0 group-hover/name:opacity-100 transition-all"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
          className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold text-[15px] shadow-sm hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          disabled={addressLoading || !address || address === 'No address found' || address === 'Error fetching address'}
          onClick={() => {
            onSelect();
          }}
        >
          {property?.id ? 'Open' : 'Select Location'}
        </button>
      </div>
    </div>
  );
}; 
