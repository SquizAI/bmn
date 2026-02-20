// server/src/emails/layout.js

/**
 * Shared email layout for all Brand Me Now transactional emails.
 *
 * Uses HTML tables for email client compatibility.
 * Responsive design with max-width 600px.
 * Includes brand header and footer with unsubscribe link.
 */

import { escapeHtml } from '../services/email.js';

/**
 * Brand colors used across all templates.
 */
export const COLORS = {
  primary: '#6c5ce7',
  primaryLight: '#a29bfe',
  dark: '#1a1a2e',
  text: '#4a4a68',
  muted: '#8898aa',
  background: '#f6f9fc',
  white: '#ffffff',
  border: '#e6ebf1',
  warning: '#e67e22',
  warningBg: '#fff8f0',
  warningBorder: '#fdebd0',
  success: '#27ae60',
  danger: '#e74c3c',
};

/**
 * Wrap email body content in the standard Brand Me Now email layout.
 * Includes header with logo and footer with company info.
 *
 * @param {Object} params
 * @param {string} params.previewText - Preview text shown in email client
 * @param {string} params.body - Inner HTML content
 * @param {string} [params.unsubscribeUrl] - Unsubscribe URL
 * @returns {string} Complete HTML email
 */
export function wrapInLayout({ previewText, body, unsubscribeUrl }) {
  const safePreview = escapeHtml(previewText);
  const unsub = unsubscribeUrl || 'https://app.brandmenow.com/settings/notifications';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Brand Me Now</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 20px 16px !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${safePreview}
    ${'&nbsp;&zwnj;'.repeat(30)}
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Container -->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.white}; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <img src="https://brandmenow.com/logo.png" width="150" height="40" alt="Brand Me Now" style="display: block; margin: 0 auto;">
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding: 0 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid ${COLORS.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-size: 13px; line-height: 20px; color: ${COLORS.muted};">
                    <p style="margin: 0 0 8px;">Brand Me Now &mdash; Go from social media presence to branded product line in minutes.</p>
                    <p style="margin: 0 0 8px;">
                      <a href="https://brandmenow.com" style="color: ${COLORS.primary}; text-decoration: underline;">Website</a> &bull;
                      <a href="https://app.brandmenow.com/dashboard" style="color: ${COLORS.primary}; text-decoration: underline;">Dashboard</a> &bull;
                      <a href="mailto:support@brandmenow.com" style="color: ${COLORS.primary}; text-decoration: underline;">Support</a>
                    </p>
                    <p style="margin: 0;">
                      <a href="${escapeHtml(unsub)}" style="color: ${COLORS.muted}; text-decoration: underline;">Unsubscribe</a> or
                      <a href="https://app.brandmenow.com/settings/notifications" style="color: ${COLORS.muted}; text-decoration: underline;">manage email preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build a primary CTA button.
 *
 * @param {string} text - Button label
 * @param {string} href - Button URL
 * @returns {string} HTML for the button
 */
export function primaryButton(text, href) {
  const safeHref = escapeHtml(href);
  const safeText = escapeHtml(text);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
  <tr>
    <td align="center" style="background-color: ${COLORS.primary}; border-radius: 6px;">
      <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: ${COLORS.white}; text-decoration: none; border-radius: 6px;">${safeText}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Build a secondary/outline CTA button.
 *
 * @param {string} text - Button label
 * @param {string} href - Button URL
 * @returns {string} HTML for the button
 */
export function secondaryButton(text, href) {
  const safeHref = escapeHtml(href);
  const safeText = escapeHtml(text);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
  <tr>
    <td align="center" style="border: 2px solid ${COLORS.primary}; border-radius: 6px;">
      <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: ${COLORS.primary}; text-decoration: none; border-radius: 6px;">${safeText}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Build a heading element.
 *
 * @param {string} text
 * @param {string} [color]
 * @returns {string}
 */
export function heading(text, color = COLORS.dark) {
  return `<h1 style="font-size: 24px; font-weight: 700; color: ${color}; text-align: center; margin: 0 0 16px; line-height: 32px;">${escapeHtml(text)}</h1>`;
}

/**
 * Build a paragraph element.
 *
 * @param {string} html - Already-safe HTML content (use escapeHtml for user data)
 * @returns {string}
 */
export function paragraph(html) {
  return `<p style="font-size: 16px; line-height: 26px; color: ${COLORS.text}; margin: 0 0 16px;">${html}</p>`;
}

/**
 * Build a horizontal rule.
 * @returns {string}
 */
export function hr() {
  return `<hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 24px 0;">`;
}
