import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { Property } from '../../types';

interface WebSidebarProps {
  properties?: Property[];
  selectedPropertyId?: string | null;
  onPropertySelect?: (property: Property) => void;
}

export const WebSidebar: React.FC<WebSidebarProps> = ({
  properties,
  selectedPropertyId,
  onPropertySelect,
}) => {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const isActive = (path: string) => router.pathname === path;

  const navItemBase =
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer select-none';
  const navItemActive = 'bg-blue-50 text-blue-700';
  const navItemInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const filteredProperties = properties
    ? properties.filter(p =>
        !search.trim() ||
        p.address.toLowerCase().includes(search.toLowerCase()) ||
        (p.label ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="hidden sm:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 h-full z-20">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <span className="text-lg font-extrabold tracking-tight text-gray-900">DropPoint</span>
      </div>

      {/* Nav items */}
      <nav className="px-3 flex flex-col gap-1">
        <Link href="/map" className={`${navItemBase} ${isActive('/map') ? navItemActive : navItemInactive}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18" />
            <line x1="9" y1="1" x2="9" y2="21" />
            <line x1="15" y1="6" x2="15" y2="16" />
          </svg>
          Map
        </Link>
        <Link href="/list" className={`${navItemBase} ${isActive('/list') ? navItemActive : navItemInactive}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          List
        </Link>
        <Link href="/account" className={`${navItemBase} ${isActive('/account') ? navItemActive : navItemInactive}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Account
        </Link>
      </nav>

      {/* Property list (only when properties prop is provided — map page) */}
      {properties !== undefined && (
        <>
          <div className="mx-3 mt-4 mb-2 border-t border-gray-100" />
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Properties</div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredProperties.length === 0 ? (
              <div className="text-xs text-gray-400 text-center mt-4 px-2">
                {properties.length === 0 ? 'No properties yet' : 'No results'}
              </div>
            ) : (
              filteredProperties.map(property => {
                const isSelected = property.id === selectedPropertyId;
                return (
                  <button
                    key={property.id}
                    onClick={() => onPropertySelect?.(property)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors duration-100 ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs font-medium leading-snug truncate">
                      {property.label || property.address.split(',')[0]}
                    </div>
                    {property.label && (
                      <div className="text-xs text-gray-400 truncate leading-snug">
                        {property.address.split(',')[0]}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
