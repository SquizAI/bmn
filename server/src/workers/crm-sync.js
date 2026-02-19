// server/src/workers/crm-sync.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

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

// ---------------------------------------------------------------------------
// STUB: GoHighLevel (GHL) API -- replace with real implementation
// ---------------------------------------------------------------------------

/**
 * Map of event types to their GHL action handlers.
 * Each handler receives the event data and performs the appropriate GHL action.
 * STUB: All handlers log the action and return a simulated response.
 */
const GHL_EVENT_HANDLERS = {
  'user.created': async (data, jobLog) => {
    // TODO: Create contact in GHL
    // POST /contacts with name, email, phone
    jobLog.info({ email: data.email }, 'STUB: GHL create contact');
    return { action: 'create_contact', ghlContactId: `stub-${Date.now()}` };
  },

  'wizard.started': async (data, jobLog) => {
    // TODO: Add tag 'wizard_started' to contact
    jobLog.info({ brandId: data.brandId }, 'STUB: GHL add tag wizard_started');
    return { action: 'add_tag', tag: 'wizard_started' };
  },

  'wizard.step-completed': async (data, jobLog) => {
    // TODO: Update custom field with step progress
    jobLog.info({ step: data.step }, 'STUB: GHL update wizard step');
    return { action: 'update_field', field: 'wizard_step', value: data.step };
  },

  'wizard.abandoned': async (data, jobLog) => {
    // TODO: Add tag 'wizard_abandoned', trigger automation
    jobLog.info({ lastStep: data.lastStep }, 'STUB: GHL add tag wizard_abandoned');
    return { action: 'add_tag', tag: 'wizard_abandoned' };
  },

  'brand.completed': async (data, jobLog) => {
    // TODO: Add tag 'brand_complete', update opportunity
    jobLog.info({ brandId: data.brandId }, 'STUB: GHL brand completed');
    return { action: 'add_tag', tag: 'brand_complete' };
  },

  'subscription.created': async (data, jobLog) => {
    // TODO: Update contact with subscription tier, create opportunity
    jobLog.info({ tier: data.tier }, 'STUB: GHL subscription created');
    return { action: 'update_subscription', tier: data.tier };
  },

  'subscription.cancelled': async (data, jobLog) => {
    // TODO: Add tag 'subscription_cancelled', trigger winback
    jobLog.info('STUB: GHL subscription cancelled');
    return { action: 'add_tag', tag: 'subscription_cancelled' };
  },
};

/**
 * CRM Sync worker -- syncs user/brand events to GoHighLevel.
 * Maps application events to GHL API actions (create contact, add tags,
 * update custom fields, create opportunities).
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initCRMSyncWorker(io) {
  const queueConfig = QUEUE_CONFIGS['crm-sync'];

  const worker = new Worker(
    'crm-sync',
    async (job) => {
      const { userId, eventType, data } = job.data;
      const jobLog = createJobLogger(job, 'crm-sync');

      jobLog.info({ eventType }, 'CRM sync started');

      const handler = GHL_EVENT_HANDLERS[eventType];
      if (!handler) {
        jobLog.warn({ eventType }, 'Unknown CRM event type, skipping');
        return { synced: false, reason: `Unknown event type: ${eventType}` };
      }

      try {
        const result = await handler(data, jobLog);

        // Log sync attempt to ghl_sync_log table
        await supabaseAdmin.from('ghl_sync_log').insert({
          user_id: userId,
          event_type: eventType,
          status: 'success',
          request_data: data,
          response_data: result,
        }).catch((dbErr) => {
          jobLog.error({ err: dbErr }, 'Failed to log CRM sync to ghl_sync_log');
        });

        jobLog.info({ eventType, result }, 'CRM sync complete');
        return { synced: true, eventType, result };
      } catch (error) {
        jobLog.error({ err: error, eventType }, 'CRM sync failed');

        // Log failed sync attempt
        await supabaseAdmin.from('ghl_sync_log').insert({
          user_id: userId,
          event_type: eventType,
          status: 'failed',
          request_data: data,
          error: error.message,
        }).catch((dbErr) => {
          jobLog.error({ err: dbErr }, 'Failed to log CRM sync failure to ghl_sync_log');
        });

        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'CRM sync worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'CRM sync worker: error');
  });

  return worker;
}
