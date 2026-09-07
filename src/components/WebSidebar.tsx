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
      className={`hidden sm:flex flex-col shrink-0 bg-surface border-r border-hairline/60 h-full z-20 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Header row: logo + collapse toggle */}
      <div className={`flex items-center h-14 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <span className="text-headline font-bold text-ink select-none">DropPoint</span>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-ink-2 ios-row-press"
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
            label: 'Properties',
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
              } ${active ? 'bg-accent-soft text-accent' : 'text-ink ios-row-press'}`}
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
          <div className="mx-3 mt-1 mb-2 border-t border-hairline/60" />
          <div className="px-3 mb-2">
            <div className="text-footnote text-ink-2 mb-2">Properties</div>
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none"
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
                placeholder="Search"
                className="ios-search !h-8 !pl-8 !text-subhead"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredProperties.length === 0 ? (
              <div className="text-footnote text-ink-2 text-center mt-4 px-2">
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
                    className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 group ${
                      isSelected ? 'bg-accent-soft text-accent' : 'text-ink ios-row-press'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="text-xs font-medium leading-snug truncate flex-1 min-w-0">
                        {property.label || streetAddress}
                      </div>
                      {fileCount !== undefined && fileCount > 0 && (
                        <span className={`text-caption-2 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-ink-2'
                        }`}>
                          {fileCount}
                        </span>
                      )}
                    </div>
                    {property.label && (
                      <div className={`text-caption truncate leading-snug mt-0.5 ${isSelected ? 'text-accent/80' : 'text-ink-2'}`}>
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
          <div className="w-1 h-1 rounded-full bg-ink-3" />
          <div className="w-1 h-1 rounded-full bg-ink-3" />
          <div className="w-1 h-1 rounded-full bg-ink-3" />
        </div>
      )}
    </div>
  );
};
