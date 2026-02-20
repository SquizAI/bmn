// server/src/emails/payment-confirmed.js

/**
 * Payment confirmation email -- sent after a successful Stripe payment.
 *
 * @module emails/payment-confirmed
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the payment confirmation email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {string} params.tierName - Subscription tier (e.g. "Pro")
 * @param {string} params.amount - Formatted amount (e.g. "$79.00")
 * @param {string} [params.receiptUrl] - Stripe receipt URL
 * @returns {{ subject: string, html: string }}
 */
export function buildPaymentConfirmedEmail({ userName, tierName, amount, receiptUrl }) {
  const safeName = escapeHtml(userName || 'there');
  const safeTier = escapeHtml(tierName || 'your');
  const safeAmount = escapeHtml(amount || '$0.00');
  const safeReceipt = escapeHtml(receiptUrl || '#');
  const dashboardUrl = 'https://app.brandmenow.com/dashboard';

  const body = `
    ${heading('Payment Confirmed')}
    ${paragraph(`Hi ${safeName}, your payment of <strong>${safeAmount}</strong> for the <strong>${safeTier}</strong> plan has been processed successfully.`)}

    <!-- Receipt box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 0 0 24px; border: 1px solid ${COLORS.border};">
      <tr><td style="font-size: 15px; color: ${COLORS.text}; line-height: 22px; padding: 4px 0;"><strong>Plan:</strong> ${safeTier}</td></tr>
      <tr><td style="font-size: 15px; color: ${COLORS.text}; line-height: 22px; padding: 4px 0;"><strong>Amount:</strong> ${safeAmount}</td></tr>
    </table>

    ${primaryButton('Go to Dashboard', dashboardUrl)}

    <p style="font-size: 13px; color: ${COLORS.muted}; text-align: center; margin: 0 0 16px;">
      <a href="${safeReceipt}" style="color: ${COLORS.primary}; text-decoration: underline;">View full receipt</a> |
      <a href="${dashboardUrl}/settings" style="color: ${COLORS.primary}; text-decoration: underline;">Manage subscription</a>
    </p>

    ${hr()}
    ${paragraph(`Questions about billing? Reply to this email.`)}
  `;

  return {
    subject: `Payment confirmed -- ${safeTier} plan`,
    html: wrapInLayout({
      previewText: `Payment confirmed: ${safeAmount} for ${safeTier} plan`,
      body,
    }),
  };
}
