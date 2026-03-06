// server/src/workers/storefront-contact.js

/**
 * Storefront Contact Worker -- syncs contact form submissions to GoHighLevel CRM.
 *
 * When a visitor submits a contact form on a public storefront, this worker:
 * 1. Looks up the storefront to find the owner (user_id)
 * 2. Checks if the owner has GHL connected
 * 3. If connected: creates/updates contact in GHL, adds a note, tags with storefront slug
 * 4. If not connected: logs and skips
 * 5. Marks the storefront_contacts row as synced_to_crm = true
 *
 * Retry: 3 attempts with exponential backoff [3s, 6s, 12s].
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis, getBullRedisConfig } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import {
  upsertContact,
  addTag,
  getAccessToken,
} from '../services/ghl.js';

// ── GHL Note Helper ──────────────────────────────────────────────

/**
 * Add a note to a GHL contact.
 * GHL API: POST /contacts/{contactId}/notes
 *
 * @param {string} contactId - GHL contact ID
 * @param {string} body - Note body text
 * @param {import('pino').Logger} jobLog - Logger instance
 * @returns {Promise<void>}
 */
async function addContactNote(contactId, body, jobLog) {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify({ body }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      jobLog.warn(
        { contactId, status: response.status, error: errorText },
        'Failed to add GHL contact note (non-fatal)'
      );
    } else {
      jobLog.info({ contactId }, 'GHL contact note added');
    }
  } catch (err) {
    // Non-fatal: log but don't throw -- the contact was already created
    jobLog.warn({ err, contactId }, 'Failed to add GHL contact note (non-fatal)');
  }
}

// ── Worker ───────────────────────────────────────────────────────

/**
 * Storefront Contact worker -- syncs contact form submissions to GHL CRM.
 *
 * @param {import('socket.io').Server} _io - Socket.io server instance (unused -- no real-time emissions needed)
 * @returns {Worker}
 */
export function initStorefrontContactWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['storefront-contact'];

  const worker = new Worker(
    'storefront-contact',
    async (job) => {
      const { contactId, storefrontId, name, email, message } = job.data;
      const jobLog = createJobLogger(job, 'storefront-contact');

      jobLog.info({ contactId, storefrontId, email }, 'Storefront contact sync started');

      // Step 1: Look up the storefront to get the owner user_id and slug
      const { data: storefront, error: sfError } = await supabaseAdmin
        .from('storefronts')
        .select('id, user_id, slug')
        .eq('id', storefrontId)
        .single();

      if (sfError || !storefront) {
        jobLog.error({ err: sfError, storefrontId }, 'Storefront not found');
        throw new Error(`Storefront ${storefrontId} not found: ${sfError?.message || 'not found'}`);
      }

      const { user_id: ownerId, slug } = storefront;

      // Step 2: Check if the owner has GHL connected
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('ghl_contact_id, email, full_name')
        .eq('id', ownerId)
        .single();

      if (profileError || !profile) {
        jobLog.error({ err: profileError, ownerId }, 'Owner profile not found');
        throw new Error(`Owner profile ${ownerId} not found: ${profileError?.message || 'not found'}`);
      }

      // Check if GHL tokens exist in Redis (indicates GHL is connected)
      const ghlTokens = await redis.get('ghl:tokens');
      const ghlConnected = !!ghlTokens;

      /** @type {string|null} */
      let ghlContactId = null;

      if (ghlConnected) {
        // Step 3: GHL is connected -- create/update contact
        jobLog.info({ email, slug }, 'GHL connected -- syncing contact');

        try {
          // Parse name into first/last
          const nameParts = (name || 'Unknown').split(' ');
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Upsert contact in GHL with storefront-specific tag
          const result = await upsertContact(ownerId, {
            email,
            firstName,
            lastName,
            tags: [`storefront-${slug}`, 'storefront-lead'],
            customFields: {
              lead_source: `storefront-${slug}`,
            },
          });

          ghlContactId = result.contactId || null;

          // Add the message as a note
          if (ghlContactId && message) {
            const noteBody = [
              `Storefront Contact Form Submission`,
              `---`,
              `Storefront: ${slug}`,
              `Name: ${name}`,
              `Email: ${email}`,
              `Message: ${message}`,
              `Submitted: ${new Date().toISOString()}`,
            ].join('\n');

            await addContactNote(ghlContactId, noteBody, jobLog);
          }

          // Add the storefront slug as a tag
          if (ghlContactId) {
            await addTag(ghlContactId, `storefront-${slug}`).catch((tagErr) => {
              jobLog.warn({ err: tagErr }, 'Failed to add storefront tag (non-fatal)');
            });
          }

          jobLog.info({ ghlContactId, email }, 'GHL contact synced successfully');
        } catch (ghlError) {
          jobLog.error({ err: ghlError, email }, 'GHL sync failed');
          throw ghlError;
        }
      } else {
        // Step 4: GHL is NOT connected -- just log and skip
        jobLog.info({ ownerId, email }, 'GHL not connected for storefront owner -- skipping CRM sync');
      }

      // Step 5: Mark the contact row as synced
      if (contactId) {
        const { error: updateError } = await supabaseAdmin
          .from('storefront_contacts')
          .update({
            synced_to_crm: true,
            synced_at: new Date().toISOString(),
          })
          .eq('id', contactId);

        if (updateError) {
          jobLog.warn({ err: updateError, contactId }, 'Failed to mark contact as synced (non-fatal)');
        }
      }

      jobLog.info(
        { contactId, ghlContactId, ghlConnected },
        'Storefront contact sync complete'
      );

      return {
        synced: true,
        contactId,
        ghlContactId,
        ghlConnected,
        storefrontSlug: slug,
      };
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
      'Storefront contact worker: job failed'
    );
    if (job?.attemptsMade >= queueConfig.retry.attempts) {
      Sentry.captureException(err, {
        tags: { queue: 'storefront-contact' },
        extra: { jobData: job?.data },
      });
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Storefront contact worker: error');
  });

  return worker;
}
