import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

interface MobileBottomNavProps {
  onList?: () => void;
  onLocate?: () => void;
  locateLabel?: string;
  onMap?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onList, onLocate, locateLabel = 'Current', onMap }) => {
  const router = useRouter();

  useEffect(() => {
    try {
      router.prefetch('/map');
      router.prefetch('/account');
      router.prefetch('/list');
    } catch {}
  }, [router]);

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200">
      <div className="max-w-5xl mx-auto grid grid-cols-4">
        <button
          className="py-3 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
          onClick={() => {
            if (onLocate) return onLocate();
            window.location.href = '/map?locate=1';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span className="text-xs">{locateLabel}</span>
        </button>
        <button
          className="py-3 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
          onClick={() => {
            if (onMap) { onMap(); return; }
            try { sessionStorage.setItem('droppoint-skip-geo', '1'); } catch {}
            router.push('/map');
          }}
          aria-label="Map"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 1 15 6 21 4 21 14 15 16 9 21 3 18"></polygon>
            <line x1="9" y1="1" x2="9" y2="21"></line>
            <line x1="15" y1="6" x2="15" y2="16"></line>
          </svg>
          <span className="text-xs">Map</span>
        </button>
        <button
          className="py-3 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
          onClick={() => { if (onList) return onList(); router.push('/list'); }}
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
        <button
          className="py-3 flex flex-col items-center justify-center text-gray-700 hover:bg-gray-50"
          onClick={() => { router.push('/account'); }}
          aria-label="Account"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M4 21v-2a4 4 0 0 1 3-3.87"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span className="text-xs">Account</span>
        </button>
      </div>
    </div>
  );
};


