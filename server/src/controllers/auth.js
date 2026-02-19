// server/src/controllers/auth.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * POST /api/v1/auth/signup
 * Create a new account via Supabase Auth (server-side registration).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function signup(req, res) {
  const { email, password, full_name } = req.body;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error) {
    logger.warn({ msg: 'Signup failed', email, error: error.message });

    // Handle duplicate email
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  // Update profile with full_name if provided
  if (full_name && data.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name })
      .eq('id', data.user.id);

    if (profileError) {
      logger.warn({
        msg: 'Failed to update profile on signup',
        userId: data.user.id,
        error: profileError.message,
      });
    }
  }

  // TODO: Queue CRM sync job via BullMQ when queue is available
  // await dispatchJob('crm-sync', { type: 'contact.created', userId: data.user.id, email, full_name });
  logger.info({ msg: 'User created', userId: data.user.id, email });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name,
      },
    },
  });
}

/**
 * POST /api/v1/auth/login
 * Validate the existing token and return user profile.
 * Actual login happens client-side via Supabase SDK.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function login(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.warn({ msg: 'Profile fetch failed on login', userId: user.id, error: profileError.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }

  // Fetch credit summary if the RPC exists
  let credits = null;
  try {
    const { data: creditData } = await supabaseAdmin.rpc('get_credit_summary', {
      p_user_id: user.id,
    });
    credits = creditData;
  } catch {
    // RPC may not exist yet -- not critical
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      credits,
    },
  });
}

/**
 * POST /api/v1/auth/refresh
 * Refresh the access token using a refresh token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function refresh(req, res) {
  const { refresh_token } = req.body;

  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token,
  });

  if (error) {
    logger.warn({ msg: 'Token refresh failed', error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }

  res.json({
    success: true,
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
}

/**
 * POST /api/v1/auth/logout
 * Invalidate the current session.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function logout(req, res) {
  const userId = req.user?.id;

  if (userId) {
    const { error } = await supabaseAdmin.auth.admin.signOut(userId);
    if (error) {
      logger.warn({ msg: 'Logout failed', userId, error: error.message });
    }
  }

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
}

/**
 * GET /api/v1/auth/callback
 * OAuth callback handler (Google, Apple).
 * Exchanges the authorization code for a session, then redirects to the SPA.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function oauthCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${config.APP_URL}/auth/error?message=Missing+authorization+code`);
  }

  const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(String(code));

  if (error) {
    logger.warn({ msg: 'OAuth callback failed', error: error.message });
    return res.redirect(`${config.APP_URL}/auth/error?message=Authentication+failed`);
  }

  const params = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  res.redirect(`${config.APP_URL}/auth/callback?${params.toString()}`);
}

/**
 * POST /api/v1/auth/onboarding
 * Complete user onboarding -- update profile, grant initial credits.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function completeOnboarding(req, res) {
  const { phone, full_name, accepted_terms } = req.body;
  const userId = req.user.id;

  if (!accepted_terms) {
    return res.status(400).json({
      success: false,
      error: 'Terms must be accepted',
    });
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .update({
      phone,
      full_name,
      onboarding_done: true,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    logger.error({ msg: 'Onboarding update failed', userId, error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
    });
  }

  // Grant initial free-tier credits
  try {
    await supabaseAdmin.rpc('refill_credits', { p_tier: 'free' });
  } catch (err) {
    // RPC may not exist yet -- log and continue
    logger.warn({ msg: 'refill_credits RPC not available', userId, error: err.message });
  }

  // TODO: Queue CRM sync job via BullMQ when queue is available
  // await dispatchJob('crm-sync', { type: 'contact.updated', userId, phone, full_name });
  logger.info({ msg: 'Onboarding completed', userId });

  res.json({
    success: true,
    data: { profile },
  });
}

/**
 * GET /api/v1/auth/me
 * Return the authenticated user's profile and credit summary.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getProfile(req, res) {
  const userId = req.user.id;

  // Fetch full profile
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }

  // Fetch credit summary if available
  let credits = null;
  try {
    const { data: creditData } = await supabaseAdmin.rpc('get_credit_summary', {
      p_user_id: userId,
    });
    credits = creditData;
  } catch {
    // RPC may not exist yet
  }

  res.json({
    success: true,
    data: {
      profile,
      credits,
    },
  });
}

/**
 * PUT /api/v1/auth/me
 * Update the authenticated user's profile fields.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function updateProfile(req, res) {
  const userId = req.user.id;
  const { full_name, phone, avatar_url } = req.body;

  // Build update object with only provided fields
  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    logger.error({ msg: 'Profile update failed', userId, error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }

  res.json({
    success: true,
    data: { profile },
  });
}

/**
 * POST /api/v1/auth/password-reset
 * Send a password reset email.
 * Always returns 200 to prevent email enumeration.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function passwordReset(req, res) {
  const { email } = req.body;

  // Fire and don't leak whether the email exists
  try {
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${config.APP_URL}/auth/reset-password`,
    });
  } catch (err) {
    logger.warn({ msg: 'Password reset request failed', error: err.message });
  }

  // Always return 200 to prevent email enumeration
  res.json({
    success: true,
    data: { message: 'If an account exists with this email, a reset link has been sent' },
  });
}
