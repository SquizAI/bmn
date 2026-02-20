import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/spinner';
import { ROUTES } from '@/lib/constants';

/**
 * OAuth callback handler.
 * Supabase processes the URL hash and establishes the session.
 * Once complete, redirect to dashboard.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthCallback] Session error:', error.message);
          navigate(ROUTES.LOGIN);
          return;
        }
        navigate(ROUTES.DASHBOARD);
      } catch {
        navigate(ROUTES.LOGIN);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <LoadingSpinner />
      <p className="text-sm text-text-secondary">Completing sign in...</p>
    </div>
  );
}
