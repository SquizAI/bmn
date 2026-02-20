// server/src/emails/support-request.js

/**
 * Support request email -- sent to support inbox when user
 * triggers "talk to human" in the chatbot.
 *
 * @module emails/support-request
 */

import { escapeHtml } from '../services/email.js';
import { wrapInLayout, heading, paragraph, COLORS, hr } from './layout.js';

/**
 * Build the support request email.
 *
 * @param {Object} params
 * @param {string} params.userEmail - User's email address
 * @param {string} params.subject - Support request subject
 * @param {string} params.message - User's message
 * @returns {{ subject: string, html: string }}
 */
export function buildSupportRequestEmail({ userEmail, subject, message }) {
  const safeEmail = escapeHtml(userEmail || 'unknown');
  const safeSubject = escapeHtml(subject || 'Help request');
  const safeMessage = escapeHtml(message || 'No message provided');

  const body = `
    <h1 style="font-size: 24px; font-weight: 700; color: ${COLORS.danger}; margin: 0 0 16px;">Support Request</h1>

    <!-- Meta info -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; margin: 0 0 16px;">
      <tr><td style="font-size: 14px; color: ${COLORS.text}; line-height: 22px; padding: 2px 0;"><strong>From:</strong> ${safeEmail}</td></tr>
      <tr><td style="font-size: 14px; color: ${COLORS.text}; line-height: 22px; padding: 2px 0;"><strong>Subject:</strong> ${safeSubject}</td></tr>
    </table>

    ${hr()}

    <p style="font-size: 12px; font-weight: 600; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Message</p>
    <div style="font-size: 15px; line-height: 24px; color: #2d3748; padding: 16px; background-color: #fffef5; border-radius: 6px; border-left: 4px solid #f6e05e; margin: 0 0 16px; white-space: pre-wrap;">${safeMessage}</div>

    ${hr()}
    ${paragraph(`Reply directly to this email to respond to the user at ${safeEmail}.`)}
  `;

  return {
    subject: `[Support] ${safeSubject}`,
    html: wrapInLayout({
      previewText: `Support request from ${safeEmail}: ${safeSubject}`,
      body,
    }),
  };
}
