// server/src/validation/webhooks-user.js

import { z } from 'zod';

/**
 * All supported webhook event types.
 */
export const WEBHOOK_EVENTS = /** @type {const} */ ([
  'brand.created',
  'brand.updated',
  'logo.generated',
  'mockup.generated',
  'order.created',
  'subscription.changed',
]);

/**
 * Schema for creating a new webhook configuration.
 */
export const createWebhookSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((val) => val.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS',
    }),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, 'Select at least one event'),
  secret: z
    .string()
    .min(16, 'Secret must be at least 16 characters')
    .max(256, 'Secret must be at most 256 characters')
    .optional(),
});

/**
 * Schema for updating an existing webhook configuration.
 */
export const updateWebhookSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((val) => val.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS',
    })
    .optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, 'Select at least one event')
    .optional(),
  active: z.boolean().optional(),
});

/**
 * Schema for the webhook ID URL parameter.
 */
export const webhookIdParamSchema = z.object({
  id: z.string().uuid('Invalid webhook ID'),
});

/**
 * Schema for delivery list query parameters.
 */
export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- API Key Schemas ----------

/**
 * All supported API key scopes.
 */
export const API_KEY_SCOPES = /** @type {const} */ ([
  'brands:read',
  'brands:write',
  'products:read',
  'mockups:generate',
  'analytics:read',
]);

/**
 * Schema for creating a new API key.
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, 'Select at least one scope'),
});

/**
 * Schema for the API key ID URL parameter.
 */
export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid('Invalid API key ID'),
});

// ---------- Public API Schemas ----------

/**
 * Schema for brand list query parameters.
 */
export const publicBrandListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

/**
 * Schema for creating a brand via the public API.
 */
export const publicCreateBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(200).trim(),
});

/**
 * Schema for brand ID URL parameter.
 */
export const publicBrandIdParamSchema = z.object({
  id: z.string().uuid('Invalid brand ID'),
});
