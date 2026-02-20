// server/src/routes/integrations.js

import { Router } from 'express';
import { logger } from '../lib/logger.js';

export const integrationRoutes = Router();

/**
 * GET /api/v1/integrations/:provider/connect
 * Initiate OAuth connection for the given provider.
 * Currently returns a "coming soon" response for all providers.
 */
integrationRoutes.get('/:provider/connect', (req, res) => {
  const { provider } = req.params;
  const supportedProviders = ['shopify', 'tiktok-shop', 'woocommerce'];

  if (!supportedProviders.includes(provider)) {
    return res.status(400).json({
      success: false,
      error: `Unknown integration provider: ${provider}`,
    });
  }

  logger.info(
    { provider, userId: req.user?.id },
    'Integration connect requested (not yet implemented)',
  );

  // For now, redirect back to the integrations page with a message
  // In production this would initiate an OAuth flow
  res.status(501).json({
    success: false,
    error: `${provider} integration is coming soon. We're working on connecting your favorite platforms.`,
  });
});

/**
 * GET /api/v1/integrations
 * List all integrations and their status for the current user.
 */
integrationRoutes.get('/', (req, res) => {
  // Stub: return empty integrations
  res.json({
    success: true,
    data: {
      integrations: [],
    },
  });
});

/**
 * DELETE /api/v1/integrations/:provider
 * Disconnect an integration.
 */
integrationRoutes.delete('/:provider', (req, res) => {
  const { provider } = req.params;

  logger.info(
    { provider, userId: req.user?.id },
    'Integration disconnect requested (not yet implemented)',
  );

  res.status(501).json({
    success: false,
    error: `${provider} disconnect is not yet implemented.`,
  });
});
