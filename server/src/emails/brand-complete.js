// server/src/emails/brand-complete.js

/**
 * Brand completion email -- sent when the wizard is fully completed.
 *
 * @module emails/brand-complete
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, primaryButton, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the brand completion email.
 *
 * @param {Object} params
 * @param {string} params.userName - User's first name
 * @param {string} params.brandName - The generated brand name
 * @param {string} [params.logoUrl] - Public CDN URL of the brand logo
 * @param {string} params.dashboardUrl - URL to the brand dashboard
 * @returns {{ subject: string, html: string }}
 */
export function buildBrandCompleteEmail({ userName, brandName, logoUrl, dashboardUrl }) {
  const safeName = escapeHtml(userName || 'there');
  const safeBrand = escapeHtml(brandName || 'Your Brand');
  const safeLogo = escapeHtml(logoUrl || '');
  const safeDashboard = escapeHtml(dashboardUrl || 'https://app.brandmenow.com/dashboard');

  const logoSection = safeLogo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
        <tr>
          <td align="center" style="padding: 24px; background-color: #f8f9fa; border-radius: 8px;">
            <img src="${safeLogo}" width="200" height="200" alt="${safeBrand} logo" style="display: block; margin: 0 auto; border-radius: 8px; max-width: 200px;">
          </td>
        </tr>
      </table>`
    : '';

  const body = `
    ${heading(`${safeBrand} is ready!`)}
    ${paragraph(`Congratulations, ${safeName}! Your brand has been created. Here's a summary of what we built together:`)}
    ${logoSection}
    ${paragraph(`Your brand assets &mdash; logos, mockups, and projections &mdash; are saved in your dashboard. You can download, share, and refine them any time.`)}
    ${primaryButton('View Your Brand Dashboard', safeDashboard)}
    ${hr()}
    ${paragraph(`Need to make changes? You can regenerate logos, add products, and update your brand identity from the dashboard.`)}
  `;

  return {
    subject: `Your brand ${safeBrand} is ready!`,
    html: wrapInLayout({
      previewText: `Congratulations! Your brand ${safeBrand} is complete.`,
      body,
    }),
  };
}
