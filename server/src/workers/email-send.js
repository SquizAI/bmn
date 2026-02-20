// server/src/workers/email-send.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

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

/**
 * Template subject line mapping.
 * @type {Record<string, string>}
 */
const TEMPLATE_SUBJECTS = {
  'welcome': 'Welcome to Brand Me Now!',
  'brand-complete': 'Your brand is ready!',
  'wizard-abandoned': 'Your brand is waiting for you',
  'password-reset': 'Reset your password',
  'subscription-confirmed': 'Subscription confirmed',
  'subscription-cancelled': 'Subscription cancelled',
  'generation-failed': 'Generation issue -- we are on it',
  'support-ticket': 'Support ticket received',
};

/**
 * Lazily loaded Resend client singleton.
 * @type {import('resend').Resend | null}
 */
let _resend = null;

/**
 * Get the Resend client (lazy singleton).
 * @returns {Promise<import('resend').Resend>}
 */
async function getResendClient() {
  if (!_resend) {
    try {
      const { Resend } = await import('resend');
      _resend = new Resend(config.RESEND_API_KEY);
    } catch {
      throw new Error(
        'Resend SDK is not installed. Run: npm install resend'
      );
    }
  }
  return _resend;
}

/**
 * Render a simple HTML email body from template name and data.
 * In production, this should use React Email components.
 * For now, produces clean HTML with the template data interpolated.
 *
 * @param {string} template
 * @param {Object} data
 * @returns {string} HTML string
 */
function renderEmailHtml(template, data) {
  const name = data.name || data.brandName || 'there';
  const appUrl = config.APP_URL;

  const templates = {
    'welcome': `<h1>Welcome to Brand Me Now!</h1><p>Hi ${name}, your account is ready. <a href="${appUrl}/wizard">Start building your brand</a>.</p>`,
    'brand-complete': `<h1>Your brand is ready!</h1><p>Hi ${name}, your brand "${data.brandName || ''}" is complete. <a href="${appUrl}/dashboard">View your brand</a>.</p>`,
    'wizard-abandoned': `<h1>Your brand is waiting</h1><p>Hi ${name}, you left off at step "${data.lastStep || ''}". <a href="${appUrl}/wizard/resume">Pick up where you left off</a>.</p>`,
    'password-reset': `<h1>Reset your password</h1><p>Click <a href="${data.resetUrl || '#'}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    'subscription-confirmed': `<h1>Subscription confirmed</h1><p>Hi ${name}, your ${data.tier || ''} plan is now active.</p>`,
    'subscription-cancelled': `<h1>Subscription cancelled</h1><p>Hi ${name}, your subscription has been cancelled. You can resubscribe any time.</p>`,
    'generation-failed': `<h1>Generation issue</h1><p>Hi ${name}, we encountered an issue generating your ${data.assetType || 'asset'}. Our team is looking into it.</p>`,
    'support-ticket': `<h1>Support ticket received</h1><p>Hi ${name}, we received your support request and will respond within 24 hours.</p>`,
  };

  const body = templates[template] || `<p>${JSON.stringify(data)}</p>`;
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">${body}<hr><p style="color:#888;font-size:12px;">Brand Me Now</p></body></html>`;
}

/**
 * Send an email via Resend API.
 *
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.template
 * @param {Object} params.data
 * @returns {Promise<{id: string}>}
 */
async function sendEmail({ to, subject, template, data }) {
  const resend = await getResendClient();
  const html = renderEmailHtml(template, data);

  const { data: result, error } = await resend.emails.send({
    from: config.FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return result;
}

/**
 * Email Send worker -- sends transactional email via Resend.
 *
 * @param {import('socket.io').Server} _io - Not used for email, but kept for consistent interface
 * @returns {Worker}
 */
export function initEmailSendWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['email-send'];

  const worker = new Worker(
    'email-send',
    async (job) => {
      const { to, template, data, userId } = job.data;
      const jobLog = createJobLogger(job, 'email-send');

      const subject = TEMPLATE_SUBJECTS[template] || 'Brand Me Now notification';

      jobLog.info({ to, template, subject }, 'Email send started');

      try {
        const result = await sendEmail({ to, subject, template, data });

        jobLog.info({ to, template, emailId: result.id }, 'Email sent successfully');

        return {
          sent: true,
          emailId: result.id,
          to,
          template,
        };
      } catch (error) {
        jobLog.error({ err: error, to, template }, 'Email send failed');
        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Email send worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Email send worker: error');
  });

  return worker;
}
