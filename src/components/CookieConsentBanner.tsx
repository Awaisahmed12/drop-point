import React, { useEffect, useState } from 'react';

function getConsent(): { analytics: boolean } | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )droppoint-consent=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function setConsent(value: { analytics: boolean }) {
  if (typeof document === 'undefined') return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `droppoint-consent=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
}

/** A single card above the tab bar with two clearly named choices. */
export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read after mount: the cookie isn't available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read
    setVisible(!getConsent());
  }, []);

  if (!visible) return null;

  const decide = (analytics: boolean) => {
    setConsent({ analytics });
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 z-[1000] px-3 sm:px-4 pointer-events-none"
      style={{ bottom: 'calc(var(--tabbar-total) + 12px)' }}
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="mx-auto max-w-lg glass rounded-[26px] p-4 pointer-events-auto animate-sheet-up sm:mb-2">
        <p className="text-subhead text-ink">
          DropPoint uses essential cookies to keep you signed in. Allow analytics cookies too? See the{' '}
          <a className="text-accent" href="/legal/privacy" target="_blank" rel="noreferrer">privacy policy</a>.
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" className="ios-button ios-button-tinted h-11 text-subhead" onClick={() => decide(false)}>
            Essential only
          </button>
          <button type="button" className="ios-button ios-button-primary h-11 text-subhead" onClick={() => decide(true)}>
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
};

export function hasAnalyticsConsent(): boolean {
  const c = getConsent();
  return Boolean(c?.analytics);
}
