import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface MobileBottomNavProps {
  onList?: () => void;
  /** Fired when the user taps the Map tab while already on the Map page.
   *  The map page uses this to cycle through map types (roadmap / hybrid /
   *  satellite). Replaces a previous window.dispatchEvent indirection that
   *  coupled this component to map.tsx via a stringly-typed event name. */
  onMapTabReclick?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onList, onMapTabReclick }) => {
  const router = useRouter();

  useEffect(() => {
    try {
      router.prefetch('/map');
      router.prefetch('/account');
      router.prefetch('/list');
    } catch {}
  }, [router]);

  const isActive = (path: string) => router.pathname === path;

  const navItemClass = (path: string) =>
    `py-1.5 flex flex-col items-center justify-center gap-0.5 transition-all active:opacity-60 ${
      isActive(path) ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
    }`;

  const iconWrap = (path: string) =>
    `p-1.5 rounded-xl transition-colors ${isActive(path) ? 'bg-blue-50' : ''}`;

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200" style={{
      paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`,
      paddingTop: '0.25rem'
    }}>
      <div className="max-w-5xl mx-auto grid grid-cols-3">
        <Link
          href="/map"
          prefetch
          className={navItemClass('/map')}
          aria-label="Map"
          onClick={(e) => {
            if (router && router.pathname === '/map') {
              // Already on the map page — don't navigate, let the parent
              // handle the re-tap (cycle map type, etc.).
              e.preventDefault();
              onMapTabReclick?.();
            } else {
              try { sessionStorage.setItem('droppoint-focus-current', '1'); } catch {}
            }
          }}
        >
          <div className={iconWrap('/map')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/map') ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18"></polygon>
              <line x1="9" y1="1" x2="9" y2="21"></line>
              <line x1="15" y1="6" x2="15" y2="16"></line>
            </svg>
          </div>
          <span className={`text-[11px] font-medium ${isActive('/map') ? 'text-blue-600' : 'text-gray-400'}`}>Map</span>
        </Link>
        {onList ? (
          <button
            className={navItemClass('/list')}
            onClick={() => onList()}
            aria-label="List"
          >
            <div className={iconWrap('/list')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/list') ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </div>
            <span className={`text-[11px] font-medium ${isActive('/list') ? 'text-blue-600' : 'text-gray-400'}`}>List</span>
          </button>
        ) : (
          <Link href="/list" prefetch className={navItemClass('/list')} aria-label="List">
            <div className={iconWrap('/list')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/list') ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </div>
            <span className={`text-[11px] font-medium ${isActive('/list') ? 'text-blue-600' : 'text-gray-400'}`}>List</span>
          </Link>
        )}
        <Link href="/account" prefetch className={navItemClass('/account')} aria-label="Account">
          <div className={iconWrap('/account')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/account') ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M4 21v-2a4 4 0 0 1 3-3.87"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span className={`text-[11px] font-medium ${isActive('/account') ? 'text-blue-600' : 'text-gray-400'}`}>Account</span>
        </Link>
      </div>
    </div>
  );
};


