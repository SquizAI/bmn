import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { useBrandStore } from '@/stores/brand-store';
import { useChatStore } from '@/stores/chat-store';
import { useWizardStore } from '@/stores/wizard-store';
import { useOrgStore } from '@/stores/org-store';
import { ROUTES } from '@/lib/constants';

/**
 * Auth flow hooks wrapping Supabase Auth.
 */
export function useAuth() {
  const navigate = useNavigate();
  const { user, session, isAdmin, isLoading, clear } = useAuthStore();

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(ROUTES.DASHBOARD);
    },
    [navigate],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: fullName ? { data: { full_name: fullName } } : undefined,
      });
      if (error) throw error;
      // Supabase may send a confirmation email; the user lands on callback
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clear();
    useBrandStore.getState().clearActiveBrand();
    useChatStore.getState().clearMessages();
    useWizardStore.getState().reset();
    useOrgStore.getState().clear();
    navigate(ROUTES.LOGIN);
  }, [clear, navigate]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
    });
    if (error) throw error;
  }, []);

  return {
    user,
    session,
    isAdmin,
    isLoading,
    isAuthenticated: !!session,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
}
