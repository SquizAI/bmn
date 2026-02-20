// server/src/services/credits.js

import { supabaseAdmin } from '../lib/supabase.js';
import { getTierConfig } from '../config/tiers.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * @typedef {'logo' | 'mockup' | 'video'} CreditType
 */

/**
 * @typedef {Object} CreditCheckResult
 * @property {boolean} allowed - Whether the user can proceed
 * @property {number} remaining - Credits remaining for this type
 * @property {boolean} needsUpgrade - True if user should upgrade to get more credits
 * @property {boolean} overageAllowed - True if overage will be charged instead
 */

/**
 * @typedef {Object} CreditBalance
 * @property {{ remaining: number, used: number, total: number }} logo
 * @property {{ remaining: number, used: number, total: number }} mockup
 * @property {{ remaining: number, used: number, total: number }} video
 * @property {string|null} periodEnd
 */

// ─── Allocate Credits ───────────────────────────────────────────────────────

/**
 * Allocate initial credits when a user subscribes or signs up (free trial).
 * Uses the database `refill_credits` function which handles upsert logic.
 *
 * @param {string} userId - Supabase user ID
 * @param {string} tierName - Tier name ('free' | 'starter' | 'pro' | 'agency')
 * @returns {Promise<void>}
 */
export async function allocateCredits(userId, tierName) {
  const tier = getTierConfig(tierName);

  // Use the existing refill_credits RPC function which handles upsert
  const { error } = await supabaseAdmin.rpc('refill_credits', {
    p_user_id: userId,
    p_tier: tierName,
  });

  if (error) {
    logger.error({ userId, tierName, error }, 'Credit allocation failed');
    throw new AppError(`Credit allocation failed: ${error.message}`, 500);
  }

  logger.info({
    userId,
    tierName,
    credits: { logo: tier.logoCredits, mockup: tier.mockupCredits },
  }, 'Credits allocated');
}

// ─── Check Credits ──────────────────────────────────────────────────────────

/**
 * Check if a user has sufficient credits for a generation.
 *
 * @param {string} userId - Supabase user ID
 * @param {CreditType} creditType - Type of credit to check
 * @param {number} [quantity=1] - Number of credits needed
 * @returns {Promise<CreditCheckResult>}
 */
export async function checkCredits(userId, creditType, quantity = 1) {
  // Get active credits for this type via the RPC function
  const { data: creditSummary, error } = await supabaseAdmin.rpc('get_credit_summary', {
    p_user_id: userId,
  });

  if (error) {
    logger.error({ userId, creditType, error }, 'Credit check RPC failed');
    return { allowed: false, remaining: 0, needsUpgrade: true, overageAllowed: false };
  }

  // Find the matching credit type row
  const creditRow = creditSummary?.find((row) => row.credit_type === creditType);

  if (!creditRow) {
    logger.warn({ userId, creditType }, 'No credit record found for user');
    return { allowed: false, remaining: 0, needsUpgrade: true, overageAllowed: false };
  }

  const remaining = creditRow.remaining;

  if (remaining >= quantity) {
    return { allowed: true, remaining, needsUpgrade: false, overageAllowed: false };
  }

  // Not enough credits -- check if overage is allowed for this user's tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const tier = getTierConfig(profile?.subscription_tier || 'free');

  if (tier.overageEnabled) {
    return { allowed: true, remaining, needsUpgrade: false, overageAllowed: true };
  }

  return { allowed: false, remaining, needsUpgrade: true, overageAllowed: false };
}

// ─── Deduct Credits ─────────────────────────────────────────────────────────

/**
 * Deduct credits from a user's balance using the atomic database function.
 * Prevents race conditions via SELECT FOR UPDATE inside the RPC.
 *
 * @param {string} userId - Supabase user ID
 * @param {CreditType} creditType - Type of credit to deduct
 * @param {number} [quantity=1] - Number of credits to deduct
 * @param {string} [reason] - Human-readable reason for the deduction
 * @param {string} [brandId] - Brand ID associated with the deduction
 * @returns {Promise<{ success: boolean, remaining: number }>}
 */
