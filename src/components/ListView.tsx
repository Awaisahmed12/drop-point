import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import type { PropertyWithFileCount } from '../../types';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

interface ListViewProps {
  properties: PropertyWithFileCount[];
  loading: boolean;
  error: string | null;
  onPropertySelect: (property: PropertyWithFileCount) => void;
  /** Persist a new label. Throw to keep the dialog open with an error. */
  onRenameProperty: (property: PropertyWithFileCount, label: string) => Promise<void>;
}

const parseAddress = (fullAddress: string) => {
  if (!fullAddress) return { streetAddress: '', locationInfo: '' };
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return { streetAddress: fullAddress.trim(), locationInfo: '' };
  return { streetAddress: parts[0], locationInfo: parts.slice(1).join(', ') };
};

const streetViewUrl = (p: PropertyWithFileCount, size: string) =>
  `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${p.lat},${p.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
const staticMapUrl = (p: PropertyWithFileCount, size: string) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${p.lat},${p.lng}&zoom=17&size=${size}&maptype=roadmap&markers=color:blue%7C${p.lat},${p.lng}&key=${GOOGLE_MAPS_API_KEY}`;

const swapToFallback = (e: React.SyntheticEvent<HTMLImageElement>, fallbackSrc: string) => {
  const t = e.currentTarget;
  if (t.dataset.fallback !== '1') {
    t.dataset.fallback = '1';
    t.src = fallbackSrc;
  }
};

