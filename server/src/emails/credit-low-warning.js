// server/src/emails/credit-low-warning.js

/**
 * Credit low warning email -- sent when credits drop below 20%.
 *
 * @module emails/credit-low-warning
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the credit low warning email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {number} params.creditsRemaining - Number of credits left
 * @param {number} params.creditsTotal - Total credits for the tier
 * @param {string} params.upgradeUrl - URL to upgrade page
 * @returns {{ subject: string, html: string }}
 */
export function buildCreditLowWarningEmail({ userName, creditsRemaining, creditsTotal, upgradeUrl }) {
  const safeName = escapeHtml(userName || 'there');
  const remaining = Number(creditsRemaining) || 0;
  const total = Number(creditsTotal) || 1;
  const percentUsed = Math.round(((total - remaining) / total) * 100);
  const safeUpgradeUrl = escapeHtml(upgradeUrl || 'https://app.brandmenow.com/settings/subscription');

  const body = `
    <h1 style="font-size: 24px; font-weight: 700; color: ${COLORS.warning}; text-align: center; margin: 0 0 16px; line-height: 32px;">Credits Running Low</h1>

    ${paragraph(`Hi ${safeName}, you've used <strong>${percentUsed}%</strong> of your monthly credits.`)}

    <!-- Credit box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="text-align: center; margin: 0 0 24px; padding: 24px; background-color: ${COLORS.warningBg}; border-radius: 8px; border: 1px solid ${COLORS.warningBorder};">
      <tr>
        <td align="center">
          <p style="font-size: 48px; font-weight: 700; color: ${COLORS.warning}; margin: 0 0 4px; line-height: 56px;">${remaining}</p>
          <p style="font-size: 14px; color: ${COLORS.muted}; margin: 0;">credits remaining out of ${total}</p>
        </td>
      </tr>
    </table>

    ${paragraph(`When you run out, logo and mockup generation will be paused until your credits refresh on your next billing date &mdash; or you can upgrade for more capacity now.`)}
    ${primaryButton('Upgrade for More Credits', safeUpgradeUrl)}
    ${hr()}
    <p style="font-size: 13px; color: ${COLORS.muted}; text-align: center; margin: 0;">
      Credits refresh monthly on your billing date. Unused credits do not roll over.
    </p>
  `;

  return {
    subject: `Running low on credits (${remaining} remaining)`,
    html: wrapInLayout({
      previewText: `You have ${remaining} credits remaining out of ${total}`,
      body,
    }),
  };
}
