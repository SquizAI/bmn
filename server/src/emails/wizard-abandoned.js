// server/src/emails/wizard-abandoned.js

/**
 * Wizard abandonment email -- sent 24h after last wizard activity.
 * Includes an HMAC-signed resume URL.
 *
 * @module emails/wizard-abandoned
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the wizard abandonment email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {string} params.resumeUrl - HMAC-signed resume URL (24h expiry)
 * @param {string} params.lastStep - Human-readable name of last completed step
 * @param {number} params.progressPercent - Wizard completion percentage (0-100)
 * @returns {{ subject: string, html: string }}
 */
export function buildWizardAbandonedEmail({ userName, resumeUrl, lastStep, progressPercent }) {
  const safeName = escapeHtml(userName || 'there');
  const safeUrl = escapeHtml(resumeUrl || 'https://app.brandmenow.com/wizard');
  const safeStep = escapeHtml(lastStep || 'your last step');
  const pct = Math.max(0, Math.min(100, Number(progressPercent) || 0));

  const body = `
    ${heading('Your brand is waiting')}
    ${paragraph(`Hi ${safeName}, you were making great progress on your brand! You completed <strong>${safeStep}</strong> and you're already <strong>${pct}%</strong> of the way there.`)}

    <!-- Progress bar -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 8px;">
      <tr>
        <td style="background-color: ${COLORS.border}; border-radius: 4px; height: 8px; padding: 0;">
          <div style="background-color: ${COLORS.primary}; border-radius: 4px; height: 8px; width: ${pct}%;"></div>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: ${COLORS.primary}; font-weight: 600; text-align: center; margin: 0 0 16px;">${pct}% complete</p>

    ${paragraph(`Your progress is saved. Click below to resume right where you left off:`)}
    ${primaryButton('Resume My Brand', safeUrl)}

    <p style="font-size: 13px; color: ${COLORS.muted}; text-align: center; margin: 0 0 16px;">
      This link expires in 24 hours. After that, you can still log in to resume your brand from the dashboard.
    </p>

    ${hr()}
    ${paragraph(`If you need help, reply to this email or use the chat widget in the app.`)}
  `;

  return {
    subject: 'Your brand is waiting for you',
    html: wrapInLayout({
      previewText: `Your brand is ${pct}% complete -- pick up where you left off`,
      body,
    }),
  };
}
