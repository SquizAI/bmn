// server/src/workers/email-campaign-worker.js

/**
 * Email Campaign Worker -- handles automated email marketing campaigns.
 *
 * Features:
 * - Scheduled email sequences (welcome, re-engagement, promotional)
 * - Audience segmentation based on purchase history
 * - Integration with Resend for sending
 * - Retry 3 times with exponential backoff
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { getQueue } from '../queues/index.js';

/**
 * @returns {import('ioredis').RedisOptions}
 */
function getBullRedisConfig() {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
  };
}

// ------ Campaign Types ------

const CAMPAIGN_TYPES = {
  welcome_sequence: {
    steps: [
      { delay: 0, template: 'welcome' },
      { delay: 3 * 24 * 60 * 60 * 1000, template: 'getting-started' },
      { delay: 7 * 24 * 60 * 60 * 1000, template: 'first-brand-reminder' },
    ],
  },
  reengagement: {
    steps: [
      { delay: 0, template: 'miss-you' },
      { delay: 5 * 24 * 60 * 60 * 1000, template: 'special-offer' },
    ],
  },
  promotional: {
    steps: [
      { delay: 0, template: 'promotional-blast' },
    ],
  },
};

// ------ Worker ------

/**
 * Email Campaign worker -- handles marketing email campaigns.
 *
 * @param {import('socket.io').Server} _io
 * @returns {Worker}
 */
export function initEmailCampaignWorker(_io) {
  const worker = new Worker(
    'email-campaign',
    async (job) => {
      const { type, campaignId, userId, brandId, step = 0 } = job.data;
      const jobLog = createJobLogger(job, 'email-campaign');

      jobLog.info({ type, campaignId, step }, 'Processing email campaign step');

      const campaign = CAMPAIGN_TYPES[type];
      if (!campaign) {
        throw new Error(`Unknown campaign type: ${type}`);
      }

      const currentStep = campaign.steps[step];
      if (!currentStep) {
        jobLog.info({ type, step }, 'Campaign sequence complete');
        return { complete: true, campaignId };
      }

      // Look up user email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (!profile?.email) {
        jobLog.warn({ userId }, 'No email found for user');
        return { skipped: true, reason: 'no_email' };
      }

      // Check unsubscribe status
      const { data: unsub } = await supabaseAdmin
        .from('email_preferences')
        .select('unsubscribed')
        .eq('user_id', userId)
        .eq('category', 'marketing')
        .single();

      if (unsub?.unsubscribed) {
        jobLog.info({ userId }, 'User unsubscribed from marketing emails');
        return { skipped: true, reason: 'unsubscribed' };
      }

      // Queue the actual email send via the email-send worker
      const emailQueue = getQueue('email-send');
      await emailQueue.add('campaign-email', {
        to: profile.email,
        template: currentStep.template,
        userId,
        data: {
          userName: profile.full_name || 'there',
          brandId,
          campaignId,
        },
      });

      // Log campaign step
      await supabaseAdmin.from('email_campaign_log').insert({
        campaign_id: campaignId,
        user_id: userId,
        step,
        template: currentStep.template,
        sent_at: new Date().toISOString(),
      });

      // Schedule next step if exists
      const nextStep = step + 1;
      if (nextStep < campaign.steps.length) {
        const nextDelay = campaign.steps[nextStep].delay;
        const campaignQueue = getQueue('email-campaign');
        await campaignQueue.add(
          'campaign-step',
          {
            type,
            campaignId,
            userId,
            brandId,
            step: nextStep,
          },
          {
            delay: nextDelay,
            jobId: `${campaignId}-step-${nextStep}`,
          }
        );
        jobLog.info({ nextStep, delay: nextDelay }, 'Next campaign step scheduled');
      }

      return {
        sent: true,
        template: currentStep.template,
        step,
        campaignId,
      };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Email campaign worker: job failed'
    );
    if (job?.attemptsMade >= 3) {
      Sentry.captureException(err, {
        tags: { queue: 'email-campaign' },
        extra: { jobData: job?.data },
      });
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Email campaign worker: error');
  });

  return worker;
}
