import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { useUserProperties } from '../hooks/useUserProperties';
import type { PropertyWithFileCount } from '../../types';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../contexts/ToastContext';

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
  variant = 'modal',
}: ListViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyMenuId, setPropertyMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ [key: string]: { top?: number; bottom?: number; left?: number; right?: number } }>({});
  const [renamingPropertyId, setRenamingPropertyId] = useState<string | null>(null);
  const [renamingPropertyName, setRenamingPropertyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const propertyMenuRef = useRef<HTMLDivElement>(null);

  const { showToast } = useToast();
  const { getModalDimensions, mobileClasses } = useMobileViewport();
  const { properties, loading, error, refreshProperties } = useUserProperties();

  const parseAddress = (fullAddress: string) => {
    if (!fullAddress) return { streetAddress: '', locationInfo: '' };
    const parts = fullAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length < 2) return { streetAddress: fullAddress.trim(), locationInfo: '' };
    return { streetAddress: parts[0], locationInfo: parts.slice(1).join(', ') };
  };

  const filteredProperties = properties.filter(property => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return property.address.toLowerCase().includes(query) || (property.label?.toLowerCase() ?? '').includes(query);
  });

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
    const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
    return bDate.getTime() - aDate.getTime();
  });

  useEffect(() => {
    if (!isOpen) return;
    const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (!isTouch && searchInputRef.current) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) { setSearchQuery(''); setPropertyMenuId(null); setRenamingPropertyId(null); setRenamingPropertyName(''); }
  }, [isOpen]);

  const calculateMenuPosition = (button: HTMLElement, propertyId: string) => {
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= 160) {
      setMenuPosition(prev => ({ ...prev, [propertyId]: { top: rect.bottom + 6, left: rect.left - 144 + rect.width } }));
    } else {
      setMenuPosition(prev => ({ ...prev, [propertyId]: { bottom: window.innerHeight - rect.top + 6, left: rect.left - 144 + rect.width } }));
    }
  };

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

  const handleRename = async (property: PropertyWithFileCount, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) { setRenameError('Name cannot be empty.'); return; }
    try {
      setIsSaving(true); setRenameError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRenameError('Session expired. Please refresh.'); return; }
      const { error } = await supabase.from('properties').update({ label: trimmedName }).eq('id', property.id).eq('user_id', session.user.id);
      if (error) { setRenameError('Failed to rename. Please try again.'); return; }
      setRenamingPropertyId(null); setRenamingPropertyName(''); setPropertyMenuId(null);
      await refreshProperties();
      showToast('Property renamed');
    } catch { setRenameError('Failed to rename. Please try again.'); }
    finally { setIsSaving(false); }
  };

  if (!isOpen) return null;

  // ── Rename dialog (shared) ────────────────────────────────────────────────────
  const closeRenameDialog = () => { setRenamingPropertyId(null); setRenamingPropertyName(''); setRenameError(null); };
  const RenameDialog = ({ property }: { property: PropertyWithFileCount }) => (
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
            if (e.key === 'Enter' && !isSaving) handleRename(property, renamingPropertyName);
            else if (e.key === 'Escape') closeRenameDialog();
          }}
          className={`w-full px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all mb-1 disabled:opacity-50 ${renameError ? 'border-red-300' : 'border-gray-200'}`}
          placeholder="e.g. Beach House, Investment #1"
          autoFocus
          disabled={isSaving}
        />
        {renameError && <p className="text-xs text-red-500 mb-3">{renameError}</p>}
        {!renameError && <div className="mb-3" />}
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            onClick={closeRenameDialog} disabled={isSaving}>Cancel</button>
          <button className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            onClick={() => handleRename(property, renamingPropertyName)} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );

  // ── Three-dot dropdown (shared) ───────────────────────────────────────────────
  const ActionMenu = ({ property, btnClassName }: { property: PropertyWithFileCount; btnClassName?: string }) => (
    <div className="relative">
      <button
        className={btnClassName ?? 'p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all'}
        onClick={e => {
          e.stopPropagation();
          const newId = propertyMenuId === property.id ? null : property.id;
          setPropertyMenuId(newId);
          if (newId && property.id) calculateMenuPosition(e.currentTarget, property.id);
        }}
        onTouchEnd={e => e.stopPropagation()}
        title="Property actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {propertyMenuId === property.id && (
        <div ref={propertyMenuRef} className="fixed w-44 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
             style={{ zIndex: 999999, ...(property.id ? menuPosition[property.id] : {}) }}
             onClick={e => e.stopPropagation()}
             onPointerDown={e => e.stopPropagation()}
             onTouchEnd={e => e.stopPropagation()}>
          <button className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
            onClick={e => { e.stopPropagation(); onPropertySelect(property); if (variant === 'modal') onClose(); setPropertyMenuId(null); }}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onPropertySelect(property); if (variant === 'modal') onClose(); setPropertyMenuId(null); }}>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Property
          </button>
          <button className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
            onClick={e => { e.stopPropagation(); setRenamingPropertyId(property.id); setRenamingPropertyName(property.label || ''); setPropertyMenuId(null); }}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setRenamingPropertyId(property.id); setRenamingPropertyName(property.label || ''); setPropertyMenuId(null); }}>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          <button className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={e => {
              e.stopPropagation();
              navigator.clipboard.writeText(property.address).then(() => { setCopiedPropertyId(property.id); setTimeout(() => setCopiedPropertyId(null), 2000); showToast('Address copied'); });
              setPropertyMenuId(null);
            }}
            onTouchEnd={e => {
              e.stopPropagation(); e.preventDefault();
              navigator.clipboard.writeText(property.address).then(() => { setCopiedPropertyId(property.id); setTimeout(() => setCopiedPropertyId(null), 2000); showToast('Address copied'); });
              setPropertyMenuId(null);
            }}>
            {copiedPropertyId === property.id ? (
              <><svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-green-600">Copied!</span></>
            ) : (
              <><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m2 4h2a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2v-2" /></svg>Copy Address</>
            )}
          </button>
        </div>
      )}
      {renamingPropertyId === property.id && <RenameDialog property={property} />}
    </div>
  );

  // ── Empty / loading states ────────────────────────────────────────────────────
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">No properties yet</h3>
      <p className="text-sm text-gray-400 max-w-xs">Head to the map and drop a pin to start managing your properties.</p>
      {variant === 'modal' && (
        <button onClick={onClose} className="mt-5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">Go to Map</button>
      )}
    </div>
  );

  // ── PAGE VARIANT ──────────────────────────────────────────────────────────────
  if (variant === 'page') {
    return (
      <div className="w-full px-4 sm:px-8 pb-6 sm:pb-24">
        {/* Header */}
        <div className="pt-5 sm:pt-8 pb-4 sm:pb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Properties</h1>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery
              ? `${sortedProperties.length} of ${properties.length} properties`
              : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4 sm:mb-6 sm:max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search properties…"
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
          <EmptyState />
        ) : sortedProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MagnifyingGlassIcon className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No properties match <span className="font-medium text-gray-700">&ldquo;{searchQuery}&rdquo;</span></p>
          </div>
        ) : (
          <>
            {/* ── Desktop: card grid ── */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedProperties.map(property => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                const imgSrc = `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${property.lat},${property.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
                const fallbackSrc = `https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=17&size=640x400&maptype=roadmap&markers=color:blue%7C${property.lat},${property.lng}&key=${GOOGLE_MAPS_API_KEY}`;
                return (
                  <div
                    key={property.id}
                    onClick={() => { if (renamingPropertyId === property.id) return; onPropertySelect(property); }}
                    className={`group bg-white rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                      renamingPropertyId === property.id
                        ? 'border-blue-200 shadow-md cursor-default'
                        : 'border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative h-44 bg-gray-100 overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt=""
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                        onError={e => {
                          const t = e.currentTarget as HTMLImageElement;
                          if (t.dataset.fallback !== '1') { t.dataset.fallback = '1'; t.src = fallbackSrc; }
                        }}
                      />
                      {/* File count badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-lg">
                        {property.file_count} {property.file_count === 1 ? 'file' : 'files'}
                      </div>
                      {/* Action menu — top right */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <ActionMenu
                          property={property}
                          btnClassName="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm transition-all"
                        />
                      </div>
                    </div>
                    {/* Card body */}
                    <div className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                        {property.label || streetAddress || property.address}
                      </div>
                      {property.label && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{streetAddress}</div>
                      )}
                      {locationInfo && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{locationInfo}</div>
                      )}
                      {property.last_accessed && (
                        <div className="text-xs text-gray-300 mt-2">
                          {new Date(property.last_accessed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Mobile: property cards ── */}
            <div className="sm:hidden space-y-3">
              {sortedProperties.map(property => {
                const { streetAddress, locationInfo } = parseAddress(property.address);
                const imgSrc = `https://maps.googleapis.com/maps/api/streetview?size=600x280&location=${property.lat},${property.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
                const fallbackSrc = `https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=17&size=600x280&maptype=roadmap&markers=color:blue%7C${property.lat},${property.lng}&key=${GOOGLE_MAPS_API_KEY}`;
                return (
                  <div
                    key={property.id}
                    onClick={() => { if (renamingPropertyId === property.id) return; onPropertySelect(property); }}
                    className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-150 ${
                      renamingPropertyId === property.id
                        ? 'cursor-default opacity-80'
                        : 'cursor-pointer active:scale-[0.985] active:shadow-none'
                    }`}
                  >
                    {/* Banner image */}
                    <div className="relative h-36 bg-gray-100 overflow-hidden">
                      <Image src={imgSrc} alt="" fill className="object-cover" unoptimized
                        onError={e => { const t = e.currentTarget as HTMLImageElement; if (t.dataset.fallback !== '1') { t.dataset.fallback = '1'; t.src = fallbackSrc; } }} />
                      {/* File count badge */}
                      <div className="absolute bottom-2.5 left-3 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                        {property.file_count} {property.file_count === 1 ? 'file' : 'files'}
                      </div>
                      {/* Action menu */}
                      <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                        <ActionMenu
                          property={property}
                          btnClassName="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white shadow-sm transition-all"
                        />
                      </div>
                    </div>
                    {/* Card text */}
                    <div className="px-4 py-3">
                      <div className="text-[15px] font-semibold text-gray-900 truncate">
                        {property.label || streetAddress || property.address}
                      </div>
                      {property.label && (
                        <div className="text-sm text-gray-400 truncate mt-0.5">{streetAddress}</div>
                      )}
                      {locationInfo && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{locationInfo}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── MODAL VARIANT ─────────────────────────────────────────────────────────────
  const modalContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Properties</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {searchQuery ? `${sortedProperties.length} of ${properties.length}` : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
          </p>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={onClose} title="Close">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search properties…"
            className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
          )}
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : error ? (
          <div className="flex items-center justify-center py-16"><p className="text-sm text-gray-500">{error}</p></div>
        ) : properties.length === 0 ? (
          <EmptyState />
        ) : sortedProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MagnifyingGlassIcon className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No results for <span className="font-medium text-gray-700">&ldquo;{searchQuery}&rdquo;</span></p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedProperties.map(property => {
              const { streetAddress, locationInfo } = parseAddress(property.address);
              const imgSrc = `https://maps.googleapis.com/maps/api/streetview?size=160x160&location=${property.lat},${property.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
              const fallbackSrc = `https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=17&size=160x160&maptype=roadmap&markers=color:blue%7C${property.lat},${property.lng}&key=${GOOGLE_MAPS_API_KEY}`;
              return (
                <div key={property.id}
                  onClick={() => { if (renamingPropertyId === property.id) return; onPropertySelect(property); onClose(); }}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border border-transparent transition-all duration-150 group ${
                    renamingPropertyId === property.id ? 'cursor-default bg-blue-50/60 border-blue-100' : 'cursor-pointer hover:bg-gray-50 hover:border-gray-200 active:scale-[0.995]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <Image src={imgSrc} alt="" width={160} height={160} className="w-full h-full object-cover" unoptimized
                      onError={e => { const t = e.currentTarget as HTMLImageElement; if (t.dataset.fallback !== '1') { t.dataset.fallback = '1'; t.src = fallbackSrc; } }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{property.label || streetAddress || property.address}</div>
                    {property.label && <div className="text-xs text-gray-400 truncate mt-0.5">{streetAddress}</div>}
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                      {locationInfo && <><span className="truncate max-w-[140px]">{locationInfo}</span><span>·</span></>}
                      <span className="shrink-0">{property.file_count} {property.file_count === 1 ? 'file' : 'files'}</span>
                    </div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <ActionMenu property={property} btnClassName="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`fixed inset-0 z-40 flex ${mobileClasses.modal} justify-center bg-black/40 backdrop-blur-sm animate-fade-in`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-modal="true" role="dialog">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-xl flex flex-col overflow-hidden m-3 sm:m-0 max-h-[calc(100dvh-96px)] sm:max-h-none"
        style={{ ...getModalDimensions() }}>
        {modalContent}
      </div>
    </div>
  );
};
