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
 * redirects to /dashboard if not admin.
 */
export async function requireAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw redirect('/login');
  }

  // Check admin role from user metadata or profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw redirect('/dashboard');
  }

  return { session, profile };
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
