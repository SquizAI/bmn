// server/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

/**
 * Supabase admin client (service role key).
 *
 * This client bypasses Row Level Security (RLS).
 * Use ONLY for:
 * - Auth token verification (middleware)
 * - Admin operations (user management, data migration)
 * - Server-side operations where RLS is enforced in application code
 *
 * For user-scoped queries, use the scoped client (see below).
 */
export const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a Supabase client scoped to a specific user's JWT.
 * This client respects RLS policies.
 *
 * Usage:
 *   const supabase = createUserClient(req.headers.authorization.slice(7));
 *   const { data } = await supabase.from('brands').select('*'); // Only user's brands
 *
 * @param {string} accessToken - User's Supabase JWT
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserClient(accessToken) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
