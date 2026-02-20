// server/src/routes/payments.js
//
// Legacy route file -- kept for backward compatibility.
// The canonical billing routes are in ./billing.js at /api/v1/billing/*.
// These /api/v1/payments/* routes delegate to the same controllers.

import { Router } from 'express';
import * as paymentController from '../controllers/payments.js';
import { validate } from '../middleware/validate.js';
import {
  checkoutSessionSchema,
  portalSessionSchema,
} from '../validation/payments.js';

export const paymentRoutes = Router();

// POST /api/v1/payments/checkout -- Create Stripe Checkout session
paymentRoutes.post(
  '/checkout',
  validate({ body: checkoutSessionSchema }),
  paymentController.createCheckoutSession
);

// POST /api/v1/payments/portal -- Create Stripe billing portal session
paymentRoutes.post(
  '/portal',
  validate({ body: portalSessionSchema }),
  paymentController.createPortalSession
);

// GET /api/v1/payments/subscription -- Get current subscription details
paymentRoutes.get('/subscription', paymentController.getSubscription);

// GET /api/v1/payments/credits -- Get remaining generation credits
paymentRoutes.get('/credits', paymentController.getCredits);
