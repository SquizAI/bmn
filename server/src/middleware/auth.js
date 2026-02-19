// server/src/middleware/auth.js

import { supabaseAdmin, createUserClient } from '../lib/supabase.js';
import { AuthError } from '../utils/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Extract and validate the bearer token from the Authorization header.
 * Returns null if no valid token is present.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();

  // Guard against stringified nullish values
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }

  return token;
}

/**
 * Authenticate the user and attach user, profile, token, and RLS-scoped
 * Supabase client to the request object.
 *
 * @param {string} token
 * @param {import('express').Request} req
 */
async function authenticateRequest(token, req) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    logger.warn({
      msg: 'JWT verification failed',
      requestId: req.id,
      error: error.message,
      ip: req.ip,
    });
    throw new AuthError('Invalid or expired token');
  }

  if (!user) {
    throw new AuthError('User not found for token');
  }

  // Fetch profile from the profiles table
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, subscription_tier, onboarding_done')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    logger.warn({
      msg: 'Profile not found for authenticated user',
      requestId: req.id,
      userId: user.id,
    });
    throw new AuthError('User profile not found');
  }

  req.user = user;
  req.profile = profile;
  req.token = token;
  req.supabase = createUserClient(token);
}

/**
 * Authentication middleware (required).
 *
 * Validates the Supabase JWT from the Authorization header, fetches the
 * user profile, and attaches req.user, req.profile, req.token, and
 * req.supabase (RLS-scoped client) for downstream handlers.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  try {
    await authenticateRequest(token, req);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
      });
    }
    logger.error({
      msg: 'Auth middleware unexpected error',
      requestId: req.id,
      error: err.message,
    });
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Admin-only middleware.
 * Must be used AFTER requireAuth (depends on req.profile).
 * Allows role: 'admin' or 'super_admin'.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAdmin(req, res, next) {
  if (!req.profile) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { role } = req.profile;

  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
}

/**
 * Super-admin-only middleware.
 * Must be used AFTER requireAuth (depends on req.profile).
 * Only allows role: 'super_admin'.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireSuperAdmin(req, res, next) {
  if (!req.profile) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  if (req.profile.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
    });
  }

  next();
}

/**
 * Optional authentication middleware.
 *
 * Attempts to authenticate but never blocks the request.
 * If a valid token is present, attaches the full auth context.
 * If no token or an invalid token is present, sets all auth
 * properties to null and continues.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    req.profile = null;
    req.token = null;
    req.supabase = null;
    return next();
  }

  try {
    await authenticateRequest(token, req);
  } catch {
    req.user = null;
    req.profile = null;
    req.token = null;
    req.supabase = null;
  }

  next();
}
