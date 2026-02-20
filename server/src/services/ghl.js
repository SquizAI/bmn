// server/src/services/ghl.js

/**
 * GoHighLevel CRM Service
 *
 * OAuth 2.0 token management, contact upsert, tags, and custom fields.
 * All data is sanitized before sending -- blocked fields are stripped.
 * Tokens are stored in Redis with environment variable fallback.
 */

import { logger as rootLogger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import {
  GHL_FIELD_MAP,
  BLOCKED_FIELDS,
  GHL_API_CONFIG,
  GHL_TAGS,
} from '../config/ghl-fields.js';

const logger = rootLogger.child({ service: 'ghl' });

// ── Token State ───────────────────────────────────────────────────

/**
 * @typedef {Object} GHLTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAt - Unix timestamp (ms)
 */

/** @type {GHLTokens} */
let tokens = {
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
};

const REDIS_TOKEN_KEY = 'ghl:tokens';

// ── OAuth Token Management ────────────────────────────────────────

/**
 * Get a valid GHL access token.
 * Reads from Redis first, falls back to environment variables.
 * Auto-refreshes if expired or expiring within 5 minutes.
 *
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken() {
  // If we have a valid in-memory token, use it
  if (tokens.accessToken && tokens.expiresAt - Date.now() > 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  // Try Redis
  try {
    const stored = await redis.get(REDIS_TOKEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.accessToken && parsed.expiresAt - Date.now() > 5 * 60 * 1000) {
        tokens = parsed;
        logger.debug('GHL tokens loaded from Redis');
        return tokens.accessToken;
      }
      // Token in Redis but expired/expiring -- use the refresh token
      if (parsed.refreshToken) {
        tokens = parsed;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read GHL tokens from Redis');
  }

  // Try environment variable fallback
  if (!tokens.accessToken && process.env.GHL_ACCESS_TOKEN) {
    tokens = {
      accessToken: process.env.GHL_ACCESS_TOKEN,
      refreshToken: process.env.GHL_REFRESH_TOKEN || '',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Assume 24h if unknown
    };
    logger.info('GHL tokens loaded from environment variables');

    // Cache in Redis
    await storeTokens(tokens.accessToken, tokens.refreshToken, 86_400);
    return tokens.accessToken;
  }

  // Need to refresh
  if (tokens.refreshToken) {
    await refreshToken();
    return tokens.accessToken;
  }

  throw new Error('GHL: No access token available. Complete OAuth flow or set GHL_ACCESS_TOKEN.');
}

/**
 * Refresh the OAuth access token using the refresh token.
 * POST to GHL token endpoint with refresh_token grant.
 *
 * @returns {Promise<void>}
 */
export async function refreshToken() {
  if (!tokens.refreshToken) {
    throw new Error('GHL: No refresh token available. Re-authorize via OAuth.');
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GHL: GHL_CLIENT_ID and GHL_CLIENT_SECRET are required for token refresh.');
  }

  logger.info('Refreshing GHL access token');

  const response = await fetch(GHL_API_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
    signal: AbortSignal.timeout(GHL_API_CONFIG.timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`GHL token refresh failed: ${response.status} ${body}`);
    logger.error({ status: response.status, body }, 'GHL token refresh failed');
    throw err;
  }

  const data = await response.json();

  const expiresIn = data.expires_in || 86_400;
  await storeTokens(
    data.access_token,
    data.refresh_token || tokens.refreshToken,
    expiresIn
  );

  logger.info({ expiresIn }, 'GHL tokens refreshed successfully');
}

/**
 * Store tokens in memory and Redis.
 *
 * @param {string} accessToken
 * @param {string} refreshTokenValue
 * @param {number} expiresIn - Seconds until access token expires
 * @returns {Promise<void>}
 */
export async function storeTokens(accessToken, refreshTokenValue, expiresIn) {
  tokens = {
    accessToken,
    refreshToken: refreshTokenValue,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  try {
    await redis.set(
      REDIS_TOKEN_KEY,
      JSON.stringify(tokens),
      'EX',
      expiresIn + 3600 // Keep in Redis slightly longer than expiry
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to store GHL tokens in Redis');
  }
}

// ── API Request Helper ────────────────────────────────────────────

/**
 * Make an authenticated request to the GHL API.
 * Automatically handles token refresh on 401.
 *
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. "/contacts/upsert")
 * @param {Object} [body] - Request body
 * @param {number} [attempt=1] - Current retry attempt (for 401 handling)
 * @returns {Promise<Object>} Parsed JSON response
 */
async function ghlRequest(method, path, body = null, attempt = 1) {
  const accessToken = await getAccessToken();
  const locationId = process.env.GHL_LOCATION_ID;

  const url = `${GHL_API_CONFIG.baseUrl}${path}`;
  /** @type {RequestInit} */
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Version': GHL_API_CONFIG.apiVersion,
    },
    signal: AbortSignal.timeout(GHL_API_CONFIG.timeoutMs),
  };

  if (body) {
    // Inject locationId into POST/PUT bodies
    const payload = locationId ? { ...body, locationId } : body;
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);

  // Token expired -- refresh and retry once
  if (response.status === 401 && attempt === 1) {
    logger.info('GHL: 401 received, refreshing token and retrying');
    await refreshToken();
    return ghlRequest(method, path, body, 2);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GHL API ${method} ${path}: ${response.status} ${errorBody}`);
  }

  // Some GHL endpoints return 204 No Content
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {};
  }

  return response.json();
}

// ── Data Sanitization ─────────────────────────────────────────────

/**
 * Strip any blocked fields from data before sending to GHL.
 * This is a hard security boundary -- even if a caller accidentally
 * includes a password, it will never reach GHL.
 *
 * @param {Record<string, any>} data
 * @returns {Record<string, any>} Sanitized data
 */
export function sanitizeForCRM(data) {
  if (!data || typeof data !== 'object') return {};

  const clean = { ...data };
  for (const key of Object.keys(clean)) {
    if (BLOCKED_FIELDS.has(key)) {
      logger.warn({ field: key }, 'GHL: Blocked field stripped from CRM payload');
      delete clean[key];
    }
  }
  return clean;
}

// ── CRM Operations ───────────────────────────────────────────────

/**
 * Upsert a contact in GHL. Creates if not found by email, updates if exists.
 * SECURITY: Runs data through sanitizeForCRM before sending.
 *
 * @param {string} userId - Internal user ID (for logging, not sent to GHL)
 * @param {Object} data
 * @param {string} data.email - Contact email (upsert key)
 * @param {string} [data.firstName]
 * @param {string} [data.lastName]
 * @param {string} [data.phone]
 * @param {string[]} [data.tags] - Tags to apply
 * @param {Record<string, string>} [data.customFields] - Custom field key-value pairs
 * @returns {Promise<{ contactId: string, isNew: boolean }>}
 */
export async function upsertContact(userId, data) {
  const sanitized = sanitizeForCRM(data);

  /** @type {Record<string, any>} */
  const payload = {
    email: sanitized.email,
  };

  if (sanitized.firstName) payload.firstName = sanitized.firstName;
  if (sanitized.lastName) payload.lastName = sanitized.lastName;
  if (sanitized.phone) payload.phone = sanitized.phone;

  // Map custom fields using config-driven IDs
  if (sanitized.customFields) {
    const mappedFields = [];
    for (const [key, value] of Object.entries(sanitized.customFields)) {
      const fieldId = GHL_FIELD_MAP[key];
      if (!fieldId) {
        logger.warn({ key }, 'GHL: No field mapping for custom field, skipping');
        continue;
      }
      if (value != null && value !== '') {
        mappedFields.push({ id: fieldId, field_value: String(value) });
      }
    }
    if (mappedFields.length > 0) {
      payload.customFields = mappedFields;
    }
  }

  const result = await ghlRequest('POST', '/contacts/upsert', payload);

  const contactId = result?.contact?.id || result?.id;
  if (!contactId) {
    throw new Error(`GHL upsert returned no contact ID: ${JSON.stringify(result)}`);
  }

  // Apply tags if specified
  if (sanitized.tags?.length > 0) {
    await addTag(contactId, sanitized.tags);
  }

  logger.info({ contactId, email: sanitized.email, isNew: !!result?.new }, 'GHL contact upserted');

  return {
    contactId,
    isNew: !!result?.new,
  };
}

/**
 * Add one or more tags to a GHL contact.
 *
 * @param {string} contactId
 * @param {string|string[]} tag - Single tag or array of tags
 * @returns {Promise<void>}
 */
export async function addTag(contactId, tag) {
  const tags = Array.isArray(tag) ? tag : [tag];
  if (tags.length === 0) return;

  await ghlRequest('POST', `/contacts/${contactId}/tags`, { tags });
  logger.info({ contactId, tags }, 'GHL tags added');
}

/**
 * Remove a tag from a GHL contact.
 *
 * @param {string} contactId
 * @param {string} tag - Tag to remove
 * @returns {Promise<void>}
 */
export async function removeTag(contactId, tag) {
  if (!tag) return;

  await ghlRequest('DELETE', `/contacts/${contactId}/tags`, { tags: [tag] });
  logger.info({ contactId, tag }, 'GHL tag removed');
}

/**
 * Update custom fields on a GHL contact.
 *
 * @param {string} contactId
 * @param {Record<string, string>} fields - Key-value where key is the logical name
 * @returns {Promise<void>}
 */
export async function updateCustomFields(contactId, fields) {
  const sanitized = sanitizeForCRM(fields);
  const mappedFields = [];

  for (const [key, value] of Object.entries(sanitized)) {
    const fieldId = GHL_FIELD_MAP[key];
    if (!fieldId) {
      logger.warn({ key }, 'GHL: No field mapping for custom field, skipping');
      continue;
    }
    if (value != null && value !== '') {
      mappedFields.push({ id: fieldId, field_value: String(value) });
    }
  }

  if (mappedFields.length === 0) return;

  await ghlRequest('PUT', `/contacts/${contactId}`, {
    customFields: mappedFields,
  });

  logger.info({ contactId, fields: Object.keys(sanitized) }, 'GHL custom fields updated');
}

// ── Startup Validation ────────────────────────────────────────────

/**
 * Validate that all configured field IDs exist in the GHL location.
 * Called at server startup. Logs warnings for missing fields.
 * If ALL fields are missing, throws (likely wrong location or bad token).
 *
 * @returns {Promise<void>}
 */
export async function validateFieldMappings() {
  const locationId = process.env.GHL_LOCATION_ID;

  if (!locationId) {
    logger.warn('GHL: Skipping field validation (GHL_LOCATION_ID not set)');
    return;
  }

  try {
    // Ensure we have a token before validating
    await getAccessToken();
  } catch {
    logger.warn('GHL: Skipping field validation (no access token)');
    return;
  }

  try {
    const result = await ghlRequest('GET', `/locations/${locationId}/customFields`);
    const existingIds = new Set(
      (result?.customFields || []).map((/** @type {any} */ f) => f.id)
    );

    let missing = 0;
    let total = 0;

    for (const [key, fieldId] of Object.entries(GHL_FIELD_MAP)) {
      if (!fieldId) continue;
      total++;
      if (!existingIds.has(fieldId)) {
        missing++;
        logger.error({ key, fieldId, locationId }, 'GHL: Custom field not found in location');
      }
    }

    if (missing === total && total > 0) {
      throw new Error(
        `GHL: ALL ${total} custom field IDs are invalid. Check GHL_LOCATION_ID and field mappings.`
      );
    }

    if (missing > 0) {
      logger.warn({ missing, total }, 'GHL: Some custom field IDs not found');
    } else {
      logger.info({ total }, 'GHL: All custom field IDs validated successfully');
    }
  } catch (err) {
    if (err.message?.includes('ALL')) throw err;
    logger.warn({ err }, 'GHL: Field validation failed (non-fatal)');
  }
}

// ── Initialize ────────────────────────────────────────────────────

/**
 * Initialize the GHL service. Call at server startup.
 * Loads tokens and optionally validates field mappings.
 *
 * @param {Object} [options]
 * @param {boolean} [options.validateFields=true] - Whether to validate field mappings
 * @returns {Promise<void>}
 */
export async function init(options = {}) {
  const { validateFields = true } = options;

  // Load tokens (Redis first, env fallback)
  try {
    await getAccessToken();
    logger.info('GHL service initialized with valid token');
  } catch {
    logger.warn('GHL: No valid token at startup. CRM sync will fail until OAuth flow completes.');
  }

  if (validateFields) {
    await validateFieldMappings();
  }
}

export default {
  getAccessToken,
  refreshToken,
  storeTokens,
  upsertContact,
  addTag,
  removeTag,
  updateCustomFields,
  sanitizeForCRM,
  validateFieldMappings,
  init,
};
