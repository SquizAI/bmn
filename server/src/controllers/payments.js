// server/src/controllers/payments.js

import * as stripeService from '../services/stripe.js';
import * as creditService from '../services/credits.js';
import { getTierConfig, getTierByPriceId } from '../config/tiers.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * POST /api/v1/billing/checkout-session
 *
 * Create a Stripe Checkout session for subscription purchase.
 * User must be authenticated. Validates tier, creates/retrieves Stripe customer,
 * and returns the hosted checkout URL.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createCheckoutSession(req, res, next) {
  try {
    const { tier, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;
    const email = req.user.email;

    const result = await stripeService.createCheckoutSession(
      userId,
      email,
      tier,
      successUrl,
      cancelUrl
    );

    logger.info({ userId, tier, sessionId: result.sessionId }, 'Checkout session created');

    res.json({
      success: true,
      data: {
        url: result.url,
        sessionId: result.sessionId,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/billing/portal-session
 *
 * Create a Stripe Customer Portal session for managing subscription,
 * payment methods, and invoices.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createPortalSession(req, res, next) {
  try {
    const { returnUrl } = req.body;
    const stripeCustomerId = req.profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'No billing account found. Please subscribe to a plan first.',
      });
    }

    const result = await stripeService.createPortalSession(stripeCustomerId, returnUrl);

    res.json({
      success: true,
      data: {
        url: result.url,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/billing/subscription
 *
 * Get the current user's subscription details, combining data from
 * the local database and Stripe.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getSubscription(req, res, next) {
  try {
    const userId = req.user.id;
    const subscriptionTier = req.profile?.subscription_tier || 'free';
    const stripeCustomerId = req.profile?.stripe_customer_id;

    // Get local subscription record
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get credit balance
    const credits = await creditService.getCreditBalance(userId);

    // Build response
    const tierConfig = getTierConfig(subscriptionTier);

    res.json({
      success: true,
      data: {
        tier: subscriptionTier,
        tierDisplayName: tierConfig.displayName,
        status: subscription?.status || (subscriptionTier === 'free' ? 'active' : 'none'),
        credits: {
          logo: credits.logo,
          mockup: credits.mockup,
          video: credits.video,
        },
        currentPeriodStart: subscription?.current_period_start || null,
        currentPeriodEnd: subscription?.current_period_end || credits.periodEnd,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        stripeSubscriptionId: subscription?.stripe_subscription_id || null,
        features: tierConfig.features,
        brandLimit: tierConfig.brandLimit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/billing/credits
 *
 * Get the current user's remaining generation credits.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getCredits(req, res, next) {
  try {
    const userId = req.user.id;
    const credits = await creditService.getCreditBalance(userId);

    res.json({
      success: true,
      data: {
        logo: credits.logo,
        mockup: credits.mockup,
        video: credits.video,
        periodEnd: credits.periodEnd,
      },
    });
  } catch (err) {
    next(err);
  }
}
