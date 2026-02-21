import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | null;

interface ProfileData {
  role: string;
  org_id: string | null;
  subscription_tier: string;
  onboarding_done: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  orgId: string | null;
  orgRole: OrgRole;
  profile: ProfileData | null;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setOrgId: (orgId: string | null) => void;
  setOrgRole: (orgRole: OrgRole) => void;
  setProfile: (profile: ProfileData | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      session: null,
      isAdmin: false,
      isLoading: true,
      orgId: null,
      orgRole: null,
      profile: null,

      setUser: (user) => set({ user }, false, 'setUser'),
      setSession: (session) => set({ session }, false, 'setSession'),
      setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
      setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
      setOrgId: (orgId) => set({ orgId }, false, 'setOrgId'),
      setOrgRole: (orgRole) => set({ orgRole }, false, 'setOrgRole'),
      setProfile: (profile) => set({ profile }, false, 'setProfile'),

      clear: () =>
        set(
          {
            user: null,
            session: null,
            isAdmin: false,
            isLoading: false,
            orgId: null,
            orgRole: null,
            profile: null,
          },
          false,
          'clearAuth',
        ),
    }),
    { name: 'AuthStore' },
  ),
);
