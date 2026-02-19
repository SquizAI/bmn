// server/src/controllers/webhooks.js

import { logger } from '../lib/logger.js';

/**
 * POST /api/v1/webhooks/stripe
 * Handle Stripe webhook events (subscription changes, payment events).
 * The raw body is required for signature verification.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleStripeWebhook(req, res) {
  // TODO: Implement -- verify Stripe signature, dispatch event to BullMQ
  logger.info({
    msg: 'Stripe webhook received',
    requestId: req.id,
  });

  res.json({ received: true });
}

/**
 * POST /api/v1/webhooks/ghl
 * Handle GoHighLevel CRM webhook events.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleGHLWebhook(req, res) {
  // TODO: Implement -- validate GHL webhook, dispatch to BullMQ
  logger.info({
    msg: 'GHL webhook received',
    requestId: req.id,
  });

  res.json({ received: true });
}
