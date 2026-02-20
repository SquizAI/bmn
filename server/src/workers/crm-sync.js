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

// ── GoHighLevel (GHL) OAuth 2.0 API client ──────────────────────────────

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

/**
 * Get a valid GHL access token from the database.
 * Tokens are managed via OAuth 2.0 and refreshed automatically.
 *
 * @returns {Promise<{accessToken: string, locationId: string}>}
 */
async function getGHLCredentials() {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('access_token, refresh_token, location_id, expires_at')
    .eq('provider', 'gohighlevel')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error('GoHighLevel integration not configured or inactive');
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    // Token expired -- refresh it
    const refreshed = await refreshGHLToken(data.refresh_token);
    return { accessToken: refreshed.accessToken, locationId: data.location_id };
  }

  return { accessToken: data.access_token, locationId: data.location_id };
}

/**
 * Refresh an expired GHL OAuth token.
 * @param {string} refreshToken
 * @returns {Promise<{accessToken: string}>}
 */
async function refreshGHLToken(refreshToken) {
  const response = await fetch(`${GHL_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GHL_CLIENT_ID || '',
      client_secret: process.env.GHL_CLIENT_SECRET || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`GHL token refresh failed: ${response.status} -- ${await response.text()}`);
  }

  const tokenData = await response.json();

  // Persist the new tokens
  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    })
    .eq('provider', 'gohighlevel');

  return { accessToken: tokenData.access_token };
}

/**
 * Make an authenticated request to the GHL API.
 *
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/contacts/')
 * @param {Object} [body] - Request body
 * @returns {Promise<Object>} Response JSON
 */
async function ghlRequest(method, path, body) {
  const { accessToken, locationId } = await getGHLCredentials();

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };

  const url = `${GHL_API_BASE}${path}`;
  const options = { method, headers };
  if (body) {
    // Inject locationId into all request bodies
    options.body = JSON.stringify({ ...body, locationId });
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL API ${method} ${path} failed: ${response.status} -- ${text}`);
  }

  return response.json();
}

/**
 * Find a GHL contact by email, or return null.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findGHLContact(email) {
  try {
    const result = await ghlRequest('GET', `/contacts/lookup?email=${encodeURIComponent(email)}`);
    return result.contacts?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Look up the user's GHL contact ID from our database.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getGHLContactId(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('ghl_contact_id')
    .eq('id', userId)
    .single();
  return data?.ghl_contact_id || null;
}

/**
 * Map of event types to their GHL action handlers.
 * Each handler receives the event data and a jobLog and performs the GHL API action.
 */
const GHL_EVENT_HANDLERS = {
  'user.created': async (data, jobLog) => {
    jobLog.info({ email: data.email }, 'GHL: Creating contact');
    const result = await ghlRequest('POST', '/contacts/', {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email,
      phone: data.phone || '',
      tags: ['bmn_user'],
      source: 'Brand Me Now',
    });
    const ghlContactId = result.contact?.id;

    // Store the GHL contact ID on the user profile
    if (ghlContactId && data.userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ ghl_contact_id: ghlContactId })
        .eq('id', data.userId);
    }

    return { action: 'create_contact', ghlContactId };
  },

  'wizard.started': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) {
      jobLog.warn('No GHL contact ID found, skipping tag');
      return { action: 'add_tag', skipped: true };
    }
    jobLog.info({ contactId }, 'GHL: Adding wizard_started tag');
    await ghlRequest('POST', `/contacts/${contactId}/tags`, {
      tags: ['wizard_started'],
    });
    return { action: 'add_tag', tag: 'wizard_started' };
  },

  'wizard.step-completed': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) return { action: 'update_field', skipped: true };
    jobLog.info({ contactId, step: data.step }, 'GHL: Updating wizard step');
    await ghlRequest('PUT', `/contacts/${contactId}`, {
      customFields: [{ key: 'wizard_step', value: data.step }],
    });
    return { action: 'update_field', field: 'wizard_step', value: data.step };
  },

  'wizard.abandoned': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) return { action: 'add_tag', skipped: true };
    jobLog.info({ contactId, lastStep: data.lastStep }, 'GHL: Adding wizard_abandoned tag');
    await ghlRequest('POST', `/contacts/${contactId}/tags`, {
      tags: ['wizard_abandoned'],
    });
    return { action: 'add_tag', tag: 'wizard_abandoned' };
  },

  'brand.completed': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) return { action: 'add_tag', skipped: true };
    jobLog.info({ contactId }, 'GHL: Adding brand_complete tag');
    await ghlRequest('POST', `/contacts/${contactId}/tags`, {
      tags: ['brand_complete'],
    });
    return { action: 'add_tag', tag: 'brand_complete' };
  },

  'subscription.created': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) return { action: 'update_subscription', skipped: true };
    jobLog.info({ contactId, tier: data.tier }, 'GHL: Updating subscription');
    await ghlRequest('PUT', `/contacts/${contactId}`, {
      customFields: [
        { key: 'subscription_tier', value: data.tier },
        { key: 'subscription_status', value: 'active' },
      ],
    });
    await ghlRequest('POST', `/contacts/${contactId}/tags`, {
      tags: [`plan_${data.tier}`, 'paying_customer'],
    });
    return { action: 'update_subscription', tier: data.tier };
  },

  'subscription.cancelled': async (data, jobLog) => {
    const contactId = await getGHLContactId(data.userId);
    if (!contactId) return { action: 'add_tag', skipped: true };
    jobLog.info({ contactId }, 'GHL: Adding subscription_cancelled tag');
    await ghlRequest('PUT', `/contacts/${contactId}`, {
      customFields: [{ key: 'subscription_status', value: 'cancelled' }],
    });
    await ghlRequest('POST', `/contacts/${contactId}/tags`, {
      tags: ['subscription_cancelled'],
    });
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
