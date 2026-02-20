// server/src/services/email.js

/**
 * Resend Email Service
 *
 * Thin wrapper around the Resend SDK for sending transactional emails.
 * Includes HTML sanitization for user-provided data to prevent XSS.
 */

import { config } from '../config/index.js';
import { logger as rootLogger } from '../lib/logger.js';

const logger = rootLogger.child({ service: 'email' });

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
 * HTML-escape a string to prevent XSS in email clients.
 * Strips all HTML tags and escapes special characters.
 *
 * @param {string} text - Untrusted user input
 * @returns {string} Sanitized text safe for HTML embedding
 */
export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send an email via Resend API.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - Rendered HTML email body
 * @param {string} [params.replyTo] - Reply-to email address
 * @param {string} [params.from] - Override default from address
 * @param {string} [params.tag] - Resend tag for analytics
 * @returns {Promise<{ id: string }>} Resend message ID
 */
export async function sendEmail({ to, subject, html, replyTo, from, tag }) {
  const resend = await getResendClient();

  const fromAddress = from || config.FROM_EMAIL || 'Brand Me Now <hello@brandmenow.com>';
  const replyToAddress = replyTo || config.SUPPORT_EMAIL || 'support@brandmenow.com';

  logger.info({ to, subject, tag }, 'Sending email via Resend');

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
    reply_to: replyToAddress,
    tags: tag ? [{ name: 'category', value: tag }] : undefined,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ messageId: data?.id, to, subject }, 'Email sent successfully');
  return { id: data?.id };
}

export default {
  sendEmail,
  escapeHtml,
};
