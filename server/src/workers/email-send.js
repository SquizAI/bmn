// server/src/workers/email-send.js

/**
 * Email Send Worker -- sends transactional email via Resend.
 *
 * Features:
 * - Template-based rendering via the template registry
 * - User email lookup from Supabase profiles
 * - Per-user rate limiting (5 emails/min via Redis)
 * - Retry 3 times with exponential backoff
 * - Dead-letter queue with Sentry alert on final failure
 * - HTML sanitization of all user-provided data
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { sendEmail, escapeHtml } from '../services/email.js';
import { getTemplate } from '../emails/index.js';

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

// ── Rate Limiting ─────────────────────────────────────────────────

/**
 * Check if sending this email would exceed the per-user rate limit.
 * Limit: 5 emails per minute per user.
 *
 * @param {string} userId - User ID for rate limiting
 * @returns {Promise<boolean>} True if within limit, false if rate limited
 */
async function checkRateLimit(userId) {
  if (!userId) return true;

  try {
    const key = `email:rate:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 60); // 60-second window
    }

    if (count > 5) {
      logger.warn({ userId, count }, 'Email rate limit exceeded');
      return false;
    }

    return true;
  } catch (err) {
    // If Redis is down, allow the email through
    logger.warn({ err }, 'Rate limit check failed, allowing email');
    return true;
  }
}

// ── Profile Lookup ────────────────────────────────────────────────

/**
 * Look up a user's email from the profiles table.
 *
 * @param {string} userId
 * @returns {Promise<string | null>}
 */
async function lookupUserEmail(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !data?.email) {
    logger.warn({ userId, error }, 'Failed to look up user email');
    return null;
  }

  return data.email;
}

// ── Data Sanitization ─────────────────────────────────────────────

/**
 * Sanitize all string values in a data object to prevent XSS.
 *
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function sanitizeTemplateData(data) {
  if (!data || typeof data !== 'object') return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = escapeHtml(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ── Worker ────────────────────────────────────────────────────────

/**
 * Email Send worker -- sends transactional email via Resend.
 *
 * @param {import('socket.io').Server} _io - Not used for email, kept for consistent interface
 * @returns {Worker}
 */
export function initEmailSendWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['email-send'];

  const worker = new Worker(
    'email-send',
    async (job) => {
      const { to, template: templateId, data = {}, userId } = job.data;
      const jobLog = createJobLogger(job, 'email-send');

      jobLog.info({ to, templateId, userId }, 'Email send started');

      // Step 1: Resolve recipient email
      let recipientEmail = to;
      if (!recipientEmail && userId) {
        recipientEmail = await lookupUserEmail(userId);
        if (!recipientEmail) {
          throw new Error(`No email address found for userId: ${userId}`);
        }
      }
      if (!recipientEmail) {
        throw new Error('No recipient email address provided');
      }

      // Step 2: Look up template
      const templateEntry = getTemplate(templateId);
      if (!templateEntry) {
        jobLog.warn({ templateId }, 'Unknown email template, using fallback');
        // Fallback: send a simple notification
        const result = await sendEmail({
          to: recipientEmail,
          subject: data.subject || 'Brand Me Now notification',
          html: `<p>${escapeHtml(JSON.stringify(data))}</p>`,
        });
        return { sent: true, emailId: result.id, to: recipientEmail, templateId };
      }

      // Step 3: Rate limit check
      const rateLimitUser = userId || recipientEmail;
      const withinLimit = await checkRateLimit(rateLimitUser);
      if (!withinLimit) {
        jobLog.warn({ userId: rateLimitUser, templateId }, 'Email skipped due to rate limit');
        return { sent: false, skipped: true, reason: 'rate_limited', to: recipientEmail, templateId };
      }

      // Step 4: Sanitize template data
      const sanitizedData = sanitizeTemplateData(data);

      // Step 5: Build the email from the template
      const { subject, html } = templateEntry.build(sanitizedData);

      // Step 6: Determine final recipient (support emails go to support inbox)
      const finalRecipient = templateEntry.overrideTo || recipientEmail;

      // Step 7: Determine reply-to
      const replyTo = typeof templateEntry.replyTo === 'function'
        ? templateEntry.replyTo(data) // Use unsanitized data for email address
        : undefined;

      // Step 8: Send via Resend
      try {
        const result = await sendEmail({
          to: finalRecipient,
          subject,
          html,
          replyTo,
          tag: templateEntry.tag,
        });

        jobLog.info(
          { to: finalRecipient, templateId, emailId: result.id },
          'Email sent successfully'
        );

        return {
          sent: true,
          emailId: result.id,
          to: finalRecipient,
          templateId,
        };
      } catch (error) {
        jobLog.error({ err: error, to: finalRecipient, templateId }, 'Email send failed');

        // Sentry alert on final attempt (3 retries)
        if (job.attemptsMade + 1 >= 3) {
          Sentry.captureException(error, {
            tags: {
              integration: 'resend',
              template: templateId,
              queue: 'email-send',
            },
            extra: {
              to: finalRecipient,
              attempts: job.attemptsMade + 1,
            },
          });
        }

        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Email send worker: job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Email send worker: error');
  });

  return worker;
}
