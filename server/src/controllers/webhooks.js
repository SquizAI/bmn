// server/src/controllers/webhooks.js

import { constructWebhookEvent, getStripe } from '../services/stripe.js';
import { allocateCredits, refillCredits } from '../services/credits.js';
import { getTierByPriceId, getTierConfig } from '../config/tiers.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { logger } from '../lib/logger.js';

/**
 * Stripe webhook event types we handle.
 * @type {Set<string>}
 */
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

// ─── Idempotency ────────────────────────────────────────────────────────────

/**
 * Check if a webhook event has already been processed (idempotency guard).
 *
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<boolean>} True if already processed
 */
async function isEventProcessed(eventId) {
  const { data } = await supabaseAdmin
    .from('webhook_events')
    .select('id')
    .eq('id', eventId)
    .single();

  return !!data;
}

/**
 * Mark a webhook event as processed.
 *
 * @param {string} eventId - Stripe event ID
 * @param {string} eventType - Stripe event type
 * @returns {Promise<void>}
 */
async function markEventProcessed(eventId, eventType) {
  await supabaseAdmin
    .from('webhook_events')
    .insert({
      id: eventId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
    });
}

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

/**
 * Look up a user ID from a Stripe customer ID.
 *
 * @param {string} stripeCustomerId
 * @returns {Promise<string|null>}
 */
async function getUserIdByStripeCustomer(stripeCustomerId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  return profile?.id || null;
}

/**
 * Look up a user's email from their Supabase user ID.
 *
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getUserEmail(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  return profile?.email || null;
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

/**
 * Handle checkout.session.completed event.
 * Creates subscription record, allocates credits, emits socket event,
 * queues CRM sync and welcome email.
 *
 * @param {import('stripe').Stripe.CheckoutSession} session
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.supabase_user_id;
  const tier = session.metadata?.tier;
  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  if (!userId || !tier || !stripeSubscriptionId) {
    logger.warn({ sessionId: session.id, userId, tier }, 'checkout.session.completed missing required metadata');
    return;
  }

  // Retrieve the full subscription from Stripe for period dates
  const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);

  const priceId = stripeSubscription.items.data[0]?.price?.id;

  // Create subscription record in database
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId || '',
      tier,
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    }, {
      onConflict: 'stripe_subscription_id',
    });

  if (subError) {
    logger.error({ userId, tier, error: subError }, 'Failed to create subscription record');
    throw subError;
  }

  // Update profile tier and Stripe customer ID
  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: tier,
      stripe_customer_id: stripeCustomerId,
    })
    .eq('id', userId);

  // Allocate credits for the new tier
  await allocateCredits(userId, tier);

  // Queue CRM sync (async via BullMQ)
  try {
    await dispatchJob('crm-sync', {
      userId,
      eventType: 'subscription.created',
      data: { tier, stripeSubscriptionId },
    });
  } catch (err) {
    logger.warn({ userId, error: err.message }, 'Failed to queue CRM sync for new subscription');
  }

  // Queue welcome/subscription confirmation email (async via BullMQ)
  const email = await getUserEmail(userId);
  if (email) {
    try {
      await dispatchJob('email-send', {
        to: email,
        template: 'subscription-confirmed',
        data: {
          tier,
          tierDisplayName: getTierConfig(tier).displayName,
          price: getTierConfig(tier).price,
        },
        userId,
      });
    } catch (err) {
      logger.warn({ userId, error: err.message }, 'Failed to queue subscription confirmation email');
    }
  }

  // TODO: Emit Socket.io event `subscription:created` when socket module is available
  // io.to(`user:${userId}`).emit('subscription:created', { tier, status: 'active' });

  logger.info({ userId, tier, stripeSubscriptionId }, 'Checkout completed -- subscription created');
}

/**
 * Handle customer.subscription.updated event.
 * Updates tier, adjusts credits if tier changed, emits socket event.
 *
 * @param {import('stripe').Stripe.Subscription} subscription
 */
