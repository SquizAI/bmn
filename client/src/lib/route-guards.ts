import { redirect } from 'react-router';
import { supabase } from '@/lib/supabase';

/**
 * Loader guard: redirects to /login if not authenticated.
 * Attach to any route that requires a logged-in user.
 */
export async function requireAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw redirect('/login');
  }
  return { session };
}

/**
 * Loader guard: redirects to /login if not authenticated,
 * redirects to /dashboard if not admin or super_admin.
 */
export async function requireAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    throw redirect('/dashboard');
  }

  return { session, profile };
}

type OrgRoleLevel = 'member' | 'manager' | 'admin' | 'owner';

const ORG_ROLE_ORDER: OrgRoleLevel[] = ['member', 'manager', 'admin', 'owner'];

/**
 * Loader guard factory: requires a minimum org role.
 * Redirects to /dashboard if the user's org role is insufficient.
 */
export function requireOrgRole(minRole: OrgRoleLevel) {
  return async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect('/login');
    }

    const userId = session.user.id;

    // Fetch profile and org membership
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw redirect('/login');
    }

    // Platform admins bypass org role checks
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      return { session, profile };
    }

    if (!profile.org_id) {
      throw redirect('/dashboard');
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', profile.org_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      throw redirect('/dashboard');
    }

    const minIdx = ORG_ROLE_ORDER.indexOf(minRole);
    const userIdx = ORG_ROLE_ORDER.indexOf(membership.role as OrgRoleLevel);

    if (userIdx < minIdx) {
      throw redirect('/dashboard');
    }

    return { session, profile, orgRole: membership.role };
  };
}

/**
 * Loader guard: redirects to /dashboard if already logged in.
 * Attach to auth pages (login, signup).
 */
export async function redirectIfAuthed() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    throw redirect('/dashboard');
  }
  return null;
}
