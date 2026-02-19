// server/src/controllers/payments.js

/**
 * POST /api/v1/payments/checkout
 * Create a Stripe Checkout session for subscription purchase.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createCheckoutSession(req, res) {
  // TODO: Implement -- create Stripe checkout session, return URL
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/payments/portal
 * Create a Stripe billing portal session for subscription management.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createPortalSession(req, res) {
  // TODO: Implement -- create Stripe portal session, return URL
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/payments/subscription
 * Get the current user's subscription details.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getSubscription(req, res) {
  // TODO: Implement -- fetch subscription from Supabase + Stripe
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/payments/credits
 * Get the current user's remaining generation credits.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getCredits(req, res) {
  // TODO: Implement -- fetch credit balance from credits table
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}