async function handleSubscriptionUpdated(subscription) {
  const stripeCustomerId = subscription.customer;
  const userId = await getUserIdByStripeCustomer(stripeCustomerId);

  if (!userId) {
    logger.warn({ stripeCustomerId }, 'subscription.updated -- no matching user found');
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const tierConfig = priceId ? getTierByPriceId(priceId) : null;
  const tier = tierConfig?.name || subscription.metadata?.tier || 'free';

  // Map Stripe status to our status values
  const statusMap = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled',
    trialing: 'trialing',
    paused: 'paused',
    incomplete: 'incomplete',
    incomplete_expired: 'cancelled',
    unpaid: 'past_due',
  };
  const status = statusMap[subscription.status] || 'active';

  // Update subscription record
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .update({
      stripe_price_id: priceId || '',
      tier,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancelled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (subError) {
    logger.error({ userId, error: subError }, 'Failed to update subscription record');
  }

  // Update profile tier
  await supabaseAdmin
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('id', userId);

  // If tier changed (upgrade/downgrade), re-allocate credits
  const { data: currentCredits } = await supabaseAdmin.rpc('get_credit_summary', {
    p_user_id: userId,
  });

  // If the subscription is still active, ensure credits match the new tier
  if (status === 'active' && tierConfig) {
    await allocateCredits(userId, tier);
  }

  // TODO: Emit Socket.io event `subscription:updated`
  // io.to(`user:${userId}`).emit('subscription:updated', { tier, status, cancelAtPeriodEnd: subscription.cancel_at_period_end });

  logger.info({ userId, tier, status, stripeSubscriptionId: subscription.id }, 'Subscription updated');
}

/**
 * Handle customer.subscription.deleted event.
 * Downgrades user to free tier, resets credits, emits socket event.
 *
 * @param {import('stripe').Stripe.Subscription} subscription
 */
async function handleSubscriptionDeleted(subscription) {
  const stripeCustomerId = subscription.customer;
  const userId = await getUserIdByStripeCustomer(stripeCustomerId);

  if (!userId) {
    logger.warn({ stripeCustomerId }, 'subscription.deleted -- no matching user found');
    return;
  }

  // Update subscription record to cancelled
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Downgrade profile to free tier
  await supabaseAdmin
    .from('profiles')
    .update({ subscription_tier: 'free' })
    .eq('id', userId);

  // Allocate free-tier credits (replaces any remaining paid credits)
  await allocateCredits(userId, 'free');

  // Queue CRM sync
  try {
    await dispatchJob('crm-sync', {
      userId,
      eventType: 'subscription.cancelled',
      data: { previousTier: subscription.metadata?.tier || 'unknown' },
    });
  } catch (err) {
    logger.warn({ userId, error: err.message }, 'Failed to queue CRM sync for subscription cancellation');
  }

  // Queue cancellation email
  const email = await getUserEmail(userId);
  if (email) {
    try {
      await dispatchJob('email-send', {
        to: email,
        template: 'subscription-cancelled',
        data: { userId },
        userId,
      });
    } catch (err) {
      logger.warn({ userId, error: err.message }, 'Failed to queue subscription cancellation email');
    }
  }

  // TODO: Emit Socket.io event `subscription:deleted`
  // io.to(`user:${userId}`).emit('subscription:deleted', { tier: 'free' });

  logger.info({ userId, stripeSubscriptionId: subscription.id }, 'Subscription deleted -- downgraded to free');
}

/**
 * Handle invoice.payment_succeeded event.
 * On renewal invoices (not the first), refill monthly credits.
 * Also records the payment in payment_history.
 *
 * @param {import('stripe').Stripe.Invoice} invoice
 */
async function handlePaymentSucceeded(invoice) {
  const stripeCustomerId = invoice.customer;
  const userId = await getUserIdByStripeCustomer(stripeCustomerId);

  if (!userId) {
    logger.warn({ stripeCustomerId }, 'invoice.payment_succeeded -- no matching user found');
    return;
  }

  // Record payment in payment_history
  const paymentIntentId = invoice.payment_intent;
  if (paymentIntentId && typeof paymentIntentId === 'string') {
    await supabaseAdmin
      .from('payment_history')
      .upsert({
        user_id: userId,
        stripe_payment_id: paymentIntentId,
        stripe_invoice_id: invoice.id,
        amount: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency || 'usd',
        status: 'succeeded',
        description: invoice.lines?.data?.[0]?.description || 'Subscription payment',
        receipt_url: invoice.hosted_invoice_url || null,
        paid_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_payment_id',
      });
  }

  // Check if this is a renewal (not the first invoice for a subscription).
  // Stripe sets billing_reason to 'subscription_cycle' for renewals.
  const isRenewal = invoice.billing_reason === 'subscription_cycle';

  if (!isRenewal) {
    logger.info({ userId, billingReason: invoice.billing_reason }, 'Payment succeeded -- not a renewal, skipping credit refill');
    return;
  }

  // Get user's current tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const tier = profile?.subscription_tier || 'free';

  if (tier === 'free') {
    logger.warn({ userId }, 'Payment succeeded for free-tier user -- unexpected');
    return;
  }

  // Refill credits for the new billing period
  await refillCredits(userId, tier);

  // TODO: Emit Socket.io event `credits:refilled`
  // io.to(`user:${userId}`).emit('credits:refilled', { tier });

  logger.info({ userId, tier, invoiceId: invoice.id }, 'Invoice paid -- credits refilled');
}

/**
 * Handle invoice.payment_failed event.
 * Updates subscription status to past_due, queues warning email.
 *
 * @param {import('stripe').Stripe.Invoice} invoice
 */
async function handlePaymentFailed(invoice) {
  const stripeCustomerId = invoice.customer;
  const userId = await getUserIdByStripeCustomer(stripeCustomerId);

  if (!userId) {
    logger.warn({ stripeCustomerId }, 'invoice.payment_failed -- no matching user found');
    return;
  }

  // Update subscription status to past_due
  const subscriptionId = invoice.subscription;
  if (subscriptionId && typeof subscriptionId === 'string') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', subscriptionId);
  }

  // Record failed payment
  const paymentIntentId = invoice.payment_intent;
  if (paymentIntentId && typeof paymentIntentId === 'string') {
    await supabaseAdmin
      .from('payment_history')
      .upsert({
        user_id: userId,
        stripe_payment_id: paymentIntentId,
        stripe_invoice_id: invoice.id,
        amount: (invoice.amount_due || 0) / 100,
        currency: invoice.currency || 'usd',
        status: 'failed',
        description: 'Payment failed',
        paid_at: null,
      }, {
        onConflict: 'stripe_payment_id',
      });
  }

  // Queue warning email
  const email = await getUserEmail(userId);
  if (email) {
    try {
      await dispatchJob('email-send', {
        to: email,
        template: 'generation-failed',
        data: {
          type: 'payment_failed',
          message: 'Your payment has failed. Please update your payment method to continue using Brand Me Now.',
          invoiceUrl: invoice.hosted_invoice_url || null,
        },
        userId,
      });
    } catch (err) {
      logger.warn({ userId, error: err.message }, 'Failed to queue payment failure email');
    }
  }

  // TODO: Emit Socket.io event `subscription:payment_failed`
  // io.to(`user:${userId}`).emit('subscription:payment_failed', { invoiceUrl: invoice.hosted_invoice_url });

  logger.warn({ userId, invoiceId: invoice.id }, 'Payment failed -- subscription past_due');
}

// ─── Main Webhook Handler ───────────────────────────────────────────────────

/**
 * POST /api/v1/webhooks/stripe
 *
 * Handle Stripe webhook events. The raw body is required for signature
 * verification. Uses idempotency checks to prevent duplicate processing.
 *
 * Flow:
 * 1. Verify Stripe signature
 * 2. Check idempotency (skip if already processed)
 * 3. Process the event synchronously (per PRD: events are fast enough inline)
 * 4. Mark event as processed
 * 5. Return 200 immediately
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleStripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    logger.warn('Stripe webhook received without signature header');
    return res.status(400).json({ success: false, error: 'Missing Stripe signature' });
  }

  // 1. Verify signature and construct event
  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  const { id: eventId, type: eventType } = event;

  logger.info({ eventId, eventType }, 'Stripe webhook received');

  // 2. Skip unhandled event types
  if (!HANDLED_EVENTS.has(eventType)) {
    logger.debug({ eventType }, 'Unhandled Stripe webhook event type -- skipping');
    return res.json({ received: true });
  }

  // 3. Idempotency check
  try {
    const alreadyProcessed = await isEventProcessed(eventId);
    if (alreadyProcessed) {
      logger.info({ eventId, eventType }, 'Duplicate webhook event -- skipping');
      return res.json({ received: true });
    }
  } catch (err) {
    logger.warn({ eventId, error: err.message }, 'Idempotency check failed -- processing anyway');
  }

  // 4. Process the event
  try {
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        logger.debug({ eventType }, 'No handler for event type');
    }

    // 5. Mark event as processed (idempotency)
    await markEventProcessed(eventId, eventType);

    logger.info({ eventId, eventType }, 'Stripe webhook processed successfully');
  } catch (err) {
    logger.error({ eventId, eventType, error: err.message, stack: err.stack }, 'Stripe webhook processing failed');
    // Return 500 so Stripe retries the webhook
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }

  // 6. Return 200
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
