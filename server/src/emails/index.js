// server/src/emails/index.js

/**
 * Email template registry.
 *
 * Maps template IDs to their builder functions and metadata.
 * Each builder returns { subject, html } ready for sendEmail().
 */

import { buildWelcomeEmail } from './welcome.js';
import { buildBrandCompleteEmail } from './brand-complete.js';
import { buildWizardAbandonedEmail } from './wizard-abandoned.js';
import { buildSupportRequestEmail } from './support-request.js';
import { buildPaymentConfirmedEmail } from './payment-confirmed.js';
import { buildSubscriptionRenewalEmail } from './subscription-renewal.js';
import { buildCreditLowWarningEmail } from './credit-low-warning.js';

/**
 * @typedef {Object} TemplateEntry
 * @property {(data: Record<string, any>) => { subject: string, html: string }} build
 * @property {string} tag - Resend tag for analytics
 * @property {string} [overrideTo] - Override recipient (e.g. support inbox)
 * @property {(data: Record<string, any>) => string} [replyTo] - Dynamic reply-to
 */

/** @type {Record<string, TemplateEntry>} */
export const TEMPLATE_REGISTRY = {
  'welcome': {
    build: buildWelcomeEmail,
    tag: 'welcome',
  },
  'brand-complete': {
    build: buildBrandCompleteEmail,
    tag: 'brand-completion',
  },
  'wizard-abandoned': {
    build: buildWizardAbandonedEmail,
    tag: 'wizard-abandonment',
  },
  'support-request': {
    build: buildSupportRequestEmail,
    tag: 'support',
    overrideTo: 'support@brandmenow.com',
    replyTo: (data) => data.userEmail,
  },
  'payment-confirmed': {
    build: buildPaymentConfirmedEmail,
    tag: 'payment',
  },
  'subscription-renewal': {
    build: buildSubscriptionRenewalEmail,
    tag: 'renewal',
  },
  'credit-low-warning': {
    build: buildCreditLowWarningEmail,
    tag: 'credit-warning',
  },
};

/**
 * Get a template entry by ID.
 *
 * @param {string} templateId
 * @returns {TemplateEntry | undefined}
 */
export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY[templateId];
}

/**
 * List all available template IDs.
 *
 * @returns {string[]}
 */
export function listTemplateIds() {
  return Object.keys(TEMPLATE_REGISTRY);
}
