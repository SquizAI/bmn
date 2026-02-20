// server/src/routes/billing.js

import { Router } from 'express';
import * as paymentController from '../controllers/payments.js';
import { validate } from '../middleware/validate.js';
import {
  checkoutSessionSchema,
  portalSessionSchema,
} from '../validation/payments.js';

export const billingRoutes = Router();

// POST /api/v1/billing/checkout-session -- Create Stripe Checkout session
billingRoutes.post(
  '/checkout-session',
  validate({ body: checkoutSessionSchema }),
  paymentController.createCheckoutSession
);

// POST /api/v1/billing/portal-session -- Create Stripe billing portal session
billingRoutes.post(
  '/portal-session',
  validate({ body: portalSessionSchema }),
  paymentController.createPortalSession
);

// GET /api/v1/billing/subscription -- Get current subscription details
billingRoutes.get('/subscription', paymentController.getSubscription);

// GET /api/v1/billing/credits -- Get remaining generation credits
billingRoutes.get('/credits', paymentController.getCredits);
