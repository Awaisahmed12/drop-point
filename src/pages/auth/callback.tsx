import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase client with detectSessionInUrl=true will parse tokens automatically on first load
    // Ensure we land on a clean route and then push to app
    const timer = setTimeout(() => {
      router.replace('/map');
    }, 300);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1f2937' }}>
        Finishing sign-in…
      </div>
    </div>
  );
} 