// server/src/routes/index.js

import { authRoutes } from './auth.js';
import { brandRoutes } from './brands.js';
import { wizardRoutes } from './wizard.js';
import { productRoutes } from './products.js';
import { paymentRoutes } from './payments.js';
import { billingRoutes } from './billing.js';
import { adminRoutes } from './admin.js';
import { webhookRoutes } from './webhooks.js';
import { healthRoute } from './health.js';
import { dashboardRoutes } from './api/v1/dashboard/index.js';
import { analyticsRoutes } from './analytics.js';
import { integrationRoutes } from './integrations.js';
import { chatRoutes } from './chat.js';
import { userWebhookRoutes } from './api/v1/webhooks-user.js';
import { apiKeyRoutes } from './api/v1/api-keys.js';
import { publicApiRoutes } from './api/v1/public-api.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { apiKeyAuth } from '../middleware/api-key-auth.js';
import { authLimiter, webhookLimiter } from '../middleware/rate-limit.js';

/**
 * Register all API routes on the Express app.
 *
 * Route groups:
 * - /health           -- Public, no auth (K8s probes, uptime monitors)
 * - /api/v1/auth      -- Public with auth rate limit (login, signup, refresh)
 * - /api/v1/webhooks  -- Public with webhook rate limit (Stripe, GHL)
 * - /api/v1/brands    -- Authenticated (brand CRUD)
 * - /api/v1/wizard    -- Authenticated (wizard flow, AI generation)
 * - /api/v1/products  -- Authenticated (product catalog)
 * - /api/v1/billing   -- Authenticated (subscription management, credits) [canonical]
 * - /api/v1/payments  -- Authenticated (legacy alias for billing)
 * - /api/v1/chat      -- Authenticated (AI brand assistant chat)
 * - /api/v1/user-webhooks -- Authenticated (user webhook management)
 * - /api/v1/api-keys  -- Authenticated (API key management, Agency tier)
 * - /api/v1/public    -- API key auth (programmatic API access)
 * - /api/v1/admin     -- Authenticated + admin role
 *
 * @param {import('express').Express} app
 */
export function registerRoutes(app) {
  // -- Public routes (no auth) --
  app.use('/health', healthRoute);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/webhooks', webhookLimiter, webhookRoutes);

  // -- Authenticated routes --
  app.use('/api/v1/brands', requireAuth, brandRoutes);
  app.use('/api/v1/wizard', requireAuth, wizardRoutes);
  app.use('/api/v1/products', requireAuth, productRoutes);
  app.use('/api/v1/billing', requireAuth, billingRoutes);
  app.use('/api/v1/payments', requireAuth, paymentRoutes);

  // -- Chat routes (AI brand assistant) --
  app.use('/api/v1/chat', requireAuth, chatRoutes);

  // -- Dashboard routes --
  app.use('/api/v1/dashboard', requireAuth, dashboardRoutes);

  // -- Analytics routes --
  app.use('/api/v1/analytics', requireAuth, analyticsRoutes);

  // -- Integrations routes --
  app.use('/api/v1/integrations', requireAuth, integrationRoutes);

  // -- User webhook management (requires session auth) --
  app.use('/api/v1/user-webhooks', requireAuth, userWebhookRoutes);

  // -- API key management (requires session auth) --
  app.use('/api/v1/api-keys', requireAuth, apiKeyRoutes);

  // -- Public API (requires API key auth) --
  app.use('/api/v1/public', apiKeyAuth, publicApiRoutes);

  // -- Admin routes (auth + admin role) --
  app.use('/api/v1/admin', requireAuth, requireAdmin, adminRoutes);
}
