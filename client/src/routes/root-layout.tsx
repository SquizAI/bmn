import { Outlet, useNavigation } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { supabase } from '@/lib/supabase';
import { initTheme } from '@/lib/theme';

/**
 * Root layout wrapping all routes.
 * - Listens for auth state changes and syncs to Zustand.
 * - Fetches user profile to populate isAdmin and org context.
 * - Initializes the Socket.io connection when authenticated.
 * - Shows a loading bar during route transitions.
 */
export default function RootLayout() {
  const navigation = useNavigation();
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin);
  const setOrgId = useAuthStore((s) => s.setOrgId);
  const setOrgRole = useAuthStore((s) => s.setOrgRole);
  const setProfile = useAuthStore((s) => s.setProfile);
  const clear = useAuthStore((s) => s.clear);

  // Initialize theme (dark mode default)
  useEffect(() => {
    return initTheme();
  }, []);

  // Connect socket when authenticated
  useSocket();

  // Listen for auth state changes
  useEffect(() => {
    async function syncProfile(userId: string) {
      // Fetch profile to get role and org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id, subscription_tier, onboarding_done')
        .eq('id', userId)
        .single();

      if (profile) {
        setIsAdmin(profile.role === 'admin' || profile.role === 'super_admin');
        setOrgId(profile.org_id);
        setProfile(profile);

        // Fetch org membership role
        if (profile.org_id) {
          const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('org_id', profile.org_id)
            .eq('user_id', userId)
            .single();

          setOrgRole((membership?.role as 'owner' | 'admin' | 'manager' | 'member') ?? null);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        syncProfile(session.user.id);
      } else {
        clear();
      }

      setLoading(false);
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        syncProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setLoading, setIsAdmin, setOrgId, setOrgRole, setProfile, clear]);

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
