import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface MobileBottomNavProps {
  onList?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onList }) => {
  const router = useRouter();

  useEffect(() => {
    try {
      router.prefetch('/map');
      router.prefetch('/account');
      router.prefetch('/list');
    } catch {}
  }, [router]);

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200" style={{
      paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
      paddingTop: '0.5rem'
    }}>
      <div className="max-w-5xl mx-auto grid grid-cols-3">
        <Link
          href="/map"
          prefetch
          className="py-2 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
          aria-label="Map"
          onClick={(e) => {
            if (router && router.pathname === '/map') {
              // Already on map: toggle the map view instead of focusing current location
              e.preventDefault();
              window.dispatchEvent(new Event('droppoint-toggle-map-type'));
            } else {
              // Navigating to map from another tab: optionally focus current location
              try { sessionStorage.setItem('droppoint-focus-current', '1'); } catch {}
            }
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18"></polygon>
            <line x1="9" y1="1" x2="9" y2="21"></line>
            <line x1="15" y1="6" x2="15" y2="16"></line>
          </svg>
          <span className="text-xs">Map</span>
        </Link>
        {onList ? (
          <button
            className="py-2 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
            onClick={() => onList()}
            aria-label="List"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <span className="text-xs">List</span>
          </button>
        ) : (
          <Link href="/list" prefetch className="py-2 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50" aria-label="List">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <span className="text-xs">List</span>
          </Link>
        )}
        <Link href="/account" prefetch className="py-2 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50" aria-label="Account">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M4 21v-2a4 4 0 0 1 3-3.87"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span className="text-xs">Account</span>
        </Link>
      </div>
    </div>
  );
};


