// server/src/routes/webhooks.js

import { Router } from 'express';
import express from 'express';
import * as webhookController from '../controllers/webhooks.js';

export const webhookRoutes = Router();

// Stripe webhooks require raw body for signature verification.
// This route uses express.raw() instead of express.json().
webhookRoutes.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

// GoHighLevel webhook (CRM events)
webhookRoutes.post('/ghl', webhookController.handleGHLWebhook);
