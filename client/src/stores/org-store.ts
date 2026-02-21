import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { OrgRole } from './auth-store';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  billing_email: string | null;
  stripe_customer_id: string | null;
  subscription_tier: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  role: OrgRole;
  joined_at: string;
  user_id: string;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
  };
}

interface OrgState {
  org: Organization | null;
  members: OrgMember[];
  isLoadingOrg: boolean;

  setOrg: (org: Organization | null) => void;
  setMembers: (members: OrgMember[]) => void;
  setLoadingOrg: (isLoading: boolean) => void;
  clear: () => void;
}

export const useOrgStore = create<OrgState>()(
  devtools(
    (set) => ({
      org: null,
      members: [],
      isLoadingOrg: false,

      setOrg: (org) => set({ org }, false, 'setOrg'),
      setMembers: (members) => set({ members }, false, 'setMembers'),
      setLoadingOrg: (isLoadingOrg) => set({ isLoadingOrg }, false, 'setLoadingOrg'),

      clear: () =>
        set(
          { org: null, members: [], isLoadingOrg: false },
          false,
          'clearOrg',
        ),
    }),
    { name: 'OrgStore' },
  ),
);
