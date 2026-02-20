// server/src/services/stripe.js

import Stripe from 'stripe';
import { config } from '../config/index.js';
import { getTierConfig, PAID_TIERS } from '../config/tiers.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { AppError, NotFoundError } from '../utils/errors.js';

/**
 * Stripe SDK client instance.
 * Pinned API version for stability. Telemetry disabled in production.
 *
 * @type {Stripe}
 */
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-18.acacia',
  maxNetworkRetries: 2,
  timeout: 10_000,
  telemetry: config.isProduction ? false : true,
});

export { stripe };

// ─── Customer Management ────────────────────────────────────────────────────

/**
 * Find an existing Stripe customer by user ID, or create a new one.
 * Stores the Stripe customer ID in the `profiles` table.
 *
 * @param {string} userId - Supabase auth user ID
 * @param {string} email - User's email address
 * @param {string} [name] - User's full name
 * @returns {Promise<string>} Stripe customer ID
 */
export async function getOrCreateCustomer(userId, email, name) {
  // 1. Check if profile already has a Stripe customer ID
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profileError) {
    logger.error({ userId, error: profileError }, 'Failed to fetch profile for Stripe customer lookup');
    throw new AppError('Failed to look up user profile', 500);
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // 2. Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // 3. Store the Stripe customer ID in profiles
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  if (updateError) {
    logger.error({ userId, stripeCustomerId: customer.id, error: updateError }, 'Failed to store Stripe customer ID in profile');
    // Non-fatal: the customer was created in Stripe. We can retry storing the ID later.
  }

  logger.info({ userId, stripeCustomerId: customer.id }, 'Stripe customer created');

  return customer.id;
}

// ─── Checkout Session ───────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for subscribing to a paid tier.
 *
 * @param {string} userId - Supabase auth user ID
 * @param {string} email - User's email
 * @param {string} tier - Tier name ('starter' | 'pro' | 'agency')
 * @param {string} successUrl - URL to redirect to on successful payment
 * @param {string} cancelUrl - URL to redirect to if user cancels
 * @returns {Promise<{url: string, sessionId: string}>} Checkout session URL and ID
 */
export async function createCheckoutSession(userId, email, tier, successUrl, cancelUrl) {
  // Validate tier
  if (!PAID_TIERS.includes(tier)) {
    throw new AppError(`Invalid tier: "${tier}". Must be one of: ${PAID_TIERS.join(', ')}`, 400, 'INVALID_TIER');
  }

  const tierConfig = getTierConfig(tier);

  if (!tierConfig.stripePriceId) {
    throw new AppError(`Tier "${tier}" does not have a configured Stripe price`, 500, 'MISSING_PRICE_ID');
  }

  // Get or create the Stripe customer
  const stripeCustomerId = await getOrCreateCustomer(userId, email);

  // Check for existing active subscription
  const existingSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
  });

  if (existingSubs.data.length > 0) {
    throw new AppError(
      'You already have an active subscription. Use the billing portal to change your plan.',
      409,
      'SUBSCRIPTION_EXISTS'
    );
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [
      {
        price: tierConfig.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl || `${config.APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${config.APP_URL}/billing?canceled=true`,
    subscription_data: {
      metadata: {
        supabase_user_id: userId,
        tier,
      },
    },
    metadata: {
      supabase_user_id: userId,
      tier,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
  });

  logger.info({ userId, tier, sessionId: session.id }, 'Stripe checkout session created');

  return {
    url: session.url,
    sessionId: session.id,
  };
}

// ─── Customer Portal ────────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session for managing subscription.
 *
 * @param {string} stripeCustomerId - Stripe customer ID
 * @param {string} [returnUrl] - URL to return to after portal session
 * @returns {Promise<{url: string}>} Portal session URL
 */
export async function createPortalSession(stripeCustomerId, returnUrl) {
  if (!stripeCustomerId) {
    throw new AppError('No Stripe customer found. Please subscribe first.', 400, 'NO_CUSTOMER');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || `${config.APP_URL}/billing`,
  });

  logger.info({ stripeCustomerId }, 'Stripe portal session created');

  return { url: session.url };
}

// ─── Subscription Retrieval ─────────────────────────────────────────────────

/**
 * Get the current active subscription for a Stripe customer.
 *
 * @param {string} stripeCustomerId - Stripe customer ID
 * @returns {Promise<Stripe.Subscription|null>} Active subscription or null
 */
export async function getSubscription(stripeCustomerId) {
  if (!stripeCustomerId) {
    return null;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 1,
    expand: ['data.default_payment_method'],
  });

  return subscriptions.data[0] || null;
}

// ─── Webhook Signature Verification ─────────────────────────────────────────

/**
 * Verify and construct a Stripe webhook event from raw request body.
 *
 * @param {Buffer} rawBody - Raw request body (express.raw())
 * @param {string} signature - Stripe-Signature header value
 * @returns {Stripe.Event} Verified Stripe event
 * @throws {AppError} If signature verification fails
 */
export function constructWebhookEvent(rawBody, signature) {
  try {
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.warn({ error: err.message }, 'Stripe webhook signature verification failed');
    throw new AppError('Invalid webhook signature', 400, 'WEBHOOK_SIGNATURE_INVALID');
  }
}
