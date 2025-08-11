import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'working' | 'done'>('working');

  useEffect(() => {
    let isMounted = true;

    const finalize = async () => {
      try {
        // 1) Handle PKCE or OTP links that include a ?code= or other params
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch {
          // Ignore if not a PKCE/OTP flow
        }

        // 2) Detect hash-based tokens (implicit flow) and/or use existing session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (!isMounted) return;
          setStatus('done');
          router.replace('/map');
          return;
        }

        // Small fallback delay in case the library finishes parsing shortly after
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession();
          if (retry.session) {
            if (!isMounted) return;
            setStatus('done');
            router.replace('/map');
          } else {
            if (!isMounted) return;
            setStatus('done');
            router.replace('/');
          }
        }, 300);
      } catch {
        if (!isMounted) return;
        setStatus('done');
        router.replace('/');
      }
    };

    finalize();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1f2937' }}>
        {status === 'working' ? 'Finishing sign-in…' : 'Redirecting…'}
      </div>
    </div>
  );
} 