/** The Properties page body: search, then a card per property. */
export const ListView = ({ properties, loading, error, onPropertySelect, onRenameProperty }: ListViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyMenuId, setPropertyMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number }>({});
  const [renamingProperty, setRenamingProperty] = useState<PropertyWithFileCount | null>(null);
  const [renamingPropertyName, setRenamingPropertyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const propertyMenuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const query = searchQuery.toLowerCase().trim();
  const sortedProperties = properties
    .filter(p => !query || p.address.toLowerCase().includes(query) || (p.label?.toLowerCase() ?? '').includes(query))
    .sort((a, b) => {
      const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
      const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
      return bDate.getTime() - aDate.getTime();
    });

  // Desktop: land in the search box. Touch devices would pop the keyboard.
  useEffect(() => {
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      if (propertyMenuRef.current && !propertyMenuRef.current.contains(e.target as Node)) setPropertyMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  const openMenu = (button: HTMLElement, propertyId: string) => {
    const rect = button.getBoundingClientRect();
    const left = rect.left - 176 + rect.width;
    setMenuPosition(
      window.innerHeight - rect.bottom >= 160
        ? { top: rect.bottom + 6, left }
        : { bottom: window.innerHeight - rect.top + 6, left },
    );
    setPropertyMenuId(propertyId);
  };

  const closeRenameDialog = () => {
    setRenamingProperty(null);
    setRenamingPropertyName('');
    setRenameError(null);
  };

  const submitRename = async () => {
    if (!renamingProperty) return;
    const trimmed = renamingPropertyName.trim();
    if (!trimmed) {
      setRenameError('Name cannot be empty.');
      return;
    }
    setIsSaving(true);
    setRenameError(null);
    try {
      await onRenameProperty(renamingProperty, trimmed);
      closeRenameDialog();
    } catch (err) {
      logger.error('Rename failed:', err);
      setRenameError('Failed to rename. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyAddress = (property: PropertyWithFileCount) => {
    navigator.clipboard.writeText(property.address)
      .then(() => showToast('Address copied', 'success'))
      .catch(() => showToast('Could not copy address.'));
    setPropertyMenuId(null);
  };

  // Rendered via plain functions (not nested component definitions) so the
  // dialog input keeps focus between keystrokes.
  const renderRenameDialog = () => renamingProperty && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={closeRenameDialog}
      onTouchEnd={e => { e.preventDefault(); closeRenameDialog(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 mb-1">Rename Property</h3>
        <p className="text-sm text-gray-400 mb-4">Give this property a custom label</p>
        <input
          type="text"
          value={renamingPropertyName}
          onChange={e => { setRenamingPropertyName(e.target.value); setRenameError(null); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !isSaving) submitRename();
            else if (e.key === 'Escape') closeRenameDialog();
          }}
          className={`w-full px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all mb-1 disabled:opacity-50 ${renameError ? 'border-red-300' : 'border-gray-200'}`}
          placeholder="e.g. Beach House, Investment #1"
          autoFocus
          disabled={isSaving}
        />
        <p className={`text-xs mb-3 ${renameError ? 'text-red-500' : 'invisible'}`}>{renameError || ' '}</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            onClick={closeRenameDialog} disabled={isSaving}>Cancel</button>
          <button className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            onClick={submitRename} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );

  const renderActionMenu = (property: PropertyWithFileCount, btnClassName: string) => (
    <div className="relative">
      <button
        className={btnClassName}
        onClick={e => {
          e.stopPropagation();
          if (propertyMenuId === property.id) setPropertyMenuId(null);
          else if (property.id) openMenu(e.currentTarget, property.id);
        }}
        onTouchEnd={e => e.stopPropagation()}
        title="Property actions"
        aria-label="Property actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {propertyMenuId === property.id && (
        <div ref={propertyMenuRef} role="menu" className="fixed w-44 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
             style={{ zIndex: 999999, ...menuPosition }}
             onClick={e => e.stopPropagation()}
             onPointerDown={e => e.stopPropagation()}
             onTouchEnd={e => e.stopPropagation()}>
          {[
            {
              label: 'Open',
              action: () => { onPropertySelect(property); setPropertyMenuId(null); },
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />,
            },
            {
              label: 'Rename',
              action: () => { setRenamingProperty(property); setRenamingPropertyName(property.label || ''); setPropertyMenuId(null); },
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
            },
            {
              label: 'Copy Address',
              action: () => copyAddress(property),
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m2 4h2a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2v-2" />,
            },
          ].map(item => (
            <button
              key={item.label}
              role="menuitem"
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
              onClick={e => { e.stopPropagation(); item.action(); }}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); item.action(); }}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{item.icon}</svg>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderCardBody = (property: PropertyWithFileCount, titleClass: string) => {
    const { streetAddress, locationInfo } = parseAddress(property.address);
    return (
      <div className="px-4 py-3">
        <div className={titleClass}>{property.label || streetAddress || property.address}</div>
        {property.label && <div className="text-xs text-gray-400 truncate mt-0.5">{streetAddress}</div>}
        {locationInfo && <div className="text-xs text-gray-400 truncate mt-0.5">{locationInfo}</div>}
      </div>
    );
  };

  const fileCountBadge = (property: PropertyWithFileCount, className: string) => (
    <div className={className}>
      {property.file_count} {property.file_count === 1 ? 'file' : 'files'}
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-8 pb-24">
      <div className="pt-5 sm:pt-8 pb-4 sm:pb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Properties</h1>
        <p className="text-sm text-gray-400 mt-1">
          {searchQuery
            ? `${sortedProperties.length} of ${properties.length} properties`
            : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
        </p>
      </div>

      <div className="relative mb-4 sm:mb-6 sm:max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search properties…"
          aria-label="Search properties"
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">No properties yet</h3>
          <p className="text-sm text-gray-400 max-w-xs">Head to the map and drop a pin to start managing your properties.</p>
        </div>
      ) : sortedProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MagnifyingGlassIcon className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No properties match <span className="font-medium text-gray-700">&ldquo;{searchQuery}&rdquo;</span></p>
        </div>
      ) : (
        <>
          {/* Desktop: card grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProperties.map(property => (
              <div
                key={property.id}
                onClick={() => onPropertySelect(property)}
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="relative h-44 bg-gray-100 overflow-hidden">
                  <Image
                    src={streetViewUrl(property, '640x400')}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                    onError={e => swapToFallback(e, staticMapUrl(property, '640x400'))}
                  />
                  {fileCountBadge(property, 'absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-lg')}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {renderActionMenu(property, 'p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm transition-all')}
                  </div>
                </div>
                {renderCardBody(property, 'text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors')}
              </div>
            ))}
          </div>

          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-3">
            {sortedProperties.map(property => (
              <div
                key={property.id}
                onClick={() => onPropertySelect(property)}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.985] active:shadow-none"
              >
                <div className="relative h-36 bg-gray-100 overflow-hidden">
                  <Image
                    src={streetViewUrl(property, '600x280')}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                    onError={e => swapToFallback(e, staticMapUrl(property, '600x280'))}
                  />
                  {fileCountBadge(property, 'absolute bottom-2.5 left-3 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-full')}
                  <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                    {renderActionMenu(property, 'p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white shadow-sm transition-all')}
                  </div>
                </div>
                {renderCardBody(property, 'text-[15px] font-semibold text-gray-900 truncate')}
              </div>
            ))}
          </div>
        </>
      )}

      {renderRenameDialog()}
    </div>
  );
};
