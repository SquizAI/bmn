// server/src/config/ghl-fields.js

/**
 * GoHighLevel CRM custom field mappings.
 *
 * Field IDs are loaded from environment variables.
 * These map logical field names (used in code) to GHL custom field IDs
 * (which vary per GHL location). Environment variables take precedence.
 *
 * To add a new field:
 *   1. Create the custom field in GHL
 *   2. Copy the field ID
 *   3. Add the mapping here with a corresponding env var
 *   4. Restart the server -- startup validation confirms it exists
 */

/** @type {Record<string, string>} */
export const GHL_FIELD_MAP = {
  brand_vision: process.env.GHL_FIELD_BRAND_VISION || 'brand_vision',
  brand_name: process.env.GHL_FIELD_BRAND_NAME || 'brand_name',
  brand_status: process.env.GHL_FIELD_BRAND_STATUS || 'brand_status',
  logo_url: process.env.GHL_FIELD_LOGO_URL || 'logo_url',
  social_handle: process.env.GHL_FIELD_SOCIAL_HANDLE || 'social_handle',
  wizard_step: process.env.GHL_FIELD_WIZARD_STEP || 'wizard_step',
};

/**
 * BLOCKED fields -- never send these to CRM.
 * This is a hard security boundary enforced at the GHL client level.
 * Even if a caller accidentally includes a password, it will never reach GHL.
 *
 * @type {Set<string>}
 */
export const BLOCKED_FIELDS = new Set([
  'password',
  'password_hash',
  'credit_card',
  'ssn',
  'stripe_customer_id',
  'supabase_token',
  'api_key',
]);

/**
 * GHL API configuration constants.
 */
export const GHL_API_CONFIG = {
  baseUrl: 'https://services.leadconnectorhq.com',
  tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
  apiVersion: '2021-07-28',
  timeoutMs: 30_000,
};

/**
 * Tag constants used across CRM sync events.
 */
export const GHL_TAGS = {
  wizardStarted: 'wizard-started',
  brandCompleted: 'brand-completed',
  abandoned: 'abandoned',
  subscriber: 'subscriber',
  tierPrefix: 'tier-',
};

/**
 * Retry configuration for GHL API calls.
 */
export const GHL_RETRY = {
  maxAttempts: 3,
  backoffMs: [1_000, 5_000, 15_000],
  deadLetterQueue: 'crm-sync-dlq',
};
