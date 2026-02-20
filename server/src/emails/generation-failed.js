// server/src/emails/generation-failed.js

/**
 * Generation failed email -- sent when an AI generation job fails after retries,
 * or when a payment fails and the user needs to take action.
 *
 * @module emails/generation-failed
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph } from './layout.js';

/**
 * Build the generation failed email.
 *
 * @param {Object} params
 * @param {string} [params.type] - Failure type (e.g. "logo_generation", "mockup_generation", "payment_failed")
 * @param {string} [params.message] - Human-readable failure message
 * @param {string} [params.invoiceUrl] - Stripe hosted invoice URL (for payment failures)
 * @returns {{ subject: string, html: string }}
 */
export function buildGenerationFailedEmail({ type, message, invoiceUrl } = {}) {
  const safeType = escapeHtml(type || 'generation');
  const safeMessage = escapeHtml(
    message || 'One of your AI generation tasks could not be completed after multiple attempts.'
  );

  const isPaymentFailure = safeType === 'payment_failed';

  const subject = isPaymentFailure
    ? 'Action required: payment failed'
    : 'Your generation encountered an issue';

  const previewText = isPaymentFailure
    ? 'Your payment could not be processed. Please update your payment method.'
    : 'An AI generation task could not be completed. No credits were charged.';

  const ctaButton = isPaymentFailure && invoiceUrl
    ? primaryButton('Update Payment Method', escapeHtml(invoiceUrl))
    : primaryButton('Try Again', 'https://app.brandmenow.com/dashboard');

  const body = `
    ${heading(isPaymentFailure ? 'Payment Failed' : 'Generation Issue')}
    ${paragraph(safeMessage)}
    ${!isPaymentFailure ? paragraph(`Don't worry &mdash; no credits were charged for the failed attempt. You can try again from your dashboard.`) : ''}
    ${ctaButton}
    ${paragraph(`If this keeps happening, please reach out to our support team by replying to this email.`)}
  `;

  return {
    subject,
    html: wrapInLayout({ previewText, body }),
  };
}
