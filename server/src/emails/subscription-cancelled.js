// server/src/emails/subscription-cancelled.js

/**
 * Subscription cancelled email -- sent when a subscription is cancelled.
 *
 * @module emails/subscription-cancelled
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph, secondaryButton } from './layout.js';

/**
 * Build the subscription cancelled email.
 *
 * @param {Object} params
 * @param {string} [params.userId] - User ID (for internal reference)
 * @returns {{ subject: string, html: string }}
 */
export function buildSubscriptionCancelledEmail({ userId } = {}) {
  const body = `
    ${heading('Subscription Cancelled')}
    ${paragraph(`Your subscription has been cancelled and your account has been moved to the free plan.`)}
    ${paragraph(`You'll still have access to your existing brands and assets, but AI generation credits have been reset to the free-tier allocation.`)}
    ${paragraph(`If this was a mistake, or if you'd like to re-subscribe at any time, you can do so from your dashboard.`)}
    ${primaryButton('Resubscribe', 'https://app.brandmenow.com/settings/billing')}
    ${paragraph(`We'd love to hear your feedback. If there's anything we can improve, just reply to this email.`)}
  `;

  return {
    subject: 'Your Brand Me Now subscription has been cancelled',
    html: wrapInLayout({
      previewText: 'Your subscription has been cancelled. You can resubscribe anytime.',
      body,
    }),
  };
}
