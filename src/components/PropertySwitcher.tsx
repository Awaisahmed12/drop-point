import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useUserProperties } from '../hooks/useUserProperties';
import type { PropertyWithFileCount } from '../../types';

interface PropertySwitcherProps {
  currentProperty: PropertyWithFileCount | null;
  onPropertySelect: (property: PropertyWithFileCount) => void | Promise<void>;
  open: boolean;
  onClose: () => void;
}

const parseAddress = (fullAddress: string) => {
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return { street: fullAddress.trim(), rest: '' };
  return { street: parts[0], rest: parts.slice(1).join(', ') };
};

/**
 * Picker for jumping to another property from inside the sheet. Presented as
 * a sheet of its own: a search field and one row per property, with a
 * checkmark on the one that's open.
 */
export const PropertySwitcher = ({ currentProperty, onPropertySelect, open, onClose }: PropertySwitcherProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { properties, loading } = useUserProperties();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !currentProperty) return null;

  const query = searchQuery.toLowerCase().trim();
  const visible = properties
    .filter(p => !query || p.address.toLowerCase().includes(query) || (p.label?.toLowerCase() ?? '').includes(query))
    .sort((a, b) => {
      const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
      const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
      return bDate.getTime() - aDate.getTime();
    });

  const choose = async (property: PropertyWithFileCount) => {
    onClose();
    setSearchQuery('');
    await onPropertySelect(property);
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Switch property"
      onClick={() => { onClose(); setSearchQuery(''); }}
    >
      <div
        className="ios-sheet sm:rounded-[16px] w-full sm:max-w-md flex flex-col overflow-hidden animate-sheet-up"
        style={{ maxHeight: 'min(80dvh, 640px)', height: '80dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="ios-grabber sm:hidden" />
        <div className="ios-navbar">
          <span />
          <h2 className="text-headline font-semibold text-center">Switch property</h2>
          <button type="button" className="ios-button-plain text-body font-semibold justify-self-end" onClick={() => { onClose(); setSearchQuery(''); }}>
            Done
          </button>
        </div>
        <div className="relative px-4 pb-3">
          <MagnifyingGlassIcon className="absolute left-6.5 top-1/2 -translate-y-1/2 -mt-1.5 w-4.5 h-4.5 text-ink-2 pointer-events-none" strokeWidth={2.5} />
          <input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="ios-search"
            autoComplete="off"
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-ground px-4 pb-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
          {loading ? (
            <p className="text-subhead text-ink-2 text-center py-10">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-subhead text-ink-2 text-center py-10">{searchQuery ? 'No matches' : 'No other properties yet'}</p>
          ) : (
            <div className="ios-group">
              {visible.map(property => {
                const { street, rest } = parseAddress(property.address);
                const isCurrent = property.id === currentProperty.id;
                return (
                  <button
                    key={property.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => choose(property)}
                    className="ios-row ios-row-press disabled:opacity-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-body truncate">{property.label || street || property.address}</div>
                      <div className="text-footnote text-ink-2 truncate">
                        {[property.label ? street : null, rest].filter(Boolean).join(', ')}
                        {property.file_count > 0 && ` · ${property.file_count} ${property.file_count === 1 ? 'file' : 'files'}`}
                      </div>
                    </div>
                    {isCurrent && (
                      <svg className="w-5 h-5 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Current">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
