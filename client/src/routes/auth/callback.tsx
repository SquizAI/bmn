import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/spinner';
import { ROUTES } from '@/lib/constants';

/**
 * OAuth callback handler.
 * Supabase processes the URL hash and establishes the session.
 * Handles recovery (password reset) redirects and errors.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse hash params for type and error info
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const type = hashParams.get('type');
        const hashError = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Handle error in hash params
        if (hashError) {
          console.error('[AuthCallback] Hash error:', hashError, errorDescription);
          setErrorMessage(errorDescription || hashError);
          setTimeout(() => navigate(ROUTES.LOGIN), 3000);
          return;
        }

        // Handle recovery (password reset) flow
        if (type === 'recovery') {
          navigate(`${ROUTES.FORGOT_PASSWORD}?type=recovery`);
          return;
        }

        // Default: establish session and redirect to dashboard
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

  if (errorMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="rounded-md border border-error-border bg-error-bg px-6 py-4 text-center">
          <p className="text-sm font-medium text-error">Authentication error</p>
          <p className="mt-1 text-sm text-text-secondary">{errorMessage}</p>
        </div>
        <p className="text-xs text-text-secondary">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <LoadingSpinner />
      <p className="text-sm text-text-secondary">Completing sign in...</p>
    </div>
  );
}
