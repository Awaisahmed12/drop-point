import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { useUserProperties } from '../hooks/useUserProperties';
import { useResponsiveValue } from '../hooks/useResponsiveValue';
import type { PropertyWithFileCount } from '../../types';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { supabase } from '../utils/supabaseClient';

interface ListViewProps {
  isOpen: boolean;
  onPropertySelect: (property: PropertyWithFileCount) => void;
  onClose: () => void;
  variant?: 'modal' | 'page';
}

export const ListView = ({ 
  isOpen,
  onPropertySelect, 
  onClose,
  variant = 'modal'
}: ListViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyMenuId, setPropertyMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{[key: string]: {top?: number, bottom?: number, left?: number, right?: number}}>({});
  const [renamingPropertyId, setRenamingPropertyId] = useState<string | null>(null);
  const [renamingPropertyName, setRenamingPropertyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const propertyMenuRef = useRef<HTMLDivElement>(null);
  
  const { getModalDimensions, mobileClasses } = useMobileViewport();
  const { properties, loading, error, refreshProperties } = useUserProperties();
  const streetViewSize = useResponsiveValue('200x200', '160x160');
  const streetViewDimension = useResponsiveValue(200, 160);

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
    
    const query = searchQuery.toLowerCase().trim();
    const addressLower = property.address.toLowerCase();
    const labelLower = property.label?.toLowerCase() || '';
    
    // Search by custom name (label) first, then by address
    return labelLower.includes(query) || addressLower.includes(query);
  });

  const sortedProperties = filteredProperties.sort((a, b) => {
    const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
    const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
    return bDate.getTime() - aDate.getTime();
  });

  // Auto-focus search when modal opens (desktop only)
  useEffect(() => {
    if (!isOpen) return;
    // avoid focusing on touch devices to prevent mobile keyboard popups
    const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (!isTouch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPropertyMenuId(null);
      setRenamingPropertyId(null);
      setRenamingPropertyName('');
    }
  }, [isOpen]);

  // Calculate menu position
  const calculateMenuPosition = (button: HTMLElement, propertyId: string) => {
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow >= 200) {
      // Position below
      setMenuPosition(prev => ({
        ...prev,
        [propertyId]: {
          top: rect.bottom + 8,
          left: rect.left - 150 + rect.width // Align right edge
        }
      }));
    } else if (spaceAbove >= 200) {
      // Position above
      setMenuPosition(prev => ({
        ...prev,
        [propertyId]: {
          bottom: window.innerHeight - rect.top + 8,
          left: rect.left - 150 + rect.width // Align right edge
        }
      }));
    } else {
      // Position to the right
      setMenuPosition(prev => ({
        ...prev,
        [propertyId]: {
          top: rect.top,
          left: rect.right + 8
        }
      }));
    }
  };

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (propertyMenuRef.current && !propertyMenuRef.current.contains(event.target as Node)) {
        setPropertyMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle property rename
  const handleRename = async (property: PropertyWithFileCount, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setRenameError('Name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      setRenameError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRenameError('Session expired. Please refresh and try again.');
        return;
      }

      const { error } = await supabase
        .from('properties')
        .update({ label: trimmedName })
        .eq('id', property.id)
        .eq('user_id', session.user.id);

      if (error) {
        setRenameError('Failed to rename. Please try again.');
        return;
      }

      setRenamingPropertyId(null);
      setRenamingPropertyName('');
      setPropertyMenuId(null);
      await refreshProperties();
    } catch {
      setRenameError('Failed to rename. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
        {/* Header - matches PropertyDetailsModal style with blue accents */}
        <div className="modal-header-refined flex items-center justify-between px-5 py-4 rounded-t-3xl flex-shrink-0 bg-gradient-to-r from-blue-50/50 to-white border-b border-blue-100/60">
          <div className="flex flex-col min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              <h1 className="property-title text-lg sm:text-xl font-semibold leading-tight text-gray-900" 
                  style={{ letterSpacing: '-0.02em' }}>
                Properties
              </h1>
            </div>
            <p className="property-location text-sm sm:text-base font-medium leading-snug text-gray-600 ml-3" 
               style={{ letterSpacing: '-0.005em' }}>
              {searchQuery ? (
                `${sortedProperties.length} of ${properties.length} properties`
              ) : (
                `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`
              )}
            </p>
          </div>
          
          {/* Page variant has no close button; show a subtle back link on mobile */}
          {variant === 'modal' ? (
            <button
              className="close-button p-2.5 rounded-full cursor-pointer flex-shrink-0 hover:bg-blue-50 transition-colors"
              onClick={onClose}
              title="Close"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 transition-colors" />
            </button>
          ) : (
            <div className="flex-shrink-0">
              <Link href="/map" className="hidden sm:inline-flex px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700 font-medium hover:bg-blue-100 hover:border-blue-300 transition-all duration-200">
                Back to Map
              </Link>
            </div>
          )}
        </div>

        {/* Search Bar - integrated into modal with blue accents */}
        <div className="px-6 py-4 sm:px-5 border-b border-blue-100/60 flex-shrink-0 bg-gradient-to-b from-blue-50/40 to-white">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <MagnifyingGlassIcon className="w-5 h-5 text-blue-500" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by custom name or address..."
              className="w-full pl-10 pr-4 py-3 bg-white border-2 border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md hover:border-blue-200 text-base sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-blue-50 transition-colors duration-200"
              >
                <XMarkIcon className="w-4 h-4 text-blue-500" />
              </button>
            )}
          </div>
        </div>

        {/* Properties List - matches PropertyDetailsModal scrollable area */}
        <div className="flex-1 overflow-y-auto file-list overflow-x-visible mobile-scroll" style={{ 
          minHeight: '200px',
          paddingBottom: variant === 'modal' ? 'env(safe-area-inset-bottom, 0px)' : '0'
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
                {variant === 'page' ? (
                  <Link href="/map" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]">Back to Map</Link>
                ) : (
                  <button
                    onClick={onClose}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    Back to Map
                  </button>
                )}
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
            <div className="px-4 py-3 sm:px-5">
              {sortedProperties.map((property) => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                
                return (
                  <div
                    key={property.id}
                    onClick={() => {
                      // Don't allow property selection when renaming
                      if (renamingPropertyId === property.id) return;
                      onPropertySelect(property);
                      if (variant === 'modal') onClose();
                    }}
                    className={`flex items-center justify-between px-4 py-4 sm:py-3.5 min-h-[80px] sm:min-h-[64px] rounded-xl transition-all duration-200 border border-gray-200/60 mb-3 shadow-sm ${
                      renamingPropertyId === property.id 
                        ? 'cursor-default bg-blue-50/30 border-gray-200' 
                        : 'cursor-pointer hover:bg-blue-50/30 hover:shadow-md hover:border-blue-200/60 group active:scale-[0.998]'
                    }`}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      {/* Street View thumbnail - refined styling with blue accent */}
                      <div className="w-20 h-20 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-gray-100 mr-4 flex-shrink-0 border-2 border-blue-100 shadow-sm group-hover:border-blue-400 group-hover:shadow-md transition-all duration-200 ring-2 ring-transparent group-hover:ring-blue-100">
                        <Image
                          src={`https://maps.googleapis.com/maps/api/streetview?size=${streetViewSize}&location=${property.lat},${property.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`}
                          alt="Street View preview"
                          width={streetViewDimension}
                          height={streetViewDimension}
                          className="w-full h-full object-cover"
                          unoptimized
                          onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement;
                            if (t.dataset.fallback !== '1') {
                              t.dataset.fallback = '1';
                              t.src = `https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=17&size=${streetViewSize}&maptype=roadmap&markers=color:blue%7C${property.lat},${property.lng}&key=${GOOGLE_MAPS_API_KEY}`;
                            }
                          }}
                        />
                      </div>
                      
                      {/* Normal Property Display */}
                      <div className="flex-1 min-w-0">
                        {/* Custom Name or Street Address - matches PropertyDetailsModal styling */}
                        <div className="text-gray-900 font-semibold truncate text-lg sm:text-base group-hover:text-blue-600 transition-colors duration-200" style={{ letterSpacing: '-0.01em' }}>
                          {property.label || streetAddress || property.address}
                        </div>
                        
                        {/* Show real address below custom name, or just location info if no custom name */}
                        {property.label && (
                          <div className="text-sm sm:text-xs mt-1 sm:mt-0.5 text-gray-500 italic truncate">
                            {streetAddress}
                          </div>
                        )}
                        
                        {/* Location Info and File Count */}
                        <div className="text-sm sm:text-xs mt-1.5 sm:mt-1 text-gray-500">
                          <div className="space-y-0.5 sm:hidden">
                            {locationInfo && (
                              <div className="truncate">{locationInfo}</div>
                            )}
                            <div className="text-gray-600 font-medium">
                              {property.file_count} file{property.file_count === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-2">
                            {locationInfo && (
                              <>
                                <span className="truncate">{locationInfo}</span>
                                <span className="text-gray-400">•</span>
                              </>
                            )}
                            <span className="text-gray-600 font-medium">{property.file_count} file{property.file_count === 1 ? '' : 's'}</span>
                            {property.last_accessed && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>Last accessed {new Date(property.last_accessed).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    

                    {/* Three-dot menu - matches PropertyDetailsModal style with blue accent */}
                    <div className="ml-4 flex-shrink-0 relative">
                      <button
                        className="p-2 rounded-lg hover:bg-blue-50 group-hover:bg-blue-50 transition-all duration-200 active:scale-95"
                        style={{ minWidth: 32, minHeight: 32 }}
                        onClick={e => {
                          e.stopPropagation();
                          setPropertyMenuId(null);
                          const newMenuId = propertyMenuId === property.id ? null : property.id;
                          setPropertyMenuId(newMenuId);
                          if (newMenuId && property.id) {
                            calculateMenuPosition(e.currentTarget, property.id);
                          }
                        }}
                        title="Property actions"
                      >
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                        </svg>
                      </button>
                       
                      {/* Property Actions Menu */}
                      {propertyMenuId === property.id && (
                        <div 
                          ref={propertyMenuRef} 
                          className="fixed w-48 bg-white/98 backdrop-blur-xl border border-gray-200/60 rounded-xl shadow-2xl overflow-hidden"
                          style={{
                            zIndex: 999999,
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                            ...(property.id ? menuPosition[property.id] : {})
                          }}
                        >
                          <button
                            className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 border-b border-gray-100/60 first:rounded-t-xl"
                            onClick={e => {
                              e.stopPropagation();
                              onPropertySelect(property);
                              if (variant === 'modal') onClose();
                              setPropertyMenuId(null);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Property
                            </div>
                          </button>
                          <button
                            className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 border-b border-gray-100/60"
                            onClick={e => {
                              e.stopPropagation();
                              setRenamingPropertyId(property.id);
                              setRenamingPropertyName(property.label || '');
                              setPropertyMenuId(null);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Rename
                            </div>
                          </button>

                          <button
                            className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 last:rounded-b-xl"
                            onClick={e => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(property.address).then(() => {
                                setCopiedPropertyId(property.id);
                                setTimeout(() => setCopiedPropertyId(null), 2000);
                              });
                              setPropertyMenuId(null);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {copiedPropertyId === property.id ? (
                                <>
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-green-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8zM16 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-2M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8z" />
                                  </svg>
                                  Copy Address
                                </>
                              )}
                            </div>
                          </button>
                        </div>
                      )}
                     </div>
                     
                    {/* Rename Popup - appears when renaming this property */}
                    {renamingPropertyId === property.id && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200/60">
                          <div className="text-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rename Property</h3>
                            <p className="text-sm text-gray-500">Enter a new name for this property</p>
                          </div>

                          <div className="space-y-4">
                            <input
                              type="text"
                              value={renamingPropertyName}
                              onChange={(e) => { setRenamingPropertyName(e.target.value); setRenameError(null); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isSaving) {
                                  handleRename(property, renamingPropertyName);
                                } else if (e.key === 'Escape') {
                                  setRenamingPropertyId(null);
                                  setRenamingPropertyName('');
                                  setRenameError(null);
                                }
                              }}
                              className={`w-full px-4 py-3 text-lg font-medium text-gray-900 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${renameError ? 'border-red-400' : 'border-gray-200'}`}
                              placeholder="Enter property name"
                              autoFocus
                              disabled={isSaving}
                            />
                            {renameError && (
                              <p className="text-sm text-red-600">{renameError}</p>
                            )}

                            <div className="flex gap-3">
                              <button
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                                onClick={() => {
                                  setRenamingPropertyId(null);
                                  setRenamingPropertyName('');
                                  setRenameError(null);
                                }}
                                disabled={isSaving}
                              >
                                Cancel
                              </button>
                              <button
                                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm hover:shadow-md"
                                onClick={() => handleRename(property, renamingPropertyName)}
                                disabled={isSaving}
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 text-center">
                            <p className="text-xs text-gray-400">
                              Press Enter to save, Escape to cancel
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </>
  );

  return variant === 'modal' ? (
    <div
      className={`fixed inset-0 z-40 flex ${mobileClasses.modal} justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl flex flex-col border border-blue-100 relative overflow-hidden m-3 sm:m-0 max-h-[calc(100dvh-96px)] sm:max-h-none"
        style={{ 
          borderRadius: '1.5rem', 
          ...getModalDimensions(),
        }}
      >
        {content}
      </div>
    </div>
  ) : (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl shadow-sm w-full flex flex-col border border-blue-100 overflow-hidden">
        {content}
      </div>
    </div>
  );
}; 