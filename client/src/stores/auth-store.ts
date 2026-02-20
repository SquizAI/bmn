import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      session: null,
      isAdmin: false,
      isLoading: true,

      setUser: (user) => set({ user }, false, 'setUser'),
      setSession: (session) => set({ session }, false, 'setSession'),
      setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
      setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),

      clear: () =>
        set(
          { user: null, session: null, isAdmin: false, isLoading: false },
          false,
          'clearAuth',
        ),
    }),
    { name: 'AuthStore' },
  ),
);
