// server/src/routes/api/v1/webhooks-user.js

import crypto from 'node:crypto';
import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
import { verifyWebhookUrl } from '../../../services/webhook-dispatcher.js';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
  deliveryListQuerySchema,
} from '../../../validation/webhooks-user.js';

export const userWebhookRoutes = Router();

/**
 * GET /api/v1/user-webhooks
 * List all webhook configurations for the authenticated user.
 */
userWebhookRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: webhooks, error } = await supabaseAdmin
      .from('webhook_configs')
      .select('id, url, events, active, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ err: error, userId }, 'Failed to list webhook configs');
      throw error;
    }

    res.json({
      success: true,
      data: { items: webhooks || [] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user-webhooks
 * Create a new webhook configuration.
 */
userWebhookRoutes.post(
  '/',
  validate({ body: createWebhookSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { url, events, secret } = req.body;

      // Auto-generate secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

      const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .insert({
          user_id: userId,
          url,
          events,
          secret: webhookSecret,
          active: true,
        })
        .select('id, url, events, active, created_at')
        .single();

      if (error) {
        logger.error({ err: error, userId }, 'Failed to create webhook config');
        throw error;
      }

      logger.info({ userId, webhookId: webhook.id, url }, 'Webhook config created');

      res.status(201).json({
        success: true,
        data: {
          ...webhook,
          secret: webhookSecret, // Return secret only on creation
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/user-webhooks/:id
 * Update an existing webhook configuration.
 */
userWebhookRoutes.patch(
  '/:id',
  validate({ params: webhookIdParamSchema, body: updateWebhookSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('webhook_configs')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({
          success: false,
          error: 'Webhook configuration not found',
        });
      }

      const updateFields = {};
      if (req.body.url !== undefined) updateFields.url = req.body.url;
      if (req.body.events !== undefined) updateFields.events = req.body.events;
      if (req.body.active !== undefined) updateFields.active = req.body.active;
      updateFields.updated_at = new Date().toISOString();

      const { data: updated, error } = await supabaseAdmin
        .from('webhook_configs')
        .update(updateFields)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, url, events, active, created_at, updated_at')
        .single();

      if (error) {
        logger.error({ err: error, userId, webhookId: id }, 'Failed to update webhook config');
        throw error;
      }

      logger.info({ userId, webhookId: id }, 'Webhook config updated');

      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/user-webhooks/:id
 * Delete a webhook configuration.
 */
userWebhookRoutes.delete(
  '/:id',
  validate({ params: webhookIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from('webhook_configs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        logger.error({ err: error, userId, webhookId: id }, 'Failed to delete webhook config');
        throw error;
      }

      logger.info({ userId, webhookId: id }, 'Webhook config deleted');

      res.json({
        success: true,
        data: { message: 'Webhook configuration deleted' },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/user-webhooks/:id/test
 * Send a test event to a webhook URL.
 */
userWebhookRoutes.post(
  '/:id/test',
  validate({ params: webhookIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Fetch the webhook config
      const { data: config, error: fetchError } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, url, secret')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !config) {
        return res.status(404).json({
          success: false,
          error: 'Webhook configuration not found',
        });
      }

      const result = await verifyWebhookUrl(config.url, config.secret);

      logger.info(
        { userId, webhookId: id, success: result.success, statusCode: result.statusCode },
        'Webhook test sent',
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/user-webhooks/:id/deliveries
 * List recent delivery attempts for a webhook configuration.
 */
userWebhookRoutes.get(
  '/:id/deliveries',
  validate({ params: webhookIdParamSchema, query: deliveryListQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { page, limit } = req.query;

      // Verify ownership
      const { data: config, error: fetchError } = await supabaseAdmin
        .from('webhook_configs')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !config) {
        return res.status(404).json({
          success: false,
          error: 'Webhook configuration not found',
        });
      }

      const offset = (page - 1) * limit;

      const { data: deliveries, error, count } = await supabaseAdmin
        .from('webhook_deliveries')
        .select('id, event, status_code, success, attempt, error_message, delivered_at', {
          count: 'exact',
        })
        .eq('webhook_config_id', id)
        .order('delivered_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error({ err: error, userId, webhookId: id }, 'Failed to list webhook deliveries');
        throw error;
      }

      res.json({
        success: true,
        data: {
          items: deliveries || [],
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
