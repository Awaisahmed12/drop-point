import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
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

const streetViewUrl = (p: PropertyWithFileCount) =>
  `https://maps.googleapis.com/maps/api/streetview?size=800x480&location=${p.lat},${p.lng}&fov=80&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
const staticMapUrl = (p: PropertyWithFileCount) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${p.lat},${p.lng}&zoom=17&size=800x480&maptype=satellite&markers=color:blue%7C${p.lat},${p.lng}&key=${GOOGLE_MAPS_API_KEY}`;

const swapToFallback = (e: React.SyntheticEvent<HTMLImageElement>, fallbackSrc: string) => {
  const t = e.currentTarget;
  if (t.dataset.fallback !== '1') {
    t.dataset.fallback = '1';
    t.src = fallbackSrc;
  }
};

const fileCountLabel = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

/**
 * The Properties screen: a large title, a floating glass search capsule, and
 * one photo card per property with its name set into the picture, the same
 * language as the property sheet's hero. Tapping a card opens it.
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
        <div className="glass rounded-[28px] px-6 py-10 text-center max-w-sm mx-auto mt-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent-soft flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
          </div>
          <h3 className="text-title-3 font-semibold">No properties yet</h3>
          <p className="text-subhead text-ink-2 mt-1 mb-5">Drop a pin on the map to add your first one.</p>
          <Link href="/map" className="ios-button ios-button-primary">Open the map</Link>
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
      <div className="pb-3 sm:pb-4">
        <h1 className="ios-large-title">Properties</h1>
        <p className="text-subhead text-ink-2 mt-0.5">
          {searchQuery
            ? `${sortedProperties.length} of ${properties.length}`
            : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
        </p>
      </div>

      {/* Floating glass search: stays put while cards scroll beneath it. */}
      <div className="sticky z-20 mb-4 sm:mb-6 sm:max-w-sm" style={{ top: 'calc(var(--safe-top) + 8px)' }}>
        <div className="relative glass rounded-full">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-2 pointer-events-none z-10" strokeWidth={2.5} />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search properties"
            className="w-full h-12 pl-11 pr-11 rounded-full bg-transparent text-body text-ink placeholder:text-ink-2 focus:outline-none"
            autoComplete="off"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ink-3 text-white flex items-center justify-center z-10">
              <XMarkIcon className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {stateView ?? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedProperties.map(property => {
            const { street, rest } = parseAddress(property.address);
            const title = property.label || street || property.address;
            const subtitle = [property.label ? street : null, rest].filter(Boolean).join(', ');
            return (
              <button
                type="button"
                key={property.id}
                onClick={() => onPropertySelect(property)}
                className="relative text-left h-48 sm:h-56 rounded-[24px] overflow-hidden bg-surface-2 ios-press shadow-[0_10px_30px_rgba(0,0,0,0.10)]"
              >
                <Image
                  src={streetViewUrl(property)}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                  onError={e => swapToFallback(e, staticMapUrl(property))}
                />
                <div className="hero-scrim absolute inset-x-0 bottom-0 h-[75%]" />
                <span className="glass-dark absolute top-3 left-3 rounded-full px-3 py-1 text-footnote font-semibold">
                  {fileCountLabel(property.file_count)}
                </span>
                <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
                  <div className="text-title-2 font-bold leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{title}</div>
                  {subtitle && <div className="text-subhead text-white/85 truncate mt-0.5">{subtitle}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
