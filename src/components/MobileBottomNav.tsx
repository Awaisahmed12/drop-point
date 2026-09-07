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
 * iOS tab bar: 49pt, translucent, three destinations. The active tab uses the
 * filled glyph; the others are outlined. Sits above the home indicator.
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
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 ios-tabbar"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-3 h-[49px]">
        {TABS.map(({ href, label, Outline, Solid }) => {
          const active = router.pathname === href;
          const Icon = active ? Solid : Outline;
          const className = `flex flex-col items-center justify-center gap-[3px] ios-press ${active ? 'text-accent' : 'text-ink-2'}`;
          const content = (
            <>
              <Icon className="w-[26px] h-[26px]" aria-hidden="true" />
              <span className="text-[10px] font-medium leading-3">{label}</span>
            </>
          );

          if (href === '/list' && onList) {
            return (
              <button key={href} type="button" className={className} onClick={onList} aria-current={active ? 'page' : undefined}>
                {content}
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={className}
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
