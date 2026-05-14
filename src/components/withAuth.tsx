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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authenticated = !!session;

          if (requireAuth && !authenticated) {
            // User needs to be authenticated but isn't - redirect to login
            router.replace('/');
            return;
          } else if (!requireAuth && authenticated) {
            // User is authenticated but shouldn't be on this page (e.g., login page)
            router.replace('/map');
            return;
          }
        } catch (error) {
          logger.error('Auth check error:', error);
          if (requireAuth) {
            router.replace('/');
          }
        } finally {
          setIsLoading(false);
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
