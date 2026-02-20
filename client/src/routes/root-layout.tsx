import { Outlet, useNavigation } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { supabase } from '@/lib/supabase';
import { initTheme } from '@/lib/theme';

/**
 * Root layout wrapping all routes.
 * - Listens for auth state changes and syncs to Zustand.
 * - Initializes the Socket.io connection when authenticated.
 * - Shows a loading bar during route transitions.
 */
export default function RootLayout() {
  const navigation = useNavigation();
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  // Initialize theme (dark mode default)
  useEffect(() => {
    return initTheme();
  }, []);

  // Connect socket when authenticated
  useSocket();

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setLoading]);

  const isNavigating = navigation.state === 'loading';

  return (
    <>
      {/* Top loading bar during route transitions */}
      {isNavigating && (
        <div className="fixed left-0 top-0 z-[var(--bmn-z-toast)] h-0.5 w-full">
          <div className="h-full animate-[progress-indeterminate_1.5s_ease-in-out_infinite] w-1/4 bg-primary" />
        </div>
      )}
      <div id="main-content">
        <Outlet />
      </div>
    </>
  );
}
