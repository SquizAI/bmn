// server/src/emails/welcome.js

/**
 * Welcome email -- sent after user signup.
 *
 * @module emails/welcome
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph } from './layout.js';

/**
 * Build the welcome email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {string} params.loginUrl - URL to the app login/wizard page
 * @returns {{ subject: string, html: string }}
 */
export function buildWelcomeEmail({ userName, loginUrl }) {
  const safeName = escapeHtml(userName || 'there');
  const safeUrl = escapeHtml(loginUrl || 'https://app.brandmenow.com/wizard');

  const body = `
    ${heading(`Welcome, ${safeName}!`)}
    ${paragraph(`You're one step closer to turning your social media presence into a complete, sellable brand. Our AI-powered wizard will guide you through the entire process &mdash; from social analysis to logo generation to product mockups.`)}
    ${primaryButton('Start Building Your Brand', safeUrl)}
    ${paragraph(`Here's what you'll get:`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
      <tr><td style="font-size: 15px; line-height: 24px; color: #4a4a68; padding: 4px 0 4px 8px;">&bull; AI-analyzed brand identity from your social profiles</td></tr>
      <tr><td style="font-size: 15px; line-height: 24px; color: #4a4a68; padding: 4px 0 4px 8px;">&bull; Custom logo designs generated in seconds</td></tr>
      <tr><td style="font-size: 15px; line-height: 24px; color: #4a4a68; padding: 4px 0 4px 8px;">&bull; Product mockups with your branding applied</td></tr>
      <tr><td style="font-size: 15px; line-height: 24px; color: #4a4a68; padding: 4px 0 4px 8px;">&bull; Revenue projections for your branded products</td></tr>
    </table>
    ${paragraph(`If you have any questions, just reply to this email. We're here to help!`)}
  `;

  return {
    subject: 'Welcome to Brand Me Now!',
    html: wrapInLayout({
      previewText: `Welcome to Brand Me Now, ${safeName}! Let's build your brand.`,
      body,
    }),
  };
}
