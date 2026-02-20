// server/src/cron/detect-abandonment.js

/**
 * Abandonment Detection Cron Job
 *
 * Runs every hour to detect wizard sessions that have been inactive for 24+ hours.
 * For each abandoned session:
 *   1. Dispatches a `wizard.abandoned` CRM sync job
 *   2. Dispatches a `wizard-abandoned` email job
 *   3. Marks the brand as `abandoned` to prevent re-triggering
 *
 * This module exports a setup function that registers the cron job
 * as a repeatable BullMQ job in the cleanup queue.
 */

import { createHmac } from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { logger as rootLogger } from '../lib/logger.js';
import { config } from '../config/index.js';

const logger = rootLogger.child({ service: 'cron:detect-abandonment' });

/**
 * @typedef {Object} AbandonedBrand
 * @property {string} id - Brand ID
 * @property {string} user_id - User ID
 * @property {string} wizard_step - Last wizard step
 * @property {string} updated_at - Last activity timestamp
 */

/**
 * Wizard step order for calculating progress percentage.
 */
const WIZARD_STEPS = [
  'phone-terms',
  'social-handles',
  'social-analysis',
  'brand-identity',
  'logo-style',
  'logo-generation',
  'product-selection',
  'mockup-generation',
  'bundle-builder',
  'profit-projections',
  'checkout',
  'completion',
];

/**
 * Calculate wizard progress percentage from step name.
 *
 * @param {string} stepName
 * @returns {number} 0-100
 */
function calculateProgress(stepName) {
  const index = WIZARD_STEPS.indexOf(stepName);
  if (index === -1) return 0;
  return Math.round(((index + 1) / WIZARD_STEPS.length) * 100);
}

/**
 * Generate an HMAC-signed resume URL for the abandonment email.
 *
 * @param {string} brandId
 * @param {string} userId
 * @param {string} lastStep
 * @returns {string} Resume URL with signed token
 */
function generateResumeUrl(brandId, userId, lastStep) {
  const payload = JSON.stringify({
    brandId,
    userId,
    step: lastStep,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24h expiry
  });

  const secret = config.RESUME_TOKEN_SECRET || 'dev-resume-token-secret-change-in-production';
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64url') + '.' + hmac;

  const appUrl = config.APP_URL || 'https://app.brandmenow.com';
  return `${appUrl}/wizard/resume?token=${token}`;
}

/**
 * Detect and process abandoned wizard sessions.
 *
 * Queries brands where:
 * - wizard_step is NOT 'completion'
 * - updated_at is more than 24 hours ago
 * - status is NOT already 'abandoned'
 *
 * For each abandoned brand, dispatches CRM sync and email jobs,
 * then marks the brand as abandoned.
 *
 * @returns {Promise<{ processed: number, errors: number }>}
 */
export async function detectAbandonment() {
  logger.info('Running abandonment detection');

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query brands that are abandoned (not completed, inactive for 24h, not already marked)
  const { data: abandonedBrands, error } = await supabaseAdmin
    .from('brands')
    .select('id, user_id, wizard_step, updated_at')
    .neq('wizard_step', 'completion')
    .neq('status', 'abandoned')
    .lt('updated_at', twentyFourHoursAgo)
    .limit(100); // Process up to 100 per run

  if (error) {
    logger.error({ err: error }, 'Failed to query abandoned brands');
    return { processed: 0, errors: 1 };
  }

  if (!abandonedBrands || abandonedBrands.length === 0) {
    logger.info('No abandoned wizard sessions found');
    return { processed: 0, errors: 0 };
  }

  logger.info({ count: abandonedBrands.length }, 'Found abandoned wizard sessions');

  let processed = 0;
  let errors = 0;

  for (const brand of abandonedBrands) {
    try {
      const lastStep = brand.wizard_step || 'unknown';
      const progressPercent = calculateProgress(lastStep);

      // Look up user profile for email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', brand.user_id)
        .single();

      if (!profile?.email) {
        logger.warn({ userId: brand.user_id, brandId: brand.id }, 'No email found for abandoned brand user');
        errors++;
        continue;
      }

      const userName = (profile.full_name || 'there').split(' ')[0];
      const resumeUrl = generateResumeUrl(brand.id, brand.user_id, lastStep);

      // 1. Dispatch CRM sync job
      await dispatchJob('crm-sync', {
        userId: brand.user_id,
        eventType: 'wizard.abandoned',
        data: { lastStep },
      }).catch((err) => {
        logger.warn({ err, brandId: brand.id }, 'Failed to dispatch CRM sync for abandonment');
      });

      // 2. Dispatch email job
      await dispatchJob('email-send', {
        to: profile.email,
        template: 'wizard-abandoned',
        data: {
          userName,
          resumeUrl,
          lastStep,
          progressPercent,
        },
        userId: brand.user_id,
      }).catch((err) => {
        logger.warn({ err, brandId: brand.id }, 'Failed to dispatch abandonment email');
      });

      // 3. Mark brand as abandoned to prevent re-triggering
      await supabaseAdmin
        .from('brands')
        .update({ status: 'abandoned' })
        .eq('id', brand.id);

      processed++;
      logger.info(
        { brandId: brand.id, userId: brand.user_id, lastStep, progressPercent },
        'Processed abandoned wizard session'
      );
    } catch (err) {
      errors++;
      logger.error({ err, brandId: brand.id }, 'Error processing abandoned brand');
    }
  }

  logger.info({ processed, errors, total: abandonedBrands.length }, 'Abandonment detection complete');
  return { processed, errors };
}

/**
 * Register the abandonment detection as a repeatable BullMQ job.
 * Runs every hour via the cleanup queue.
 *
 * This should be called once during server startup.
 *
 * @param {import('bullmq').Queue} cleanupQueue - The cleanup queue
 * @returns {Promise<void>}
 */
export async function registerAbandonmentCron(cleanupQueue) {
  await cleanupQueue.add(
    'detect-abandonment',
    { type: 'detect-abandonment' },
    {
      repeat: { every: 3_600_000 }, // Every hour
      jobId: 'recurring-abandonment-detection',
    }
  );

  logger.info('Abandonment detection cron registered (every 1 hour)');
}
