// server/src/middleware/api-key-auth.js

import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { AuthError } from '../utils/errors.js';

/**
 * Expected API key prefix.
 */
const KEY_PREFIX = 'bmn_live_';

/**
 * Hash a plain API key with SHA-256.
 *
 * @param {string} plainKey - The raw API key string
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashApiKey(plainKey) {
  return crypto.createHash('sha256').update(plainKey, 'utf8').digest('hex');
}

/**
 * API key authentication middleware.
 *
 * Validates the API key from the Authorization header:
 *   Authorization: Bearer bmn_live_XXXXX
 *
 * - Hashes the provided key with SHA-256
 * - Looks up the hash in the api_keys table
 * - Verifies the key is not revoked
 * - Sets req.user (with id) and req.apiKeyScopes
 * - Updates last_used_at timestamp asynchronously
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer bmn_live_XXXXX',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token || !token.startsWith(KEY_PREFIX)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format. Keys must start with bmn_live_',
    });
  }

  try {
    const keyHash = hashApiKey(token);

    const { data: apiKey, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, scopes, revoked_at')
      .eq('key_hash', keyHash)
      .single();

    if (error || !apiKey) {
      logger.warn({ ip: req.ip }, 'API key authentication failed: key not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    if (apiKey.revoked_at) {
      logger.warn({ apiKeyId: apiKey.id, ip: req.ip }, 'Revoked API key used');
      return res.status(401).json({
        success: false,
        error: 'This API key has been revoked',
      });
    }

    // Fetch user profile for downstream use
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, subscription_tier')
      .eq('id', apiKey.user_id)
      .single();

    // Attach user context to request
    req.user = { id: apiKey.user_id };
    req.profile = profile || { id: apiKey.user_id };
    req.apiKeyId = apiKey.id;
    req.apiKeyScopes = apiKey.scopes || [];

    // Update last_used_at asynchronously (fire and forget)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id)
      .then(() => {})
      .catch((err) => {
        logger.warn({ err, apiKeyId: apiKey.id }, 'Failed to update API key last_used_at');
      });

    next();
  } catch (err) {
    logger.error({ err, ip: req.ip }, 'API key auth middleware error');
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Create a middleware that checks if the API key has the required scope.
 *
 * Usage:
 *   router.get('/brands', requireScope('brands:read'), handler);
 *
 * @param {string} scope - The required scope (e.g., 'brands:read')
 * @returns {import('express').RequestHandler}
 */
export function requireScope(scope) {
  return (req, res, next) => {
    const scopes = req.apiKeyScopes || [];

    if (!scopes.includes(scope)) {
      logger.warn(
        { apiKeyId: req.apiKeyId, requiredScope: scope, availableScopes: scopes },
        'API key scope insufficient',
      );
      return res.status(403).json({
        success: false,
        error: `Insufficient scope. This endpoint requires the '${scope}' scope.`,
      });
    }

    next();
  };
}
