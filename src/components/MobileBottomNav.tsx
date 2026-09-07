import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MapIcon as MapOutline, ListBulletIcon as ListOutline, UserCircleIcon as UserOutline } from '@heroicons/react/24/outline';
import { MapIcon as MapSolid, ListBulletIcon as ListSolid, UserCircleIcon as UserSolid } from '@heroicons/react/24/solid';

interface MobileBottomNavProps {
  onList?: () => void;
  /** Fired when the user taps the Map tab while already on the map. */
  onMapTabReclick?: () => void;
}

const TABS = [
  { href: '/map', label: 'Map', Outline: MapOutline, Solid: MapSolid },
  { href: '/list', label: 'Properties', Outline: ListOutline, Solid: ListSolid },
  { href: '/account', label: 'Account', Outline: UserOutline, Solid: UserSolid },
] as const;

/**
 * Floating glass tab bar: a capsule that hovers above the home indicator
 * with three destinations. The selected tab sits on a white pill.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onList, onMapTabReclick }) => {
  const router = useRouter();

  useEffect(() => {
    try {
      TABS.forEach(t => router.prefetch(t.href));
    } catch {}
  }, [router]);

  return (
    <nav
      className="sm:hidden fixed z-40 left-5 right-5"
      style={{ bottom: 'calc(var(--safe-bottom) + var(--tabbar-gap))' }}
      aria-label="Primary"
    >
      <div className="glass ios-tabbar grid grid-cols-3" style={{ height: 'var(--tabbar-height)' }}>
        {TABS.map(({ href, label, Outline, Solid }) => {
          const active = router.pathname === href;
          const Icon = active ? Solid : Outline;
          const content = (
            <>
              <Icon className="w-[24px] h-[24px]" aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-3">{label}</span>
            </>
          );

          if (href === '/list' && onList) {
            return (
              <button key={href} type="button" className="ios-tab ios-press" onClick={onList} aria-current={active ? 'page' : undefined}>
                {content}
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              prefetch
              className="ios-tab ios-press"
              aria-current={active ? 'page' : undefined}
              onClick={e => {
                if (href === '/map') {
                  if (router.pathname === '/map') {
                    e.preventDefault();
                    onMapTabReclick?.();
                  } else {
                    try { sessionStorage.setItem('droppoint-focus-current', '1'); } catch {}
                  }
                }
              }}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
