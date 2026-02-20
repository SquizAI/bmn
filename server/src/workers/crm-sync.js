// server/src/workers/crm-sync.js

/**
 * CRM Sync Worker -- syncs user/brand events to GoHighLevel.
 *
 * Maps application events to GHL API actions:
 * - wizard.started      -> Upsert contact + tag "wizard-started"
 * - brand.completed     -> Update custom fields + tag "brand-completed"
 * - wizard.abandoned    -> Tag "abandoned-step-{stepName}"
 * - subscription.created -> Tags "subscriber" + "tier-{tierName}"
 * - logo.generated      -> Update logo_url custom field
 * - mockup.generated    -> Update brand_status to "mockups-ready"
 *
 * Retry: 3 attempts with exponential backoff [1s, 5s, 15s].
 * On final failure: log to Sentry + dead-letter queue.
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import {
  upsertContact,
  addTag,
  updateCustomFields,
} from '../services/ghl.js';

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

// ── Profile Resolution ────────────────────────────────────────────

/**
 * Resolve user profile from Supabase for CRM sync.
 * Returns only the fields needed for GHL -- no passwords, no tokens.
 *
 * @param {string} userId
 * @returns {Promise<{ email: string, firstName: string, lastName: string, phone: string | null, ghlContactId: string | null }>}
 */
async function resolveUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, phone, ghl_contact_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to resolve profile for user ${userId}: ${error?.message || 'not found'}`);
  }

  const nameParts = (data.full_name || 'Unknown').split(' ');
  return {
    email: data.email,
    firstName: nameParts[0] || 'Unknown',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: data.phone || null,
    ghlContactId: data.ghl_contact_id || null,
  };
}

/**
 * Store GHL contact ID on user profile for future lookups.
 *
 * @param {string} userId
 * @param {string} contactId
 * @returns {Promise<void>}
 */
async function storeContactId(userId, contactId) {
  await supabaseAdmin
    .from('profiles')
    .update({ ghl_contact_id: contactId })
    .eq('id', userId);
}

// ── Event Handlers ────────────────────────────────────────────────

/**
 * Map of event types to their GHL action handlers.
 * Each handler receives (userId, eventData, jobLog) and performs the GHL API action.
 *
 * @type {Record<string, (userId: string, data: Record<string, any>, jobLog: import('pino').Logger) => Promise<Object>>}
 */
const EVENT_HANDLERS = {
  /**
   * wizard.started: Upsert contact with email + name, add tag "wizard-started"
   */
  'wizard.started': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);
    jobLog.info({ email: profile.email }, 'GHL: Upserting contact for wizard.started');

    const { contactId, isNew } = await upsertContact(userId, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      tags: ['wizard-started'],
    });

    // Cache the GHL contact ID on the profile
    if (contactId && !profile.ghlContactId) {
      await storeContactId(userId, contactId);
    }

    return { action: 'upsert_and_tag', contactId, isNew, tag: 'wizard-started' };
  },

  /**
   * brand.completed: Update custom fields (brand_name, brand_status, logo_url), add tag "brand-completed"
   */
  'brand.completed': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);
    jobLog.info({ email: profile.email }, 'GHL: Updating contact for brand.completed');

    const { contactId } = await upsertContact(userId, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      tags: ['brand-completed'],
      customFields: {
        brand_name: data.brandName || '',
        brand_status: 'completed',
        logo_url: data.logoUrl || '',
        social_handle: data.socialHandle || '',
      },
    });

    if (contactId && !profile.ghlContactId) {
      await storeContactId(userId, contactId);
    }

    return { action: 'upsert_fields_and_tag', contactId, tag: 'brand-completed' };
  },

  /**
   * wizard.abandoned: Add tag "abandoned-step-{stepName}" (only the step name, no other data)
   */
  'wizard.abandoned': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);
    const stepName = data.lastStep || 'unknown';
    const tag = `abandoned-step-${stepName}`;
    jobLog.info({ email: profile.email, stepName }, 'GHL: Adding abandoned tag');

    const { contactId } = await upsertContact(userId, {
      email: profile.email,
      tags: [tag],
    });

    if (contactId && !profile.ghlContactId) {
      await storeContactId(userId, contactId);
    }

    return { action: 'tag', contactId, tag };
  },

  /**
   * subscription.created: Add tags "subscriber", "tier-{tierName}"
   */
  'subscription.created': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);
    const tierName = data.tier || data.tierName || 'unknown';
    const tags = ['subscriber', `tier-${tierName}`];
    jobLog.info({ email: profile.email, tierName }, 'GHL: Adding subscription tags');

    const { contactId } = await upsertContact(userId, {
      email: profile.email,
      tags,
    });

    if (contactId && !profile.ghlContactId) {
      await storeContactId(userId, contactId);
    }

    return { action: 'tag', contactId, tags };
  },

  /**
   * logo.generated: Update logo_url custom field
   */
  'logo.generated': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);

    if (!profile.ghlContactId) {
      jobLog.warn('No GHL contact ID found for logo.generated, upserting first');
      const { contactId } = await upsertContact(userId, {
        email: profile.email,
        customFields: {
          logo_url: data.logoUrl || '',
        },
      });
      if (contactId) await storeContactId(userId, contactId);
      return { action: 'upsert_and_update_field', contactId, field: 'logo_url' };
    }

    await updateCustomFields(profile.ghlContactId, {
      logo_url: data.logoUrl || '',
    });

    return { action: 'update_field', contactId: profile.ghlContactId, field: 'logo_url' };
  },

  /**
   * mockup.generated: Update brand_status to "mockups-ready"
   */
  'mockup.generated': async (userId, data, jobLog) => {
    const profile = await resolveUserProfile(userId);

    if (!profile.ghlContactId) {
      jobLog.warn('No GHL contact ID found for mockup.generated, upserting first');
      const { contactId } = await upsertContact(userId, {
        email: profile.email,
        customFields: {
          brand_status: 'mockups-ready',
        },
      });
      if (contactId) await storeContactId(userId, contactId);
      return { action: 'upsert_and_update_field', contactId, field: 'brand_status' };
    }

    await updateCustomFields(profile.ghlContactId, {
      brand_status: 'mockups-ready',
    });

    return { action: 'update_field', contactId: profile.ghlContactId, field: 'brand_status' };
  },
};

// ── Worker ────────────────────────────────────────────────────────

/**
 * CRM Sync worker -- syncs user/brand events to GoHighLevel.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initCRMSyncWorker(io) {
  const queueConfig = QUEUE_CONFIGS['crm-sync'];

  const worker = new Worker(
    'crm-sync',
    async (job) => {
      const { userId, eventType, data = {} } = job.data;
      const jobLog = createJobLogger(job, 'crm-sync');

      jobLog.info({ eventType }, 'CRM sync started');

      const handler = EVENT_HANDLERS[eventType];
      if (!handler) {
        jobLog.warn({ eventType }, 'Unknown CRM event type, skipping');
        return { synced: false, reason: `Unknown event type: ${eventType}` };
      }

      try {
        const result = await handler(userId, data, jobLog);

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

        // Sentry alert on final attempt (3 retries)
        if (job.attemptsMade + 1 >= 3) {
          Sentry.captureException(error, {
            tags: {
              integration: 'ghl',
              eventType,
              queue: 'crm-sync',
            },
            extra: {
              userId,
              attempts: job.attemptsMade + 1,
              data,
            },
          });
        }

        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
      limiter: {
        max: 10,        // Max 10 jobs per second (GHL rate limit)
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'CRM sync worker: job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'CRM sync worker: error');
  });

  return worker;
}
