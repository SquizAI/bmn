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

// ---------------------------------------------------------------------------
// STUB: Resend API -- replace with real implementation
// ---------------------------------------------------------------------------

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
 * Send an email via Resend API.
 * STUB: Logs the send and returns a simulated response.
 *
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.template
 * @param {Object} params.data
 * @returns {Promise<{id: string, status: string}>}
 */
async function sendEmail({ to, subject, template, data }) {
  // TODO: Replace with real Resend API call
  // const { Resend } = await import('resend');
  // const resend = new Resend(config.RESEND_API_KEY);
  // const { data: result, error } = await resend.emails.send({
  //   from: config.FROM_EMAIL,
  //   to,
  //   subject,
  //   react: renderTemplate(template, data),
  // });
  // if (error) throw new Error(`Resend error: ${error.message}`);
  // return result;

  logger.debug({ to, subject, template }, 'STUB: Resend email send');
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id: `stub-email-${Date.now()}`, status: 'sent' };
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
