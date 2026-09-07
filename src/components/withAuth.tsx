import { logger } from '../utils/logger';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

interface WithAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requireAuth = true } = options;

  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    // Stay on the spinner until the session check says this page may render;
    // a page that is about to be redirected away must never mount (it would
    // kick off data fetches that fail with "not authenticated").
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authenticated = !!session;

          if (requireAuth && !authenticated) {
            router.replace('/');
            return;
          }
          if (!requireAuth && authenticated) {
            router.replace('/map');
            return;
          }
          setIsLoading(false);
        } catch (error) {
          logger.error('Auth check error:', error);
          if (requireAuth) {
            router.replace('/');
          } else {
            setIsLoading(false);
          }
        }
      };

      checkAuth();

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          const authenticated = !!session;

          if (requireAuth && !authenticated) {
            router.replace('/');
          } else if (!requireAuth && authenticated) {
            router.replace('/map');
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }, [router]);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ground">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-ink-2">Loading...</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
