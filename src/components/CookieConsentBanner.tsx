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

export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read after mount: the cookie isn't available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read
    setVisible(!getConsent());
  }, []);

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-x-0 bottom-0 z-[1000] px-4 pb-4"
      style={{
        paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))`
      }}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/95 backdrop-blur shadow-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700 leading-relaxed">
            We use minimal cookies to provide essential functionality and optional analytics to improve the product. See our{' '}
            <a className="underline hover:text-gray-900" href="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>{' '}and{' '}
            <a className="underline hover:text-gray-900" href="/legal/terms" target="_blank" rel="noreferrer">Terms</a>.
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                setConsent({ analytics: false });
                setVisible(false);
              }}
            >
              Decline
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow cursor-pointer"
              onClick={() => {
                setConsent({ analytics: true });
                setVisible(false);
              }}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export function hasAnalyticsConsent(): boolean {
  const c = getConsent();
  return Boolean(c?.analytics);
}