export async function deductCredits(userId, creditType, quantity = 1, reason, brandId) {
  const { data: success, error } = await supabaseAdmin.rpc('deduct_credit', {
    p_user_id: userId,
    p_credit_type: creditType,
    p_amount: quantity,
  });

  if (error) {
    logger.error({ userId, creditType, quantity, error }, 'Credit deduction RPC failed');
    throw new AppError(`Credit deduction failed: ${error.message}`, 500);
  }

  if (!success) {
    logger.warn({ userId, creditType, quantity }, 'Insufficient credits for deduction');
    return { success: false, remaining: 0 };
  }

  // Get updated balance for the response
  const { data: creditSummary } = await supabaseAdmin.rpc('get_credit_summary', {
    p_user_id: userId,
  });
  const creditRow = creditSummary?.find((row) => row.credit_type === creditType);
  const remaining = creditRow?.remaining ?? 0;

  logger.info({ userId, creditType, quantity, remaining, reason, brandId }, 'Credits deducted');

  return { success: true, remaining };
}

// ─── Refund Credits ─────────────────────────────────────────────────────────

/**
 * Refund credits back to a user (e.g., after a failed generation job).
 * Uses the atomic `refund_credit` database function to add quantity back
 * to `credits_remaining` and decrement `credits_used`.
 *
 * @param {string} userId - Supabase user ID
 * @param {CreditType} creditType - Type of credit to refund
 * @param {number} [quantity=1] - Number of credits to refund
 * @param {string} [reason] - Human-readable reason for the refund
 * @returns {Promise<void>}
 */
export async function refundCredits(userId, creditType, quantity = 1, reason) {
  const { data, error } = await supabaseAdmin.rpc('refund_credit', {
    p_user_id: userId,
    p_credit_type: creditType,
    p_amount: quantity,
  });

  if (error) {
    logger.error({ userId, creditType, quantity, error }, 'Credit refund RPC failed');
    throw new AppError(`Credit refund failed: ${error.message}`, 500);
  }

  if (data && !data.success) {
    logger.warn({ userId, creditType, quantity, error: data.error }, 'Credit refund failed -- no active credit record');
  }

  logger.info({ userId, creditType, quantity, reason, balanceAfter: data?.balance_after }, 'Credits refunded');
}

// ─── Refill Credits ─────────────────────────────────────────────────────────

/**
 * Refill credits on monthly billing cycle renewal.
 * Resets remaining to tier allocation, resets used to 0.
 * Unused credits do NOT roll over.
 *
 * @param {string} userId - Supabase user ID
 * @param {string} tierName - Tier name
 * @returns {Promise<void>}
 */
export async function refillCredits(userId, tierName) {
  const tier = getTierConfig(tierName);

  if (!tier.creditsRefillMonthly) {
    logger.info({ userId, tierName }, 'Tier does not support monthly refill -- skipping');
    return;
  }

  const { error } = await supabaseAdmin.rpc('refill_credits', {
    p_user_id: userId,
    p_tier: tierName,
  });

  if (error) {
    logger.error({ userId, tierName, error }, 'Credit refill failed');
    throw new AppError(`Credit refill failed: ${error.message}`, 500);
  }

  logger.info({ userId, tierName }, 'Credits refilled');
}

// ─── Get Credit Balance ─────────────────────────────────────────────────────

/**
 * Get current credit balances for a user across all credit types.
 *
 * @param {string} userId - Supabase user ID
 * @returns {Promise<CreditBalance>}
 */
export async function getCreditBalance(userId) {
  const { data: creditSummary, error } = await supabaseAdmin.rpc('get_credit_summary', {
    p_user_id: userId,
  });

  if (error) {
    logger.error({ userId, error }, 'Failed to get credit summary');
    return {
      logo: { remaining: 0, used: 0, total: 0 },
      mockup: { remaining: 0, used: 0, total: 0 },
      video: { remaining: 0, used: 0, total: 0 },
      periodEnd: null,
    };
  }

  /** @type {CreditBalance} */
  const balance = {
    logo: { remaining: 0, used: 0, total: 0 },
    mockup: { remaining: 0, used: 0, total: 0 },
    video: { remaining: 0, used: 0, total: 0 },
    periodEnd: null,
  };

  for (const row of (creditSummary || [])) {
    if (balance[row.credit_type]) {
      balance[row.credit_type] = {
        remaining: row.remaining,
        used: row.used,
        total: row.total,
      };
      // Use the earliest period_end as the overall period end
      if (!balance.periodEnd || new Date(row.period_end) < new Date(balance.periodEnd)) {
        balance.periodEnd = row.period_end;
      }
    }
  }

  return balance;
}
