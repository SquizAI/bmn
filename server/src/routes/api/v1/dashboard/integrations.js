// server/src/routes/api/v1/dashboard/integrations.js
// Stub route -- returns placeholder data until full implementation

import { Router } from 'express';

export const integrationsRoutes = Router();

integrationsRoutes.get('/', async (_req, res) => {
  res.json({
    success: true,
    data: {
      items: [
        {
          provider: 'shopify',
          connected: false,
          lastSync: null,
          productsSynced: 0,
          ordersSynced: 0,
          status: 'disconnected',
          errorMessage: null,
        },
        {
          provider: 'tiktok_shop',
          connected: false,
          lastSync: null,
          productsSynced: 0,
          ordersSynced: 0,
          status: 'disconnected',
          errorMessage: null,
        },
        {
          provider: 'woocommerce',
          connected: false,
          lastSync: null,
          productsSynced: 0,
          ordersSynced: 0,
          status: 'disconnected',
          errorMessage: null,
        },
      ],
    },
  });
});
