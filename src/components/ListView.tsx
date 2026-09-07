import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import type { PropertyWithFileCount } from '../../types';

interface ListViewProps {
  properties: PropertyWithFileCount[];
  loading: boolean;
  error: string | null;
  onPropertySelect: (property: PropertyWithFileCount) => void;
}

const parseAddress = (fullAddress: string) => {
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return { street: fullAddress.trim(), rest: '' };
  return { street: parts[0], rest: parts.slice(1).join(', ') };
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

const fileCountLabel = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

/**
 * The Properties screen: a large title, a search field, and one row per
 * property. Tapping a row opens it; everything else happens inside the sheet.
 */
export const ListView = ({ properties, loading, error, onPropertySelect }: ListViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = searchQuery.toLowerCase().trim();
  const sortedProperties = properties
    .filter(p => !query || p.address.toLowerCase().includes(query) || (p.label?.toLowerCase() ?? '').includes(query))
    .sort((a, b) => {
      const aDate = new Date(a.last_accessed || a.created_at || a.updated_at || '1970-01-01');
      const bDate = new Date(b.last_accessed || b.created_at || b.updated_at || '1970-01-01');
      return bDate.getTime() - aDate.getTime();
    });

  // Desktop lands in the search box; on a phone that would raise the keyboard.
  useEffect(() => {
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const renderState = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-[3px] border-surface-2 border-t-accent rounded-full animate-spin" />
        </div>
      );
    }
    if (error) {
      return <p className="text-subhead text-ink-2 text-center py-24">{error}</p>;
    }
    if (properties.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h3 className="text-headline font-semibold">No properties yet</h3>
          <p className="text-subhead text-ink-2 mt-1 max-w-xs">Drop a pin on the map to add your first one.</p>
        </div>
      );
    }
    if (sortedProperties.length === 0) {
      return <p className="text-subhead text-ink-2 text-center py-24">No properties match “{searchQuery}”.</p>;
    }
    return null;
  };

  const stateView = renderState();

  return (
    <div className="w-full px-4 sm:px-8 pb-tabbar" style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}>
      <div className="pb-3 sm:pb-5">
        <h1 className="ios-large-title">Properties</h1>
        <p className="text-subhead text-ink-2 mt-0.5">
          {searchQuery
            ? `${sortedProperties.length} of ${properties.length}`
            : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
        </p>
      </div>

      <div className="relative mb-4 sm:mb-6 sm:max-w-sm">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-2 pointer-events-none" strokeWidth={2.5} />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search properties"
          className="ios-search"
          autoComplete="off"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-ink-3 text-white flex items-center justify-center">
            <XMarkIcon className="w-3 h-3" strokeWidth={3} />
          </button>
        )}
      </div>

      {stateView ?? (
        <>
          {/* Desktop: card grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProperties.map(property => {
              const { street, rest } = parseAddress(property.address);
              return (
                <button
                  type="button"
                  key={property.id}
                  onClick={() => onPropertySelect(property)}
                  className="text-left bg-surface rounded-[14px] overflow-hidden ios-press"
                >
                  <div className="relative h-40 bg-surface-2">
                    <Image
                      src={streetViewUrl(property, '640x400')}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                      onError={e => swapToFallback(e, staticMapUrl(property, '640x400'))}
                    />
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-headline font-semibold truncate">{property.label || street || property.address}</div>
                    <div className="text-footnote text-ink-2 truncate mt-0.5">
                      {[property.label ? street : null, rest].filter(Boolean).join(', ')}
                    </div>
                    <div className="text-footnote text-ink-2 mt-1">{fileCountLabel(property.file_count)}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Phone: inset grouped rows */}
          <div className="sm:hidden ios-group">
            {sortedProperties.map(property => {
              const { street, rest } = parseAddress(property.address);
              return (
                <button
                  type="button"
                  key={property.id}
                  onClick={() => onPropertySelect(property)}
                  className="ios-row ios-row-press has-leading py-2.5"
                >
                  <div className="relative w-14 h-14 rounded-[10px] overflow-hidden bg-surface-2 flex-shrink-0">
                    <Image
                      src={streetViewUrl(property, '160x160')}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                      onError={e => swapToFallback(e, staticMapUrl(property, '160x160'))}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-medium truncate">{property.label || street || property.address}</div>
                    <div className="text-footnote text-ink-2 truncate mt-0.5">
                      {[property.label ? street : null, rest].filter(Boolean).join(', ') || ' '}
                    </div>
                    <div className="text-footnote text-ink-2">{fileCountLabel(property.file_count)}</div>
                  </div>
                  <ChevronRightIcon className="ios-chevron w-4 h-4" strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
