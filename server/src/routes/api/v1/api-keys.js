// server/src/routes/api/v1/api-keys.js

import crypto from 'node:crypto';
import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
import {
  createApiKeySchema,
  apiKeyIdParamSchema,
} from '../../../validation/webhooks-user.js';

export const apiKeyRoutes = Router();

/**
 * API key prefix used for all generated keys.
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
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user.
 * Only returns metadata (never the full key).
 */
apiKeyRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: keys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, created_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ err: error, userId }, 'Failed to list API keys');
      throw error;
    }

    res.json({
      success: true,
      data: { items: keys || [] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/api-keys
 * Create a new API key. The full key is returned ONCE in the response.
 * Only the SHA-256 hash is stored in the database.
 */
apiKeyRoutes.post(
  '/',
  validate({ body: createApiKeySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { name, scopes } = req.body;

      // Check subscription tier (Agency tier required)
      if (req.profile?.subscription_tier !== 'agency') {
        return res.status(403).json({
          success: false,
          error: 'API key access requires an Agency tier subscription.',
        });
      }

      // Generate the API key: bmn_live_ + 32 random hex chars
      const randomPart = crypto.randomBytes(16).toString('hex');
      const plainKey = `${KEY_PREFIX}${randomPart}`;
      const keyHash = hashApiKey(plainKey);
      const keyPrefixDisplay = plainKey.slice(0, 12); // bmn_live_XXXX

      const { data: apiKey, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
          user_id: userId,
          name,
          key_prefix: keyPrefixDisplay,
          key_hash: keyHash,
          scopes,
        })
        .select('id, name, key_prefix, scopes, created_at')
        .single();

      if (error) {
        logger.error({ err: error, userId }, 'Failed to create API key');
        throw error;
      }

      logger.info({ userId, apiKeyId: apiKey.id, name }, 'API key created');

      // Return the full key ONCE -- it will never be shown again
      res.status(201).json({
        success: true,
        data: {
          ...apiKey,
          key: plainKey, // Only returned on creation
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/api-keys/:id
 * Revoke an API key (soft delete via revoked_at timestamp).
 */
apiKeyRoutes.delete(
  '/:id',
  validate({ params: apiKeyIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const { data: updated, error } = await supabaseAdmin
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .is('revoked_at', null)
        .select('id')
        .single();

      if (error || !updated) {
        return res.status(404).json({
          success: false,
          error: 'API key not found or already revoked',
        });
      }

      logger.info({ userId, apiKeyId: id }, 'API key revoked');

      res.json({
        success: true,
        data: { message: 'API key revoked successfully' },
      });
    } catch (err) {
      next(err);
    }
  },
);
