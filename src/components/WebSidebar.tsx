import React, { useState, useEffect } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);

  // Restore after mount so the server-rendered markup matches the first client render.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a persisted preference
      if (localStorage.getItem('droppoint-sidebar-collapsed') === '1') setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('droppoint-sidebar-collapsed', next ? '1' : '0'); } catch {}
  };

  const isActive = (path: string) => router.pathname === path;

  const filteredProperties = properties
    ? properties.filter(p =>
        !search.trim() ||
        p.address.toLowerCase().includes(search.toLowerCase()) ||
        (p.label ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div
      className={`hidden sm:flex flex-col shrink-0 bg-white border-r border-gray-200 h-full z-20 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Header row: logo + collapse toggle */}
      <div className={`flex items-center h-14 border-b border-gray-100 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <span className="text-base font-extrabold tracking-tight text-gray-900 select-none">DropPoint</span>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav className={`flex flex-col gap-0.5 py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {[
          {
            href: '/map',
            label: 'Map',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18" />
                <line x1="9" y1="1" x2="9" y2="21" />
                <line x1="15" y1="6" x2="15" y2="16" />
              </svg>
            ),
          },
          {
            href: '/list',
            label: 'List',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ),
          },
          {
            href: '/account',
            label: 'Account',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ),
          },
        ].map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer select-none ${
                collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
              } ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              <span className="shrink-0">{icon}</span>
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Property list — only when properties prop provided and sidebar is expanded */}
      {properties !== undefined && !collapsed && (
        <>
          <div className="mx-3 mt-1 mb-2 border-t border-gray-100" />
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Properties</div>
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
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
                const streetAddress = property.address.split(',')[0];
                const fileCount = (property as Property & { file_count?: number }).file_count;
                return (
                  <button
                    key={property.id}
                    onClick={() => onPropertySelect?.(property)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors duration-100 group ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="text-xs font-medium leading-snug truncate flex-1 min-w-0">
                        {property.label || streetAddress}
                      </div>
                      {fileCount !== undefined && fileCount > 0 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                        }`}>
                          {fileCount}
                        </span>
                      )}
                    </div>
                    {property.label && (
                      <div className={`text-xs truncate leading-snug mt-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                        {streetAddress}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Collapsed: property pin icon as hint that list exists */}
      {properties !== undefined && collapsed && properties.length > 0 && (
        <div className="flex flex-col items-center pt-2 gap-1">
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <div className="w-1 h-1 rounded-full bg-gray-300" />
        </div>
      )}
    </div>
  );
};
