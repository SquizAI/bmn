// server/src/emails/subscription-renewal.js

/**
 * Subscription renewal reminder email -- sent 7 days before renewal.
 *
 * @module emails/subscription-renewal
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, secondaryButton, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the subscription renewal reminder email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {string} params.tierName - Current subscription tier
 * @param {string} params.amount - Renewal amount formatted (e.g. "$79.00")
 * @param {string} params.renewalDate - Formatted date (e.g. "March 19, 2026")
 * @param {string} params.manageUrl - URL to subscription management page
 * @returns {{ subject: string, html: string }}
 */
export function buildSubscriptionRenewalEmail({ userName, tierName, amount, renewalDate, manageUrl }) {
  const safeName = escapeHtml(userName || 'there');
  const safeTier = escapeHtml(tierName || 'your');
  const safeAmount = escapeHtml(amount || '$0.00');
  const safeDate = escapeHtml(renewalDate || 'soon');
  const safeManageUrl = escapeHtml(manageUrl || 'https://app.brandmenow.com/settings/subscription');

  const body = `
    ${heading('Renewal Reminder')}
    ${paragraph(`Hi ${safeName}, your <strong>${safeTier}</strong> plan will renew on <strong>${safeDate}</strong> for <strong>${safeAmount}</strong>.`)}
    ${paragraph(`No action needed if you'd like to continue. Your credits will refresh automatically on the renewal date.`)}
    ${secondaryButton('Manage Subscription', safeManageUrl)}
    ${hr()}
    <p style="font-size: 13px; color: ${COLORS.muted}; text-align: center; margin: 0;">
      To cancel or change your plan, visit
      <a href="${safeManageUrl}" style="color: ${COLORS.primary}; text-decoration: underline;">subscription settings</a> before ${safeDate}.
    </p>
  `;

  return {
    subject: `Your ${safeTier} plan renews on ${safeDate}`,
    html: wrapInLayout({
      previewText: `Your ${safeTier} plan renews on ${safeDate} for ${safeAmount}`,
      body,
    }),
  };
}
