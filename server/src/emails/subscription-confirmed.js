// server/src/emails/subscription-confirmed.js

/**
 * Subscription confirmed email -- sent when a new subscription is created.
 *
 * @module emails/subscription-confirmed
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph } from './layout.js';

/**
 * Build the subscription confirmed email.
 *
 * @param {Object} params
 * @param {string} params.tier - Subscription tier name (e.g. "pro", "enterprise")
 * @param {string} [params.tierDisplayName] - Human-readable tier name (e.g. "Pro Plan")
 * @param {number|string} [params.price] - Monthly price in dollars
 * @returns {{ subject: string, html: string }}
 */
export function buildSubscriptionConfirmedEmail({ tier, tierDisplayName, price }) {
  const safeTier = escapeHtml(tierDisplayName || tier || 'Premium');
  const safePrice = price != null ? escapeHtml(String(price)) : null;

  const priceLine = safePrice
    ? `Your ${safeTier} subscription is now active at <strong>$${safePrice}/mo</strong>.`
    : `Your ${safeTier} subscription is now active.`;

  const body = `
    ${heading('Subscription Confirmed!')}
    ${paragraph(priceLine)}
    ${paragraph(`You now have full access to all ${safeTier} features, including additional AI generation credits, priority processing, and more.`)}
    ${primaryButton('Go to Dashboard', 'https://app.brandmenow.com/dashboard')}
    ${paragraph(`If you have any questions about your subscription, just reply to this email. We're here to help!`)}
  `;

  return {
    subject: `Your ${safeTier} subscription is active!`,
    html: wrapInLayout({
      previewText: `Welcome to ${safeTier}! Your subscription is confirmed.`,
      body,
    }),
  };
}
