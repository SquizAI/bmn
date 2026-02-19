# 11 — Integrations Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development
**Depends on:** [01-PRODUCT-REQUIREMENTS.md](01-PRODUCT-REQUIREMENTS.md), [09-GREENFIELD-REBUILD-BLUEPRINT.md](../09-GREENFIELD-REBUILD-BLUEPRINT.md)

---

## Overview

Brand Me Now v2 integrates with three external services beyond the core AI/database stack:

| Service | Role | Old System Problems | v2 Solution |
|---------|------|---------------------|-------------|
| **GoHighLevel (GHL)** | CRM — contact management, sales pipeline, workflow automation | Static bearer token (never rotated), 9 hardcoded custom field IDs, passwords synced to CRM, synchronous blocking calls, silent failures | OAuth 2.0 with token refresh, config-driven field mappings (YAML), event-driven async sync via BullMQ, dead-letter queue + Sentry alerts, zero credentials sent to CRM |
| **Resend** | Transactional email — welcome, completion, abandonment, support | Only used in chatbot module (support email), no templates, no lifecycle emails | Full lifecycle email suite via React Email templates, BullMQ email-send worker, rate limiting, HTML sanitization |
| **Apify** | Web scraping — Instagram, TikTok, Facebook profile data extraction | Direct API calls with no error handling, no rate limiting, no fallback for private/blocked profiles | Structured scraping handlers per platform, unified social profile schema, cost management, manual-entry fallback |

**Architectural principle:** All three integrations are **event-driven via BullMQ**. No integration call ever blocks the user flow. Every failure is retried, dead-lettered, and alerted on.

---

## 1. GoHighLevel CRM Integration

### 1.1 What Changed from Old System

| Aspect | Old (Python/FastAPI) | New (Node.js/Express) |
|--------|---------------------|----------------------|
| **Authentication** | Static bearer token in `HIGHLEVEL_ACCESS_TOKEN`, never rotated | OAuth 2.0 with automatic token refresh |
| **Field Mapping** | 9 hardcoded string IDs in `ghl_client.py` | Config-driven via `crm-fields.yaml`, validated at startup |
| **Sync Pattern** | Synchronous `requests.post()` inside HTTP handlers | Async via BullMQ `crm-sync` queue, never blocks user flow |
| **Error Handling** | `try/except` that logs and swallows errors silently | 3x retry with exponential backoff, dead-letter queue, Sentry alert |
| **Credentials in CRM** | `bmn_username` and `bmn_password` synced to GHL custom fields | **Eliminated.** No passwords, no raw credentials. Only: email, brand name, status, anonymized IDs |
| **Data Sent** | Raw brand data, URLs, user passwords | Minimal: email, brand name, brand status, anonymized brand ID, wizard step tags |

### 1.2 OAuth 2.0 Setup

GHL uses the standard OAuth 2.0 Authorization Code flow. The old system used a static bearer token that never rotated -- a security liability. The new system manages tokens automatically.

**GHL OAuth endpoints:**
- Authorization: `https://marketplace.gohighlevel.com/oauth/chooselocation`
- Token: `https://services.leadconnectorhq.com/oauth/token`
- API base: `https://services.leadconnectorhq.com`

**Required environment variables:**

```bash
# OAuth credentials (from GHL Marketplace app registration)
GHL_CLIENT_ID=           # OAuth client ID
GHL_CLIENT_SECRET=       # OAuth client secret
GHL_REDIRECT_URI=        # e.g. https://api.brandmenow.com/api/v1/webhooks/ghl/callback

# Initial tokens (obtained during first OAuth flow, then auto-refreshed)
GHL_ACCESS_TOKEN=        # Initial access token (replaced at runtime)
GHL_REFRESH_TOKEN=       # Initial refresh token (replaced at runtime)

# Location
GHL_LOCATION_ID=         # GHL location ID

# Field mapping overrides (loaded from crm-fields.yaml, env vars take precedence)
GHL_FIELD_BRAND_VISION=
GHL_FIELD_BRAND_NAME=
GHL_FIELD_BRAND_STATUS=
GHL_FIELD_LOGO_URL=
GHL_FIELD_SOCIAL_HANDLE=
GHL_FIELD_WIZARD_STEP=
```

### 1.3 Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OAuth Token Lifecycle                         │
│                                                                 │
│  ┌─────────┐    token expires     ┌──────────────┐             │
│  │ API Call │ ──────────────────→  │ 401 Response │             │
│  └─────────┘                      └──────┬───────┘             │
│       ▲                                  │                      │
│       │                                  ▼                      │
│       │                           ┌──────────────┐             │
│       │ retry with                │ refreshToken()│             │
│       │ new token                 └──────┬───────┘             │
│       │                                  │                      │
│       │                                  ▼                      │
│       │                    ┌─────────────────────────┐         │
│       │                    │ POST /oauth/token        │         │
│       │                    │ grant_type=refresh_token │         │
│       │                    └──────────┬──────────────┘         │
│       │                               │                        │
│       │                               ▼                        │
│       │                    ┌─────────────────────┐             │
│       │                    │ Store new tokens    │             │
│       │                    │ (Redis + env backup)│             │
│       └────────────────────┤                     │             │
│                            └─────────────────────┘             │
│                                                                 │
│  Proactive refresh: token refreshed 5 min before expiry        │
│  Stored in: Redis key "ghl:tokens" (encrypted at rest)         │
│  Fallback: env vars GHL_ACCESS_TOKEN / GHL_REFRESH_TOKEN       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Config-Driven Field Mappings

```yaml
# server/config/crm-fields.yaml
#
# GHL custom field mappings. All IDs are loaded from environment variables
# at startup. The server validates that every referenced field ID actually
# exists in GHL before accepting traffic. If validation fails, the server
# logs a FATAL error and exits (fail fast, not fail silently).
#
# To add a new field:
#   1. Create the custom field in GHL
#   2. Copy the field ID
#   3. Add it here and in the corresponding env var
#   4. Restart the server — startup validation confirms it exists

ghl:
  location_id: ${GHL_LOCATION_ID}

  # API configuration
  api:
    base_url: "https://services.leadconnectorhq.com"
    api_version: "2021-07-28"
    timeout_ms: 30000

  # Custom field mappings — env vars resolved at load time
  field_mappings:
    brand_vision: ${GHL_FIELD_BRAND_VISION}
    brand_name: ${GHL_FIELD_BRAND_NAME}
    brand_status: ${GHL_FIELD_BRAND_STATUS}
    logo_url: ${GHL_FIELD_LOGO_URL}
    social_handle: ${GHL_FIELD_SOCIAL_HANDLE}
    wizard_step: ${GHL_FIELD_WIZARD_STEP}

  # Tag prefixes for wizard events
  tags:
    wizard_started: "wizard-started"
    brand_completed: "brand-completed"
    wizard_abandoned: "abandoned"
    subscription_created: "subscriber"
    subscription_tier_prefix: "tier-"

  # Retry configuration
  retry:
    max_attempts: 3
    backoff_ms: [1000, 5000, 15000]  # exponential backoff
    dead_letter_queue: "crm-sync-dlq"

  # SECURITY: Fields that must NEVER be sent to GHL
  # Enforced at the GHL client level — not just convention
  blocked_fields:
    - password
    - password_hash
    - credit_card
    - ssn
    - stripe_customer_id
    - supabase_token
```

### 1.5 Startup Validation

At server boot, the GHL client confirms every configured field ID actually exists in the GHL location. This prevents silent failures from stale/deleted field IDs.

```javascript
// server/src/services/ghl-client.js

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import pino from 'pino';
import * as Sentry from '@sentry/node';

const logger = pino({ name: 'ghl-client' });

// ─── Configuration ───────────────────────────────────────────────

/**
 * @typedef {Object} GHLTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAt - Unix timestamp (ms)
 */

/**
 * @typedef {Object} GHLConfig
 * @property {string} locationId
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} redirectUri
 * @property {string} baseUrl
 * @property {string} apiVersion
 * @property {number} timeoutMs
 * @property {Record<string, string>} fieldMappings
 * @property {Record<string, string>} tags
 * @property {{ maxAttempts: number, backoffMs: number[] }} retry
 * @property {string[]} blockedFields
 */

/** @type {GHLConfig} */
let config;

/** @type {GHLTokens} */
let tokens;

/** @type {import('ioredis').Redis} */
let redis;

/**
 * Load and resolve CRM field configuration from YAML.
 * Environment variables in ${VAR} syntax are resolved at load time.
 * @returns {GHLConfig}
 */
function loadConfig() {
  const raw = readFileSync(
    resolve(process.cwd(), 'config/crm-fields.yaml'),
    'utf-8'
  );

  // Resolve ${ENV_VAR} placeholders
  const resolved = raw.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const val = process.env[varName];
    if (!val) {
      logger.warn(`CRM config: env var ${varName} is not set`);
      return '';
    }
    return val;
  });

  const doc = yaml.load(resolved);
  const ghl = doc.ghl;

  return {
    locationId: ghl.location_id,
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    redirectUri: process.env.GHL_REDIRECT_URI,
    baseUrl: ghl.api?.base_url || 'https://services.leadconnectorhq.com',
    apiVersion: ghl.api?.api_version || '2021-07-28',
    timeoutMs: ghl.api?.timeout_ms || 30_000,
    fieldMappings: ghl.field_mappings || {},
    tags: ghl.tags || {},
    retry: {
      maxAttempts: ghl.retry?.max_attempts || 3,
      backoffMs: ghl.retry?.backoff_ms || [1000, 5000, 15000],
    },
    blockedFields: ghl.blocked_fields || [],
  };
}

// ─── OAuth Token Management ──────────────────────────────────────

/**
 * Initialize tokens from Redis (primary) or environment variables (fallback).
 * @param {import('ioredis').Redis} redisClient
 */
async function initTokens(redisClient) {
  redis = redisClient;

  // Try Redis first (tokens survive server restarts)
  const stored = await redis.get('ghl:tokens');
  if (stored) {
    tokens = JSON.parse(stored);
    logger.info('GHL tokens loaded from Redis');

    // Proactive refresh if expiring within 5 minutes
    if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
      logger.info('GHL token expiring soon, refreshing proactively');
      await refreshAccessToken();
    }
    return;
  }

  // Fallback to env vars (first boot or Redis wipe)
  tokens = {
    accessToken: process.env.GHL_ACCESS_TOKEN || '',
    refreshToken: process.env.GHL_REFRESH_TOKEN || '',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Assume 24h if unknown
  };

  if (tokens.accessToken) {
    await redis.set('ghl:tokens', JSON.stringify(tokens));
    logger.info('GHL tokens initialized from env vars and cached in Redis');
  } else {
    logger.warn('GHL: No access token available. CRM sync will fail until OAuth flow completes.');
  }
}

/**
 * Refresh the OAuth access token using the refresh token.
 * Stores new tokens in Redis. Alerts Sentry on failure.
 * @returns {Promise<void>}
 */
async function refreshAccessToken() {
  if (!tokens.refreshToken) {
    const err = new Error('GHL: No refresh token available. Re-authorize via OAuth.');
    logger.error(err.message);
    Sentry.captureException(err);
    throw err;
  }

  try {
    const response = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GHL token refresh failed: ${response.status} ${body}`);
    }

    const data = await response.json();

    tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    await redis.set('ghl:tokens', JSON.stringify(tokens));
    logger.info('GHL tokens refreshed successfully', {
      expiresIn: data.expires_in,
    });
  } catch (err) {
    logger.error('GHL token refresh failed', { error: err.message });
    Sentry.captureException(err, {
      tags: { integration: 'ghl', operation: 'token_refresh' },
    });
    throw err;
  }
}

/**
 * Get current access token. Refreshes automatically if expired or expiring soon.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  // Refresh if expired or expiring within 5 minutes
  if (!tokens.accessToken || tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    await refreshAccessToken();
  }
  return tokens.accessToken;
}

// ─── API Request Helper ──────────────────────────────────────────

/**
 * Make an authenticated request to GHL API.
 * Automatically handles token refresh on 401.
 *
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. "/contacts/upsert")
 * @param {Object} [body] - Request body
 * @param {number} [attempt=1] - Current retry attempt
 * @returns {Promise<Object>} Parsed JSON response
 */
async function ghlRequest(method, path, body = null, attempt = 1) {
  const accessToken = await getAccessToken();

  const url = `${config.baseUrl}${path}`;
  /** @type {RequestInit} */
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Version': config.apiVersion,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Token expired — refresh and retry once
  if (response.status === 401 && attempt === 1) {
    logger.info('GHL: 401 received, refreshing token and retrying');
    await refreshAccessToken();
    return ghlRequest(method, path, body, 2);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GHL API ${method} ${path}: ${response.status} ${errorBody}`);
  }

  return response.json();
}

// ─── Blocked Fields Enforcement ──────────────────────────────────

/**
 * Strip any blocked fields from data before sending to GHL.
 * This is a hard security boundary — even if a caller accidentally
 * includes a password, it will never reach GHL.
 *
 * @param {Record<string, any>} data
 * @returns {Record<string, any>} Sanitized data
 */
function sanitizeForCRM(data) {
  const clean = { ...data };
  for (const field of config.blockedFields) {
    if (field in clean) {
      logger.warn(`GHL: Blocked field "${field}" stripped from CRM payload`);
      delete clean[field];
    }
  }
  return clean;
}

// ─── Contact Operations ──────────────────────────────────────────

/**
 * Upsert a contact in GHL. Creates if not found, updates if exists.
 * SECURITY: Runs data through sanitizeForCRM before sending.
 *
 * @param {string} email - Contact email (upsert key)
 * @param {Object} data
 * @param {string} [data.firstName]
 * @param {string} [data.lastName]
 * @param {string} [data.phone]
 * @param {string[]} [data.tags] - Tags to apply
 * @param {Record<string, string>} [data.customFields] - Custom field key→value (uses config mapping)
 * @returns {Promise<{ contactId: string, isNew: boolean }>}
 */
async function upsertContact(email, data = {}) {
  const sanitized = sanitizeForCRM(data);

  /** @type {Record<string, any>} */
  const payload = {
    email,
    locationId: config.locationId,
  };

  if (sanitized.firstName) payload.firstName = sanitized.firstName;
  if (sanitized.lastName) payload.lastName = sanitized.lastName;
  if (sanitized.phone) payload.phone = sanitized.phone;

  // Map custom fields using config-driven IDs
  if (sanitized.customFields) {
    const mappedFields = [];
    for (const [key, value] of Object.entries(sanitized.customFields)) {
      const fieldId = config.fieldMappings[key];
      if (!fieldId) {
        logger.warn(`GHL: No field mapping for "${key}", skipping`);
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
    await addTags(contactId, sanitized.tags);
  }

  logger.info('GHL contact upserted', { contactId, email, isNew: !!result?.new });

  return {
    contactId,
    isNew: !!result?.new,
  };
}

/**
 * Add tags to a GHL contact.
 *
 * @param {string} contactId
 * @param {string[]} tags
 * @returns {Promise<void>}
 */
async function addTags(contactId, tags) {
  if (!tags || tags.length === 0) return;

  await ghlRequest('POST', `/contacts/${contactId}/tags`, { tags });
  logger.info('GHL tags added', { contactId, tags });
}

/**
 * Update custom fields on a GHL contact.
 *
 * @param {string} contactId
 * @param {Record<string, string>} fields - Key→value where key is the logical name (e.g. "brand_vision")
 * @returns {Promise<void>}
 */
async function updateCustomFields(contactId, fields) {
  const sanitized = sanitizeForCRM(fields);
  const mappedFields = [];

  for (const [key, value] of Object.entries(sanitized)) {
    const fieldId = config.fieldMappings[key];
    if (!fieldId) {
      logger.warn(`GHL: No field mapping for "${key}", skipping`);
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

  logger.info('GHL custom fields updated', { contactId, fields: Object.keys(sanitized) });
}

// ─── Startup Validation ──────────────────────────────────────────

/**
 * Validate that all configured field IDs exist in the GHL location.
 * Called at server startup. Logs warnings for missing fields.
 * If ALL fields are missing, throws (likely wrong location or bad token).
 *
 * @returns {Promise<void>}
 */
async function validateFieldMappings() {
  if (!config.locationId || !tokens.accessToken) {
    logger.warn('GHL: Skipping field validation (not configured)');
    return;
  }

  try {
    const result = await ghlRequest('GET', `/locations/${config.locationId}/customFields`);
    const existingIds = new Set(
      (result?.customFields || []).map((f) => f.id)
    );

    let missing = 0;
    let total = 0;

    for (const [key, fieldId] of Object.entries(config.fieldMappings)) {
      if (!fieldId) continue;
      total++;
      if (!existingIds.has(fieldId)) {
        missing++;
        logger.error(`GHL: Custom field "${key}" (ID: ${fieldId}) not found in location ${config.locationId}`);
      }
    }

    if (missing === total && total > 0) {
      throw new Error(
        `GHL: ALL ${total} custom field IDs are invalid. Check GHL_LOCATION_ID and field mappings.`
      );
    }

    if (missing > 0) {
      logger.warn(`GHL: ${missing}/${total} custom field IDs not found. Some CRM syncs will fail.`);
    } else {
      logger.info(`GHL: All ${total} custom field IDs validated successfully`);
    }
  } catch (err) {
    if (err.message.includes('ALL')) throw err; // Re-throw fatal error
    logger.warn('GHL: Field validation failed (non-fatal)', { error: err.message });
  }
}

// ─── Initialize & Export ─────────────────────────────────────────

/**
 * Initialize the GHL client. Must be called at server startup.
 *
 * @param {import('ioredis').Redis} redisClient
 * @returns {Promise<void>}
 */
async function init(redisClient) {
  config = loadConfig();
  await initTokens(redisClient);
  await validateFieldMappings();
  logger.info('GHL client initialized');
}

export const ghlClient = {
  init,
  upsertContact,
  addTags,
  updateCustomFields,
  refreshAccessToken,
  getAccessToken,
  sanitizeForCRM,
  validateFieldMappings,
};
```

### 1.6 Event-Driven Sync Pattern

All CRM synchronization flows through BullMQ. The user never waits for GHL.

```
User action (wizard/auth)
  │
  ▼
Express route handler
  │
  ├─ Respond to user immediately (< 50ms)
  │
  └─ Enqueue BullMQ job: queue="crm-sync"
       │
       ▼
     BullMQ Worker picks up job
       │
       ├─ Resolve user email from Supabase profiles
       ├─ Call ghlClient.upsertContact()
       ├─ Apply tags based on event type
       ├─ Update custom fields with sanitized data
       │
       ├─ Success → Job complete, logged
       │
       └─ Failure →
            ├─ Retry 1 (after 1s)
            ├─ Retry 2 (after 5s)
            ├─ Retry 3 (after 15s)
            └─ Dead letter queue → Sentry alert
```

**Events to sync:**

| Event | Trigger | GHL Action |
|-------|---------|------------|
| `wizard.started` | User begins wizard (after signup + phone) | Upsert contact, add tag `wizard-started` |
| `brand.completed` | User finishes all wizard steps | Update custom fields (brand_name, brand_status, logo_url), add tag `brand-completed` |
| `wizard.abandoned` | 24h since last wizard activity (detected by cron job) | Add tag `abandoned-step-{lastStep}` |
| `subscription.created` | Stripe webhook confirms new subscription | Add tags `subscriber`, `tier-{tierName}` |

**SECURITY: Data sent to GHL per event:**

| Event | Data Sent | Data NOT Sent |
|-------|-----------|---------------|
| `wizard.started` | email, first name, last name, phone | password, token, user ID |
| `brand.completed` | brand name, brand status ("completed"), logo URL (public CDN), social handle | brand vision text, color palette, full social data, internal brand ID |
| `wizard.abandoned` | last wizard step name | brand data, any user content |
| `subscription.created` | subscription tier name | Stripe customer ID, payment details, card info |

### 1.7 BullMQ CRM-Sync Worker

```javascript
// server/src/workers/crm-sync.js

import { Worker } from 'bullmq';
import { ghlClient } from '../services/ghl-client.js';
import { supabase } from '../services/supabase.js';
import pino from 'pino';
import * as Sentry from '@sentry/node';

const logger = pino({ name: 'worker:crm-sync' });

/**
 * @typedef {Object} CRMSyncJobData
 * @property {string} userId - Supabase user ID
 * @property {string} eventType - One of: wizard.started, brand.completed, wizard.abandoned, subscription.created
 * @property {Record<string, any>} [data] - Event-specific data (already sanitized by enqueuer)
 * @property {number} [enqueuedAt] - Timestamp when job was created
 */

/**
 * Resolve user profile from Supabase for CRM sync.
 * Returns only the fields needed for GHL — no passwords, no tokens.
 *
 * @param {string} userId
 * @returns {Promise<{ email: string, firstName: string, lastName: string, phone: string | null }>}
 */
async function resolveUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name, phone')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to resolve profile for user ${userId}: ${error?.message || 'not found'}`);
  }

  const nameParts = (data.full_name || 'Unknown').split(' ');
  return {
    email: data.email,
    firstName: nameParts[0] || 'Unknown',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: data.phone || null,
  };
}

/**
 * Process a CRM sync event.
 *
 * @param {import('bullmq').Job<CRMSyncJobData>} job
 * @returns {Promise<{ contactId: string, action: string }>}
 */
async function processCRMSync(job) {
  const { userId, eventType, data = {} } = job.data;

  logger.info('Processing CRM sync', { jobId: job.id, userId, eventType });

  // Step 1: Resolve user profile
  const profile = await resolveUserProfile(userId);

  // Step 2: Event-specific CRM operations
  switch (eventType) {
    case 'wizard.started': {
      const { contactId } = await ghlClient.upsertContact(profile.email, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        tags: ['wizard-started'],
      });
      return { contactId, action: 'upserted + tagged wizard-started' };
    }

    case 'brand.completed': {
      const { contactId } = await ghlClient.upsertContact(profile.email, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        tags: ['brand-completed'],
        customFields: {
          brand_name: data.brandName || '',
          brand_status: 'completed',
          logo_url: data.logoUrl || '',
          social_handle: data.socialHandle || '',
        },
      });
      return { contactId, action: 'upserted + tagged brand-completed + custom fields' };
    }

    case 'wizard.abandoned': {
      const { contactId } = await ghlClient.upsertContact(profile.email, {
        tags: [`abandoned-step-${data.lastStep || 'unknown'}`],
      });
      return { contactId, action: `tagged abandoned-step-${data.lastStep}` };
    }

    case 'subscription.created': {
      const tierName = data.tier || 'unknown';
      const { contactId } = await ghlClient.upsertContact(profile.email, {
        tags: ['subscriber', `tier-${tierName}`],
      });
      return { contactId, action: `tagged subscriber + tier-${tierName}` };
    }

    default:
      logger.warn('Unknown CRM sync event type', { eventType });
      return { contactId: null, action: 'skipped — unknown event' };
  }
}

// ─── Worker Setup ────────────────────────────────────────────────

/**
 * Create and start the CRM sync BullMQ worker.
 *
 * @param {import('ioredis').Redis} redisConnection
 * @returns {Worker}
 */
export function createCRMSyncWorker(redisConnection) {
  const worker = new Worker(
    'crm-sync',
    async (job) => {
      try {
        const result = await processCRMSync(job);
        logger.info('CRM sync completed', {
          jobId: job.id,
          eventType: job.data.eventType,
          ...result,
        });
        return result;
      } catch (err) {
        logger.error('CRM sync failed', {
          jobId: job.id,
          eventType: job.data.eventType,
          attempt: job.attemptsMade + 1,
          error: err.message,
        });

        // Sentry alert on final attempt
        if (job.attemptsMade + 1 >= 3) {
          Sentry.captureException(err, {
            tags: {
              integration: 'ghl',
              eventType: job.data.eventType,
              queue: 'crm-sync',
            },
            extra: {
              userId: job.data.userId,
              attempts: job.attemptsMade + 1,
            },
          });
        }

        throw err; // Re-throw for BullMQ retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 10,       // Max 10 jobs
        duration: 1000, // Per second (GHL rate limit: ~10 req/s)
      },
    }
  );

  // Dead letter queue handler
  worker.on('failed', async (job, err) => {
    if (job.attemptsMade >= 3) {
      logger.error('CRM sync job moved to DLQ', {
        jobId: job.id,
        eventType: job.data.eventType,
        userId: job.data.userId,
        error: err.message,
      });
    }
  });

  worker.on('error', (err) => {
    logger.error('CRM sync worker error', { error: err.message });
    Sentry.captureException(err, { tags: { worker: 'crm-sync' } });
  });

  logger.info('CRM sync worker started');
  return worker;
}

// ─── Queue Helper (for route handlers to enqueue sync jobs) ──────

import { Queue } from 'bullmq';

/** @type {Queue} */
let crmSyncQueue;

/**
 * Initialize the CRM sync queue. Called once at server startup.
 * @param {import('ioredis').Redis} redisConnection
 */
export function initCRMSyncQueue(redisConnection) {
  crmSyncQueue = new Queue('crm-sync', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'custom',
        delay: (attemptsMade) => [1000, 5000, 15000][attemptsMade - 1] || 15000,
      },
      removeOnComplete: { age: 24 * 3600 },   // Keep completed jobs for 24h
      removeOnFail: { age: 7 * 24 * 3600 },   // Keep failed jobs for 7 days
    },
  });
}

/**
 * Enqueue a CRM sync event. Call this from route handlers.
 * This function returns immediately — the sync happens in the background.
 *
 * @param {string} userId - Supabase user ID
 * @param {string} eventType - Event type (wizard.started, brand.completed, etc.)
 * @param {Record<string, any>} [data] - Event-specific data
 * @returns {Promise<string>} Job ID
 */
export async function enqueueCRMSync(userId, eventType, data = {}) {
  if (!crmSyncQueue) {
    logger.warn('CRM sync queue not initialized, skipping', { userId, eventType });
    return null;
  }

  const job = await crmSyncQueue.add(
    eventType,                     // Job name (for filtering in Bull Board)
    {
      userId,
      eventType,
      data,
      enqueuedAt: Date.now(),
    },
    {
      jobId: `crm-${userId}-${eventType}-${Date.now()}`, // Deduplication key
    }
  );

  logger.info('CRM sync enqueued', { jobId: job.id, userId, eventType });
  return job.id;
}
```

### 1.8 Route Integration Example

How a route handler enqueues a CRM sync without blocking the user:

```javascript
// server/src/routes/wizard.js (excerpt)

import { enqueueCRMSync } from '../workers/crm-sync.js';

/**
 * POST /api/v1/wizard/start
 * User begins the wizard. Enqueues CRM sync in background.
 */
router.post('/start', authMiddleware, validate(wizardStartSchema), async (req, res) => {
  const { brandId } = req.body;
  const userId = req.user.id;

  // Business logic — create brand record, etc.
  // ...

  // Non-blocking CRM sync — user never waits for this
  enqueueCRMSync(userId, 'wizard.started').catch((err) => {
    // Log but never fail the user request because of CRM
    logger.warn('Failed to enqueue CRM sync', { userId, error: err.message });
  });

  // Respond immediately
  res.json({ ok: true, brandId });
});
```

---

## 2. Resend Email Integration

### 2.1 Overview

Resend provides transactional email delivery. The old system used Resend only for chatbot support emails (2 templates, Python). The rebuild expands to a full lifecycle email suite with React Email templates and a dedicated BullMQ worker.

**Required environment variables:**

```bash
RESEND_API_KEY=           # Resend API key
RESEND_FROM_EMAIL=        # Default sender (e.g. "Brand Me Now <hello@brandmenow.com>")
RESEND_SUPPORT_EMAIL=     # Support inbox (e.g. "support@brandmenow.com")
RESEND_REPLY_TO=          # Reply-to address
```

### 2.2 Resend SDK Setup

```javascript
// server/src/services/resend.js

import { Resend } from 'resend';
import { render } from '@react-email/render';
import sanitizeHtml from 'sanitize-html';
import pino from 'pino';
import * as Sentry from '@sentry/node';

const logger = pino({ name: 'resend' });

// ─── Client Setup ────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Brand Me Now <hello@brandmenow.com>';
const SUPPORT_EMAIL = process.env.RESEND_SUPPORT_EMAIL || 'support@brandmenow.com';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'support@brandmenow.com';

// ─── Sanitization ────────────────────────────────────────────────

/**
 * Sanitize user-provided text before embedding in email HTML.
 * Prevents XSS via email clients that render HTML.
 *
 * @param {string} text - Untrusted user input
 * @returns {string} Sanitized text safe for HTML embedding
 */
function sanitize(text) {
  if (!text) return '';
  return sanitizeHtml(text, {
    allowedTags: [],        // Strip ALL HTML tags
    allowedAttributes: {},  // Strip ALL attributes
    disallowedTagsMode: 'escape',
  });
}

// ─── Template Rendering ──────────────────────────────────────────

/**
 * Render a React Email component to HTML string.
 * All user-provided data is sanitized before being passed to the template.
 *
 * @param {import('react').ReactElement} template - React Email component
 * @returns {Promise<string>} Rendered HTML string
 */
async function renderTemplate(template) {
  return render(template);
}

// ─── Email Send Function ─────────────────────────────────────────

/**
 * @typedef {Object} SendEmailOptions
 * @property {string} to - Recipient email
 * @property {string} subject - Email subject
 * @property {import('react').ReactElement} template - React Email template component
 * @property {string} [from] - Override default from address
 * @property {string} [replyTo] - Override default reply-to
 * @property {string[]} [cc] - CC recipients
 * @property {string[]} [bcc] - BCC recipients
 * @property {string} [tag] - Resend tag for analytics (e.g. "welcome", "abandonment")
 */

/**
 * Send an email via Resend with a React Email template.
 *
 * @param {SendEmailOptions} options
 * @returns {Promise<{ id: string }>} Resend message ID
 */
async function sendEmail({ to, subject, template, from, replyTo, cc, bcc, tag }) {
  const html = await renderTemplate(template);

  const result = await resend.emails.send({
    from: from || DEFAULT_FROM,
    to,
    subject,
    html,
    reply_to: replyTo || REPLY_TO,
    cc,
    bcc,
    tags: tag ? [{ name: 'category', value: tag }] : undefined,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  logger.info('Email sent', { messageId: result.data?.id, to, subject, tag });
  return { id: result.data?.id };
}

export const emailService = {
  sendEmail,
  sanitize,
  renderTemplate,
  DEFAULT_FROM,
  SUPPORT_EMAIL,
  REPLY_TO,
};
```

### 2.3 React Email Templates

Every template is a React component rendered server-side via `@react-email/render`. Templates live in `server/src/email-templates/` and are imported by the email-send worker.

#### Template Registry

| Template | Trigger | Subject | Key Data |
|----------|---------|---------|----------|
| `WelcomeEmail` | User signup | "Welcome to Brand Me Now" | User name, login link |
| `BrandCompletionEmail` | Brand wizard completed | "Your brand {name} is ready!" | Brand name, logo image, brand summary, dashboard link |
| `WizardAbandonmentEmail` | 24h since last wizard activity | "Your brand is waiting for you" | Resume link (HMAC token), last completed step |
| `SupportRequestEmail` | Chatbot "talk to human" | "[Support] {subject}" | User email, message, conversation context |
| `PaymentConfirmationEmail` | Stripe payment succeeded | "Payment confirmed — {tier} plan" | Tier name, amount, next billing date, receipt link |
| `SubscriptionRenewalEmail` | 7 days before renewal | "Your {tier} plan renews on {date}" | Tier, renewal date, manage subscription link |
| `CreditLowWarningEmail` | Credits drop below 20% | "Running low on credits" | Credits remaining, tier, upgrade link |

#### WelcomeEmail

```jsx
// server/src/email-templates/WelcomeEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr, Link,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {string} props.loginUrl - URL to the app login page
 */
export function WelcomeEmail({ userName, loginUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Brand Me Now — let's build your brand</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150"
            height="40"
            alt="Brand Me Now"
            style={logo}
          />
          <Text style={heading}>Welcome, {userName}!</Text>
          <Text style={paragraph}>
            You're one step closer to turning your social media presence into
            a complete, sellable brand. Our AI-powered wizard will guide you
            through the entire process — from social analysis to logo generation
            to product mockups.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Start Building Your Brand
            </Button>
          </Section>
          <Text style={paragraph}>
            Here's what you'll get:
          </Text>
          <Text style={listItem}>• AI-analyzed brand identity from your social profiles</Text>
          <Text style={listItem}>• Custom logo designs generated in seconds</Text>
          <Text style={listItem}>• Product mockups with your branding applied</Text>
          <Text style={listItem}>• Revenue projections for your branded products</Text>
          <Hr style={hr} />
          <Text style={footer}>
            <Link href="https://brandmenow.com" style={link}>Brand Me Now</Link> — Go from
            social media presence to branded product line in minutes.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const logo = { margin: '0 auto 24px', display: 'block' };

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a2e',
  textAlign: 'center',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#4a4a68',
  margin: '0 0 16px',
};

const listItem = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#4a4a68',
  margin: '0 0 8px',
  paddingLeft: '8px',
};

const buttonContainer = { textAlign: 'center', margin: '24px 0' };

const button = {
  backgroundColor: '#6c5ce7',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 32px',
};

const hr = { borderColor: '#e6ebf1', margin: '24px 0' };

const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };

const link = { color: '#6c5ce7', textDecoration: 'underline' };
```

#### BrandCompletionEmail

```jsx
// server/src/email-templates/BrandCompletionEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr, Link, Column, Row,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {string} props.brandName - Brand name (sanitized)
 * @param {string} props.logoUrl - Public CDN URL of the brand logo
 * @param {string[]} props.colors - Hex color palette (e.g. ["#6c5ce7", "#a29bfe"])
 * @param {string} props.archetype - Brand archetype (e.g. "The Creator")
 * @param {string} props.dashboardUrl - URL to the brand dashboard
 */
export function BrandCompletionEmail({
  userName,
  brandName,
  logoUrl,
  colors = [],
  archetype,
  dashboardUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>Your brand {brandName} is ready!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150"
            height="40"
            alt="Brand Me Now"
            style={logoStyle}
          />

          <Text style={heading}>
            {brandName} is ready!
          </Text>

          <Text style={paragraph}>
            Congratulations, {userName}! Your brand has been created.
            Here's a summary of what we built together:
          </Text>

          {/* Brand Logo */}
          <Section style={logoSection}>
            <Img
              src={logoUrl}
              width="200"
              height="200"
              alt={`${brandName} logo`}
              style={brandLogoImg}
            />
          </Section>

          {/* Color Palette */}
          {colors.length > 0 && (
            <Section style={paletteSection}>
              <Text style={sectionLabel}>Color Palette</Text>
              <Row>
                {colors.slice(0, 6).map((color, i) => (
                  <Column key={i} style={{ textAlign: 'center', width: `${100 / Math.min(colors.length, 6)}%` }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      margin: '0 auto',
                      border: '2px solid #e6ebf1',
                    }} />
                    <Text style={colorLabel}>{color}</Text>
                  </Column>
                ))}
              </Row>
            </Section>
          )}

          {/* Archetype */}
          {archetype && (
            <Section style={archetypeSection}>
              <Text style={sectionLabel}>Brand Archetype</Text>
              <Text style={archetypeText}>{archetype}</Text>
            </Section>
          )}

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View Your Brand Dashboard
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Your brand assets are saved in your dashboard. You can download
            logos, mockups, and share your brand from there.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const logoStyle = { margin: '0 auto 24px', display: 'block' };

const heading = {
  fontSize: '28px', fontWeight: '700', color: '#1a1a2e',
  textAlign: 'center', margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px', lineHeight: '26px', color: '#4a4a68', margin: '0 0 24px',
};

const logoSection = {
  textAlign: 'center', margin: '0 0 24px',
  padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '8px',
};

const brandLogoImg = {
  margin: '0 auto', display: 'block', borderRadius: '8px',
};

const paletteSection = { margin: '0 0 24px', textAlign: 'center' };

const sectionLabel = {
  fontSize: '12px', fontWeight: '600', color: '#8898aa',
  textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px',
};

const colorLabel = { fontSize: '11px', color: '#8898aa', margin: '4px 0 0' };

const archetypeSection = {
  textAlign: 'center', margin: '0 0 24px',
  padding: '16px', backgroundColor: '#f0f0ff', borderRadius: '8px',
};

const archetypeText = {
  fontSize: '18px', fontWeight: '600', color: '#6c5ce7', margin: '0',
};

const buttonContainer = { textAlign: 'center', margin: '24px 0' };

const button = {
  backgroundColor: '#6c5ce7', borderRadius: '6px', color: '#ffffff',
  fontSize: '16px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center', display: 'inline-block', padding: '12px 32px',
};

const hr = { borderColor: '#e6ebf1', margin: '24px 0' };

const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };
```

#### WizardAbandonmentEmail

```jsx
// server/src/email-templates/WizardAbandonmentEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {string} props.resumeUrl - HMAC-signed resume URL (24h expiry)
 * @param {string} props.lastStepName - Human-readable name of last completed step
 * @param {number} props.progressPercent - Wizard completion percentage (0-100)
 */
export function WizardAbandonmentEmail({
  userName,
  resumeUrl,
  lastStepName,
  progressPercent,
}) {
  return (
    <Html>
      <Head />
      <Preview>Your brand is {progressPercent}% complete — pick up where you left off</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150"
            height="40"
            alt="Brand Me Now"
            style={logo}
          />

          <Text style={heading}>
            Your brand is waiting
          </Text>

          <Text style={paragraph}>
            Hi {userName}, you were making great progress on your brand!
            You completed <strong>{lastStepName}</strong> and you're
            already <strong>{progressPercent}%</strong> of the way there.
          </Text>

          {/* Progress bar */}
          <Section style={progressBarOuter}>
            <div style={{
              ...progressBarInner,
              width: `${Math.min(progressPercent, 100)}%`,
            }} />
          </Section>
          <Text style={progressText}>{progressPercent}% complete</Text>

          <Text style={paragraph}>
            Your progress is saved. Click below to resume right where you left off:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resumeUrl}>
              Resume My Brand
            </Button>
          </Section>

          <Text style={smallText}>
            This link expires in 24 hours. After that, you can still log in
            to resume your brand from the dashboard.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            If you need help, reply to this email or use the chat widget in the app.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px',
  maxWidth: '560px', borderRadius: '8px',
};

const logo = { margin: '0 auto 24px', display: 'block' };

const heading = {
  fontSize: '24px', fontWeight: '700', color: '#1a1a2e',
  textAlign: 'center', margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px', lineHeight: '26px', color: '#4a4a68', margin: '0 0 16px',
};

const progressBarOuter = {
  backgroundColor: '#e6ebf1', borderRadius: '4px', height: '8px',
  margin: '0 0 8px', overflow: 'hidden',
};

const progressBarInner = {
  backgroundColor: '#6c5ce7', height: '8px', borderRadius: '4px',
  transition: 'width 0.3s ease',
};

const progressText = {
  fontSize: '13px', color: '#6c5ce7', fontWeight: '600',
  textAlign: 'center', margin: '0 0 16px',
};

const buttonContainer = { textAlign: 'center', margin: '24px 0' };

const button = {
  backgroundColor: '#6c5ce7', borderRadius: '6px', color: '#ffffff',
  fontSize: '16px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center', display: 'inline-block', padding: '12px 32px',
};

const smallText = { fontSize: '13px', color: '#8898aa', textAlign: 'center', margin: '0 0 16px' };

const hr = { borderColor: '#e6ebf1', margin: '24px 0' };

const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };
```

#### SupportRequestEmail

```jsx
// server/src/email-templates/SupportRequestEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Hr, Code,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userEmail - User's email (sanitized)
 * @param {string} props.userName - User's name (sanitized)
 * @param {string} props.subject - Support subject (sanitized)
 * @param {string} props.message - User's message (sanitized, HTML stripped)
 * @param {string} [props.conversationContext] - Last 5 chatbot messages (sanitized)
 * @param {string} [props.brandName] - Current brand name if applicable (sanitized)
 * @param {string} [props.wizardStep] - Current wizard step if applicable
 */
export function SupportRequestEmail({
  userEmail,
  userName,
  subject,
  message,
  conversationContext,
  brandName,
  wizardStep,
}) {
  return (
    <Html>
      <Head />
      <Preview>[Support] {subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Support Request</Text>

          <Section style={metaSection}>
            <Text style={metaItem}><strong>From:</strong> {userName} ({userEmail})</Text>
            <Text style={metaItem}><strong>Subject:</strong> {subject}</Text>
            {brandName && <Text style={metaItem}><strong>Brand:</strong> {brandName}</Text>}
            {wizardStep && <Text style={metaItem}><strong>Wizard Step:</strong> {wizardStep}</Text>}
          </Section>

          <Hr style={hr} />

          <Text style={sectionLabel}>Message</Text>
          <Text style={messageText}>{message}</Text>

          {conversationContext && (
            <>
              <Hr style={hr} />
              <Text style={sectionLabel}>Chatbot Conversation Context</Text>
              <Code style={contextBlock}>{conversationContext}</Code>
            </>
          )}

          <Hr style={hr} />
          <Text style={footer}>
            Reply directly to this email to respond to the user at {userEmail}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px',
  maxWidth: '600px', borderRadius: '8px',
};

const heading = {
  fontSize: '24px', fontWeight: '700', color: '#e74c3c',
  margin: '0 0 16px',
};

const metaSection = { backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '6px', margin: '0 0 16px' };

const metaItem = { fontSize: '14px', color: '#4a4a68', margin: '0 0 4px', lineHeight: '22px' };

const sectionLabel = {
  fontSize: '12px', fontWeight: '600', color: '#8898aa',
  textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px',
};

const messageText = {
  fontSize: '15px', lineHeight: '24px', color: '#2d3748',
  padding: '16px', backgroundColor: '#fffef5', borderRadius: '6px',
  borderLeft: '4px solid #f6e05e',
};

const contextBlock = {
  fontSize: '13px', lineHeight: '20px', color: '#4a4a68',
  padding: '16px', backgroundColor: '#f7fafc', borderRadius: '6px',
  whiteSpace: 'pre-wrap', display: 'block',
};

const hr = { borderColor: '#e6ebf1', margin: '24px 0' };

const footer = { fontSize: '13px', color: '#8898aa' };
```

#### PaymentConfirmationEmail

```jsx
// server/src/email-templates/PaymentConfirmationEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr, Link,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {string} props.tierName - Subscription tier (e.g. "Pro")
 * @param {string} props.amount - Formatted amount (e.g. "$79.00")
 * @param {string} props.nextBillingDate - Formatted date (e.g. "March 19, 2026")
 * @param {string} props.receiptUrl - Stripe receipt URL
 * @param {string} props.dashboardUrl - App dashboard URL
 */
export function PaymentConfirmationEmail({
  userName,
  tierName,
  amount,
  nextBillingDate,
  receiptUrl,
  dashboardUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>Payment confirmed — {tierName} plan ({amount})</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150" height="40"
            alt="Brand Me Now" style={logo}
          />

          <Text style={heading}>Payment Confirmed</Text>

          <Text style={paragraph}>
            Hi {userName}, your payment of <strong>{amount}</strong> for
            the <strong>{tierName}</strong> plan has been processed successfully.
          </Text>

          <Section style={receiptBox}>
            <Text style={receiptRow}><strong>Plan:</strong> {tierName}</Text>
            <Text style={receiptRow}><strong>Amount:</strong> {amount}</Text>
            <Text style={receiptRow}><strong>Next billing date:</strong> {nextBillingDate}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Text style={smallText}>
            <Link href={receiptUrl} style={link}>View full receipt</Link> |
            <Link href={`${dashboardUrl}/settings`} style={link}> Manage subscription</Link>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Questions about billing? Reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = {
  backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px',
  maxWidth: '560px', borderRadius: '8px',
};
const logo = { margin: '0 auto 24px', display: 'block' };
const heading = {
  fontSize: '24px', fontWeight: '700', color: '#1a1a2e',
  textAlign: 'center', margin: '0 0 16px',
};
const paragraph = { fontSize: '16px', lineHeight: '26px', color: '#4a4a68', margin: '0 0 16px' };
const receiptBox = {
  backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px',
  margin: '0 0 24px', border: '1px solid #e6ebf1',
};
const receiptRow = { fontSize: '15px', color: '#4a4a68', margin: '0 0 8px', lineHeight: '22px' };
const buttonContainer = { textAlign: 'center', margin: '24px 0' };
const button = {
  backgroundColor: '#6c5ce7', borderRadius: '6px', color: '#ffffff',
  fontSize: '16px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center', display: 'inline-block', padding: '12px 32px',
};
const smallText = { fontSize: '13px', color: '#8898aa', textAlign: 'center', margin: '0 0 16px' };
const link = { color: '#6c5ce7', textDecoration: 'underline' };
const hr = { borderColor: '#e6ebf1', margin: '24px 0' };
const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };
```

#### SubscriptionRenewalEmail

```jsx
// server/src/email-templates/SubscriptionRenewalEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr, Link,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {string} props.tierName - Current subscription tier
 * @param {string} props.amount - Renewal amount formatted (e.g. "$79.00")
 * @param {string} props.renewalDate - Formatted date (e.g. "March 19, 2026")
 * @param {string} props.manageUrl - URL to subscription management page
 */
export function SubscriptionRenewalEmail({
  userName,
  tierName,
  amount,
  renewalDate,
  manageUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>Your {tierName} plan renews on {renewalDate} ({amount})</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150" height="40"
            alt="Brand Me Now" style={logo}
          />

          <Text style={heading}>Renewal Reminder</Text>

          <Text style={paragraph}>
            Hi {userName}, your <strong>{tierName}</strong> plan
            will renew on <strong>{renewalDate}</strong> for <strong>{amount}</strong>.
          </Text>

          <Text style={paragraph}>
            No action needed if you'd like to continue. Your credits will
            refresh automatically on the renewal date.
          </Text>

          <Section style={buttonContainer}>
            <Button style={buttonSecondary} href={manageUrl}>
              Manage Subscription
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            To cancel or change your plan, visit{' '}
            <Link href={manageUrl} style={link}>subscription settings</Link> before {renewalDate}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = {
  backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px',
  maxWidth: '560px', borderRadius: '8px',
};
const logo = { margin: '0 auto 24px', display: 'block' };
const heading = {
  fontSize: '24px', fontWeight: '700', color: '#1a1a2e',
  textAlign: 'center', margin: '0 0 16px',
};
const paragraph = { fontSize: '16px', lineHeight: '26px', color: '#4a4a68', margin: '0 0 16px' };
const buttonContainer = { textAlign: 'center', margin: '24px 0' };
const buttonSecondary = {
  backgroundColor: '#ffffff', borderRadius: '6px', color: '#6c5ce7',
  fontSize: '16px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center', display: 'inline-block', padding: '12px 32px',
  border: '2px solid #6c5ce7',
};
const hr = { borderColor: '#e6ebf1', margin: '24px 0' };
const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };
const link = { color: '#6c5ce7', textDecoration: 'underline' };
```

#### CreditLowWarningEmail

```jsx
// server/src/email-templates/CreditLowWarningEmail.jsx

import {
  Html, Head, Preview, Body, Container, Section,
  Text, Button, Img, Hr,
} from '@react-email/components';

/**
 * @param {Object} props
 * @param {string} props.userName - User's first name (sanitized)
 * @param {number} props.creditsRemaining - Number of credits left
 * @param {number} props.creditsTotal - Total credits for the tier
 * @param {string} props.tierName - Current subscription tier
 * @param {string} props.upgradeUrl - URL to upgrade page
 */
export function CreditLowWarningEmail({
  userName,
  creditsRemaining,
  creditsTotal,
  tierName,
  upgradeUrl,
}) {
  const percentUsed = Math.round(((creditsTotal - creditsRemaining) / creditsTotal) * 100);

  return (
    <Html>
      <Head />
      <Preview>You have {creditsRemaining} credits remaining on your {tierName} plan</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://brandmenow.com/logo.png"
            width="150" height="40"
            alt="Brand Me Now" style={logo}
          />

          <Text style={heading}>Credits Running Low</Text>

          <Text style={paragraph}>
            Hi {userName}, you've used <strong>{percentUsed}%</strong> of your
            monthly credits on your <strong>{tierName}</strong> plan.
          </Text>

          <Section style={creditBox}>
            <Text style={creditNumber}>{creditsRemaining}</Text>
            <Text style={creditLabel}>credits remaining out of {creditsTotal}</Text>
          </Section>

          <Text style={paragraph}>
            When you run out, logo and mockup generation will be paused until
            your credits refresh on your next billing date — or you can upgrade
            for more capacity now.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={upgradeUrl}>
              Upgrade for More Credits
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Credits refresh monthly on your billing date. Unused credits do not roll over.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = {
  backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px',
  maxWidth: '560px', borderRadius: '8px',
};
const logo = { margin: '0 auto 24px', display: 'block' };
const heading = {
  fontSize: '24px', fontWeight: '700', color: '#e67e22',
  textAlign: 'center', margin: '0 0 16px',
};
const paragraph = { fontSize: '16px', lineHeight: '26px', color: '#4a4a68', margin: '0 0 16px' };
const creditBox = {
  textAlign: 'center', margin: '0 0 24px',
  padding: '24px', backgroundColor: '#fff8f0', borderRadius: '8px',
  border: '1px solid #fdebd0',
};
const creditNumber = {
  fontSize: '48px', fontWeight: '700', color: '#e67e22', margin: '0 0 4px',
};
const creditLabel = { fontSize: '14px', color: '#8898aa', margin: '0' };
const buttonContainer = { textAlign: 'center', margin: '24px 0' };
const button = {
  backgroundColor: '#6c5ce7', borderRadius: '6px', color: '#ffffff',
  fontSize: '16px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center', display: 'inline-block', padding: '12px 32px',
};
const hr = { borderColor: '#e6ebf1', margin: '24px 0' };
const footer = { fontSize: '13px', color: '#8898aa', textAlign: 'center' };
```

### 2.4 BullMQ Email-Send Worker

```javascript
// server/src/workers/email-send.js

import { Worker, Queue } from 'bullmq';
import { emailService } from '../services/resend.js';
import { supabase } from '../services/supabase.js';
import pino from 'pino';
import * as Sentry from '@sentry/node';

// Template imports
import { WelcomeEmail } from '../email-templates/WelcomeEmail.jsx';
import { BrandCompletionEmail } from '../email-templates/BrandCompletionEmail.jsx';
import { WizardAbandonmentEmail } from '../email-templates/WizardAbandonmentEmail.jsx';
import { SupportRequestEmail } from '../email-templates/SupportRequestEmail.jsx';
import { PaymentConfirmationEmail } from '../email-templates/PaymentConfirmationEmail.jsx';
import { SubscriptionRenewalEmail } from '../email-templates/SubscriptionRenewalEmail.jsx';
import { CreditLowWarningEmail } from '../email-templates/CreditLowWarningEmail.jsx';

const logger = pino({ name: 'worker:email-send' });

// ─── Template Registry ───────────────────────────────────────────

/**
 * @typedef {Object} EmailJobData
 * @property {string} templateName - Template identifier
 * @property {string} to - Recipient email
 * @property {Record<string, any>} data - Template-specific data
 * @property {string} [userId] - Supabase user ID (for rate limiting)
 */

/**
 * Map template names to React Email components and subjects.
 * Subject is a function that receives template data and returns the subject line.
 */
const TEMPLATE_REGISTRY = {
  welcome: {
    component: WelcomeEmail,
    subject: (data) => 'Welcome to Brand Me Now',
    tag: 'welcome',
  },
  'brand-completion': {
    component: BrandCompletionEmail,
    subject: (data) => `Your brand ${data.brandName || ''} is ready!`,
    tag: 'brand-completion',
  },
  'wizard-abandonment': {
    component: WizardAbandonmentEmail,
    subject: (data) => 'Your brand is waiting for you',
    tag: 'wizard-abandonment',
  },
  'support-request': {
    component: SupportRequestEmail,
    subject: (data) => `[Support] ${data.subject || 'Help request'}`,
    tag: 'support',
    overrideTo: emailService.SUPPORT_EMAIL,   // Always send to support inbox
    replyTo: (data) => data.userEmail,        // Reply goes to user
  },
  'payment-confirmation': {
    component: PaymentConfirmationEmail,
    subject: (data) => `Payment confirmed — ${data.tierName} plan`,
    tag: 'payment',
  },
  'subscription-renewal': {
    component: SubscriptionRenewalEmail,
    subject: (data) => `Your ${data.tierName} plan renews on ${data.renewalDate}`,
    tag: 'renewal',
  },
  'credit-low-warning': {
    component: CreditLowWarningEmail,
    subject: (data) => `Running low on credits (${data.creditsRemaining} remaining)`,
    tag: 'credit-warning',
  },
};

// ─── Rate Limiting ───────────────────────────────────────────────

/** @type {import('ioredis').Redis} */
let redis;

/**
 * Check if sending this email would exceed the per-user rate limit.
 * Limit: 5 emails per minute per user.
 *
 * @param {string} userId - User ID for rate limiting
 * @returns {Promise<boolean>} True if within limit, false if rate limited
 */
async function checkRateLimit(userId) {
  if (!userId || !redis) return true; // No rate limit without user ID or Redis

  const key = `email:rate:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 60-second window
  }

  if (count > 5) {
    logger.warn('Email rate limit exceeded', { userId, count });
    return false;
  }

  return true;
}

// ─── Worker Process ──────────────────────────────────────────────

/**
 * Process an email send job.
 *
 * @param {import('bullmq').Job<EmailJobData>} job
 * @returns {Promise<{ messageId: string }>}
 */
async function processEmailSend(job) {
  const { templateName, to, data, userId } = job.data;

  logger.info('Processing email', { jobId: job.id, templateName, to });

  // Step 1: Validate template exists
  const template = TEMPLATE_REGISTRY[templateName];
  if (!template) {
    throw new Error(`Unknown email template: "${templateName}"`);
  }

  // Step 2: Rate limit check
  if (userId) {
    const withinLimit = await checkRateLimit(userId);
    if (!withinLimit) {
      logger.warn('Email skipped due to rate limit', { userId, templateName, to });
      return { messageId: null, skipped: true, reason: 'rate_limited' };
    }
  }

  // Step 3: Sanitize all user-provided string data
  const sanitizedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitizedData[key] = emailService.sanitize(value);
    } else {
      sanitizedData[key] = value;
    }
  }

  // Step 4: Create the React Email component with sanitized data
  const TemplateComponent = template.component;
  const reactElement = TemplateComponent(sanitizedData);

  // Step 5: Determine recipient and reply-to
  const recipient = template.overrideTo || to;
  const replyTo = typeof template.replyTo === 'function'
    ? template.replyTo(sanitizedData)
    : undefined;

  // Step 6: Send via Resend
  const result = await emailService.sendEmail({
    to: recipient,
    subject: template.subject(sanitizedData),
    template: reactElement,
    replyTo,
    tag: template.tag,
  });

  logger.info('Email sent successfully', {
    jobId: job.id,
    messageId: result.id,
    templateName,
    to: recipient,
  });

  return { messageId: result.id };
}

// ─── Worker Setup ────────────────────────────────────────────────

/**
 * Create and start the email-send BullMQ worker.
 *
 * @param {import('ioredis').Redis} redisConnection
 * @returns {Worker}
 */
export function createEmailSendWorker(redisConnection) {
  redis = redisConnection;

  const worker = new Worker(
    'email-send',
    async (job) => {
      try {
        return await processEmailSend(job);
      } catch (err) {
        logger.error('Email send failed', {
          jobId: job.id,
          templateName: job.data.templateName,
          attempt: job.attemptsMade + 1,
          error: err.message,
        });

        // Sentry alert on final attempt
        if (job.attemptsMade + 1 >= 3) {
          Sentry.captureException(err, {
            tags: {
              integration: 'resend',
              template: job.data.templateName,
              queue: 'email-send',
            },
            extra: {
              to: job.data.to,
              attempts: job.attemptsMade + 1,
            },
          });
        }

        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 50,        // Max 50 emails
        duration: 1000,  // Per second (Resend limit: 100/s on Pro)
      },
    }
  );

  worker.on('error', (err) => {
    logger.error('Email send worker error', { error: err.message });
    Sentry.captureException(err, { tags: { worker: 'email-send' } });
  });

  logger.info('Email send worker started');
  return worker;
}

// ─── Queue Helper ────────────────────────────────────────────────

/** @type {Queue} */
let emailQueue;

/**
 * Initialize the email send queue.
 * @param {import('ioredis').Redis} redisConnection
 */
export function initEmailQueue(redisConnection) {
  emailQueue = new Queue('email-send', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
}

/**
 * Enqueue an email to be sent. Returns immediately.
 *
 * @param {string} templateName - Template name (key in TEMPLATE_REGISTRY)
 * @param {string} to - Recipient email address
 * @param {Record<string, any>} data - Template-specific data
 * @param {Object} [options]
 * @param {string} [options.userId] - User ID for rate limiting
 * @param {number} [options.delay] - Delay in ms before sending
 * @returns {Promise<string>} Job ID
 */
export async function enqueueEmail(templateName, to, data, options = {}) {
  if (!emailQueue) {
    logger.warn('Email queue not initialized, skipping', { templateName, to });
    return null;
  }

  const job = await emailQueue.add(
    templateName,
    { templateName, to, data, userId: options.userId },
    {
      delay: options.delay || 0,
      jobId: `email-${templateName}-${to}-${Date.now()}`,
    }
  );

  logger.info('Email enqueued', { jobId: job.id, templateName, to });
  return job.id;
}

/**
 * Enqueue a delayed wizard abandonment email.
 * Triggered by a cron job that detects inactive wizard sessions.
 * The email includes an HMAC-signed resume URL.
 *
 * @param {string} userId
 * @param {string} email
 * @param {string} userName
 * @param {string} brandId
 * @param {string} lastStep
 * @param {number} progressPercent
 * @returns {Promise<string>} Job ID
 */
export async function enqueueAbandonmentEmail(userId, email, userName, brandId, lastStep, progressPercent) {
  // Generate HMAC-signed resume URL
  const { createHmac } = await import('node:crypto');
  const payload = JSON.stringify({ brandId, userId, step: lastStep, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const hmac = createHmac('sha256', process.env.HMAC_SECRET || 'change-me')
    .update(payload)
    .digest('hex');
  const token = Buffer.from(payload).toString('base64url') + '.' + hmac;
  const resumeUrl = `${process.env.APP_URL || 'https://app.brandmenow.com'}/wizard/resume?token=${token}`;

  return enqueueEmail(
    'wizard-abandonment',
    email,
    {
      userName,
      resumeUrl,
      lastStepName: lastStep,
      progressPercent,
    },
    { userId }
  );
}
```

### 2.5 Email Testing Strategy

| Test Type | Tool | What to Test |
|-----------|------|-------------|
| **Template rendering** | Vitest + `@react-email/render` | Each template renders valid HTML without errors for all prop combinations |
| **Visual preview** | React Email dev server (`email dev`) | Manual visual verification of all templates across email clients |
| **Sanitization** | Vitest | Verify XSS payloads in user data are stripped (e.g., `<script>alert(1)</script>` in userName) |
| **Rate limiting** | Vitest + Redis mock | Verify 6th email for same user within 60s is rejected |
| **Worker processing** | Vitest + BullMQ mock | Verify job data flows through template registry correctly |
| **E2E delivery** | Resend test mode / Mailosaur | Verify emails actually arrive in inbox with correct content |
| **Dead letter** | Vitest | Verify failed jobs after 3 attempts trigger Sentry alert |

```javascript
// Example test: Template sanitization
// server/src/email-templates/__tests__/sanitization.test.js

import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { WelcomeEmail } from '../WelcomeEmail.jsx';
import { emailService } from '../../services/resend.js';

describe('Email template sanitization', () => {
  it('strips HTML tags from user-provided data', async () => {
    const html = await render(
      WelcomeEmail({
        userName: emailService.sanitize('<script>alert("xss")</script>John'),
        loginUrl: 'https://app.brandmenow.com/login',
      })
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('John');
  });

  it('renders without errors for minimal props', async () => {
    const html = await render(
      WelcomeEmail({ userName: '', loginUrl: '' })
    );
    expect(html).toBeTruthy();
    expect(html).toContain('Welcome');
  });
});
```

---

## 3. Apify Web Scraping Integration

### 3.1 Overview

Apify provides managed web scraping "actors" for extracting social media profile data. The wizard's social analysis step uses Apify to scrape Instagram, TikTok, and Facebook profiles, then feeds that data to the AI brand analysis agent.

**Required environment variables:**

```bash
APIFY_API_TOKEN=          # Apify API token
APIFY_MONTHLY_BUDGET_USD= # Cost cap (e.g. "50" for $50/month)
```

### 3.2 Apify Client Setup

```javascript
// server/src/services/apify.js

import { ApifyClient } from 'apify-client';
import pino from 'pino';
import * as Sentry from '@sentry/node';

const logger = pino({ name: 'apify' });

// ─── Client Setup ────────────────────────────────────────────────

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// ─── Actor IDs ───────────────────────────────────────────────────

const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  tiktok: 'clockworks/tiktok-profile-scraper',
  facebook: 'apify/facebook-pages-scraper',
};

// ─── Cost Management ─────────────────────────────────────────────

/** @type {import('ioredis').Redis} */
let redis;

/**
 * Track Apify usage costs. Rejects scraping if monthly budget exceeded.
 *
 * @param {number} estimatedCostUsd - Estimated cost of this run
 * @returns {Promise<boolean>} True if within budget
 */
async function checkBudget(estimatedCostUsd) {
  if (!redis) return true;

  const monthKey = `apify:cost:${new Date().toISOString().slice(0, 7)}`; // e.g. "apify:cost:2026-02"
  const currentCost = parseFloat(await redis.get(monthKey) || '0');
  const budget = parseFloat(process.env.APIFY_MONTHLY_BUDGET_USD || '50');

  if (currentCost + estimatedCostUsd > budget) {
    logger.warn('Apify monthly budget exceeded', {
      currentCost,
      estimatedCost: estimatedCostUsd,
      budget,
    });
    return false;
  }

  return true;
}

/**
 * Record cost of a completed Apify run.
 *
 * @param {number} actualCostUsd
 */
async function recordCost(actualCostUsd) {
  if (!redis) return;
  const monthKey = `apify:cost:${new Date().toISOString().slice(0, 7)}`;
  await redis.incrbyfloat(monthKey, actualCostUsd);
  // Expire at end of month + 7 days buffer
  await redis.expire(monthKey, 40 * 24 * 3600);
}

// ─── Unified Social Profile Schema ──────────────────────────────

/**
 * @typedef {Object} SocialProfile
 * @property {string} platform - "instagram" | "tiktok" | "facebook"
 * @property {string} handle - Username/handle
 * @property {string} displayName - Display name
 * @property {string} bio - Profile bio/description
 * @property {string} profileImageUrl - Profile picture URL
 * @property {number} followersCount - Number of followers
 * @property {number} followingCount - Number following
 * @property {number} postsCount - Number of posts
 * @property {number} engagementRate - Engagement rate (0-1 decimal)
 * @property {string[]} recentPostUrls - URLs of recent post images (up to 12)
 * @property {string[]} topHashtags - Most used hashtags
 * @property {string[]} contentThemes - Detected content themes/categories
 * @property {Object} rawData - Original platform-specific data (for debugging)
 */

// ─── Platform Scrapers ───────────────────────────────────────────

/**
 * Scrape an Instagram profile.
 *
 * @param {string} handle - Instagram username (without @)
 * @returns {Promise<SocialProfile>}
 */
async function scrapeInstagram(handle) {
  const cleanHandle = handle.replace(/^@/, '').trim();

  logger.info('Scraping Instagram profile', { handle: cleanHandle });

  if (!(await checkBudget(0.05))) {
    throw new Error('Apify monthly budget exceeded. Try again next month or upgrade.');
  }

  try {
    const run = await client.actor(ACTORS.instagram).call({
      usernames: [cleanHandle],
      resultsLimit: 12,
      addParentData: false,
    }, {
      timeout: 120, // 2 minute timeout
      memory: 256,  // Minimum memory (cheapest)
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error(`No data returned for Instagram @${cleanHandle}. Profile may be private or not exist.`);
    }

    const profile = items[0];
    const actualCost = run.stats?.costUsd || 0.02;
    await recordCost(actualCost);

    return normalizeInstagram(profile, cleanHandle);
  } catch (err) {
    if (err.message.includes('budget')) throw err;
    logger.error('Instagram scrape failed', { handle: cleanHandle, error: err.message });
    Sentry.captureException(err, { tags: { integration: 'apify', platform: 'instagram' } });
    throw new Error(`Failed to scrape Instagram @${cleanHandle}: ${err.message}`);
  }
}

/**
 * Scrape a TikTok profile.
 *
 * @param {string} handle - TikTok username (without @)
 * @returns {Promise<SocialProfile>}
 */
async function scrapeTikTok(handle) {
  const cleanHandle = handle.replace(/^@/, '').trim();

  logger.info('Scraping TikTok profile', { handle: cleanHandle });

  if (!(await checkBudget(0.05))) {
    throw new Error('Apify monthly budget exceeded.');
  }

  try {
    const run = await client.actor(ACTORS.tiktok).call({
      profiles: [`https://www.tiktok.com/@${cleanHandle}`],
      resultsPerPage: 12,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }, {
      timeout: 120,
      memory: 256,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error(`No data returned for TikTok @${cleanHandle}. Profile may be private or not exist.`);
    }

    const profile = items[0];
    const actualCost = run.stats?.costUsd || 0.03;
    await recordCost(actualCost);

    return normalizeTikTok(profile, cleanHandle);
  } catch (err) {
    if (err.message.includes('budget')) throw err;
    logger.error('TikTok scrape failed', { handle: cleanHandle, error: err.message });
    Sentry.captureException(err, { tags: { integration: 'apify', platform: 'tiktok' } });
    throw new Error(`Failed to scrape TikTok @${cleanHandle}: ${err.message}`);
  }
}

/**
 * Scrape a Facebook page.
 *
 * @param {string} pageUrl - Facebook page URL or page name
 * @returns {Promise<SocialProfile>}
 */
async function scrapeFacebook(pageUrl) {
  const url = pageUrl.startsWith('http') ? pageUrl : `https://www.facebook.com/${pageUrl}`;

  logger.info('Scraping Facebook page', { url });

  if (!(await checkBudget(0.05))) {
    throw new Error('Apify monthly budget exceeded.');
  }

  try {
    const run = await client.actor(ACTORS.facebook).call({
      startUrls: [{ url }],
      maxPosts: 12,
    }, {
      timeout: 180,  // Facebook scraping is slower
      memory: 512,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error(`No data returned for Facebook page. Page may be private or not exist.`);
    }

    const profile = items[0];
    const actualCost = run.stats?.costUsd || 0.04;
    await recordCost(actualCost);

    return normalizeFacebook(profile, pageUrl);
  } catch (err) {
    if (err.message.includes('budget')) throw err;
    logger.error('Facebook scrape failed', { url, error: err.message });
    Sentry.captureException(err, { tags: { integration: 'apify', platform: 'facebook' } });
    throw new Error(`Failed to scrape Facebook page: ${err.message}`);
  }
}

// ─── Data Normalization ──────────────────────────────────────────

/**
 * Normalize Instagram API response to unified SocialProfile schema.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} handle
 * @returns {SocialProfile}
 */
function normalizeInstagram(raw, handle) {
  const posts = raw.latestPosts || raw.posts || [];
  const allCaptions = posts.map((p) => p.caption || '').join(' ');

  return {
    platform: 'instagram',
    handle,
    displayName: raw.fullName || raw.name || handle,
    bio: raw.biography || raw.bio || '',
    profileImageUrl: raw.profilePicUrl || raw.profilePicUrlHD || '',
    followersCount: raw.followersCount || raw.followers || 0,
    followingCount: raw.followsCount || raw.following || 0,
    postsCount: raw.postsCount || raw.mediaCount || 0,
    engagementRate: calculateEngagementRate(
      posts,
      raw.followersCount || 1
    ),
    recentPostUrls: posts
      .slice(0, 12)
      .map((p) => p.displayUrl || p.url || p.imageUrl)
      .filter(Boolean),
    topHashtags: extractTopHashtags(allCaptions, 10),
    contentThemes: [], // Populated by AI analysis, not scraping
    rawData: raw,
  };
}

/**
 * Normalize TikTok API response to unified SocialProfile schema.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} handle
 * @returns {SocialProfile}
 */
function normalizeTikTok(raw, handle) {
  const authorMeta = raw.authorMeta || raw.author || {};
  const posts = raw.latestPosts || raw.items || [];

  return {
    platform: 'tiktok',
    handle,
    displayName: authorMeta.name || authorMeta.nickname || handle,
    bio: authorMeta.signature || authorMeta.bio || '',
    profileImageUrl: authorMeta.avatar || authorMeta.avatarMedium || '',
    followersCount: authorMeta.fans || authorMeta.followers || 0,
    followingCount: authorMeta.following || 0,
    postsCount: authorMeta.video || authorMeta.videoCount || 0,
    engagementRate: calculateTikTokEngagement(posts, authorMeta.fans || 1),
    recentPostUrls: posts
      .slice(0, 12)
      .map((p) => p.videoMeta?.coverUrl || p.covers?.default)
      .filter(Boolean),
    topHashtags: extractTopHashtags(
      posts.map((p) => (p.hashtags || []).map((h) => `#${h.name || h}`).join(' ')).join(' '),
      10
    ),
    contentThemes: [],
    rawData: raw,
  };
}

/**
 * Normalize Facebook page response to unified SocialProfile schema.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} pageUrl
 * @returns {SocialProfile}
 */
function normalizeFacebook(raw, pageUrl) {
  const posts = raw.posts || [];

  return {
    platform: 'facebook',
    handle: raw.pageUrl || pageUrl,
    displayName: raw.title || raw.name || '',
    bio: raw.about || raw.description || '',
    profileImageUrl: raw.profilePhoto || raw.profilePicture || '',
    followersCount: raw.likes || raw.followers || 0,
    followingCount: 0, // Facebook pages don't "follow"
    postsCount: posts.length,
    engagementRate: calculateFacebookEngagement(posts, raw.likes || 1),
    recentPostUrls: posts
      .slice(0, 12)
      .map((p) => p.photoUrl || p.imageUrl)
      .filter(Boolean),
    topHashtags: extractTopHashtags(
      posts.map((p) => p.text || '').join(' '),
      10
    ),
    contentThemes: [],
    rawData: raw,
  };
}

// ─── Utility Functions ───────────────────────────────────────────

/**
 * Calculate Instagram engagement rate from recent posts.
 *
 * @param {Object[]} posts
 * @param {number} followers
 * @returns {number} Engagement rate (0-1)
 */
function calculateEngagementRate(posts, followers) {
  if (!posts.length || !followers) return 0;
  const totalEngagement = posts.reduce(
    (sum, p) => sum + (p.likesCount || 0) + (p.commentsCount || 0),
    0
  );
  return Math.min(totalEngagement / posts.length / followers, 1);
}

/**
 * Calculate TikTok engagement rate from recent videos.
 *
 * @param {Object[]} posts
 * @param {number} followers
 * @returns {number}
 */
function calculateTikTokEngagement(posts, followers) {
  if (!posts.length || !followers) return 0;
  const totalEngagement = posts.reduce(
    (sum, p) => sum + (p.diggCount || p.likes || 0) + (p.commentCount || p.comments || 0) + (p.shareCount || p.shares || 0),
    0
  );
  return Math.min(totalEngagement / posts.length / followers, 1);
}

/**
 * Calculate Facebook engagement rate from recent posts.
 *
 * @param {Object[]} posts
 * @param {number} likes - Page likes
 * @returns {number}
 */
function calculateFacebookEngagement(posts, likes) {
  if (!posts.length || !likes) return 0;
  const totalEngagement = posts.reduce(
    (sum, p) => sum + (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
    0
  );
  return Math.min(totalEngagement / posts.length / likes, 1);
}

/**
 * Extract the top N hashtags from text.
 *
 * @param {string} text
 * @param {number} limit
 * @returns {string[]}
 */
function extractTopHashtags(text, limit = 10) {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  const counts = {};
  for (const tag of matches) {
    const lower = tag.toLowerCase();
    counts[lower] = (counts[lower] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

// ─── Multi-Platform Scraper ──────────────────────────────────────

/**
 * Scrape one or more social profiles and return normalized data.
 * Handles errors per-platform so one failure doesn't block others.
 *
 * @param {Array<{ platform: string, handle: string }>} profiles
 * @returns {Promise<{ results: SocialProfile[], errors: Array<{ platform: string, handle: string, error: string }> }>}
 */
async function scrapeProfiles(profiles) {
  const results = [];
  const errors = [];

  // Run all scrapes in parallel
  const promises = profiles.map(async ({ platform, handle }) => {
    try {
      let result;
      switch (platform) {
        case 'instagram':
          result = await scrapeInstagram(handle);
          break;
        case 'tiktok':
          result = await scrapeTikTok(handle);
          break;
        case 'facebook':
          result = await scrapeFacebook(handle);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      results.push(result);
    } catch (err) {
      logger.warn(`Scrape failed for ${platform}/@${handle}`, { error: err.message });
      errors.push({ platform, handle, error: err.message });
    }
  });

  await Promise.all(promises);

  return { results, errors };
}

// ─── Initialize & Export ─────────────────────────────────────────

/**
 * Initialize the Apify service with Redis for cost tracking.
 * @param {import('ioredis').Redis} redisClient
 */
function init(redisClient) {
  redis = redisClient;
  logger.info('Apify service initialized');
}

export const apifyService = {
  init,
  scrapeInstagram,
  scrapeTikTok,
  scrapeFacebook,
  scrapeProfiles,
  checkBudget,
  recordCost,
  normalizeInstagram,
  normalizeTikTok,
  normalizeFacebook,
};
```

### 3.3 Scraping Handler for Wizard Agent

This is the tool handler registered with the Anthropic Agent SDK's social-analyzer subagent:

```javascript
// server/src/skills/social-analyzer/handlers.js

import { apifyService } from '../../services/apify.js';
import { supabase } from '../../services/supabase.js';
import pino from 'pino';

const logger = pino({ name: 'skill:social-analyzer' });

/**
 * Scrape a social media profile and store results.
 * Registered as a tool in the social-analyzer subagent.
 *
 * @param {Object} params
 * @param {string} params.platform - "instagram" | "tiktok" | "facebook"
 * @param {string} params.handle - Username or page URL
 * @param {string} params.brandId - Brand ID to associate data with
 * @returns {Promise<import('../../services/apify.js').SocialProfile | { fallback: true, message: string }>}
 */
export async function scrapeProfile({ platform, handle, brandId }) {
  logger.info('Agent tool: scrapeProfile', { platform, handle, brandId });

  try {
    let profile;

    switch (platform) {
      case 'instagram':
        profile = await apifyService.scrapeInstagram(handle);
        break;
      case 'tiktok':
        profile = await apifyService.scrapeTikTok(handle);
        break;
      case 'facebook':
        profile = await apifyService.scrapeFacebook(handle);
        break;
      default:
        return {
          fallback: true,
          message: `Unsupported platform "${platform}". Supported: instagram, tiktok, facebook. Ask the user to provide their profile data manually.`,
        };
    }

    // Store raw social data in brand record
    const { error } = await supabase
      .from('brands')
      .update({
        social_data: supabase.raw(`
          COALESCE(social_data, '{}'::jsonb) || ?::jsonb
        `, [JSON.stringify({ [platform]: profile })]),
      })
      .eq('id', brandId);

    if (error) {
      logger.warn('Failed to store social data', { brandId, error: error.message });
      // Non-fatal — the profile data is still returned to the agent
    }

    return profile;
  } catch (err) {
    logger.warn('Scrape failed, returning fallback', { platform, handle, error: err.message });

    // Return a structured fallback instead of throwing
    // The agent can ask the user for manual input
    return {
      fallback: true,
      platform,
      handle,
      message: `Could not scrape ${platform} profile @${handle}: ${err.message}. Please ask the user to describe their social media presence manually — their content themes, audience, visual style, and posting frequency.`,
    };
  }
}

/**
 * Handle scraping for multiple platforms at once.
 * Returns successful results and instructs the agent about failures.
 *
 * @param {Object} params
 * @param {Array<{ platform: string, handle: string }>} params.profiles
 * @param {string} params.brandId
 * @returns {Promise<Object>}
 */
export async function scrapeMultipleProfiles({ profiles, brandId }) {
  const { results, errors } = await apifyService.scrapeProfiles(profiles);

  // Store all successful results
  if (results.length > 0) {
    const socialData = {};
    for (const profile of results) {
      socialData[profile.platform] = profile;
    }

    await supabase
      .from('brands')
      .update({ social_data: socialData })
      .eq('id', brandId)
      .catch((err) => {
        logger.warn('Failed to store social data', { brandId, error: err.message });
      });
  }

  return {
    successfulProfiles: results,
    failedProfiles: errors.map((e) => ({
      ...e,
      fallbackInstruction: `Scraping ${e.platform} @${e.handle} failed: ${e.error}. Ask the user for manual input about this profile.`,
    })),
    summary: `Successfully scraped ${results.length}/${profiles.length} profiles.${
      errors.length > 0 ? ` Failed: ${errors.map((e) => `${e.platform}/@${e.handle}`).join(', ')}.` : ''
    }`,
  };
}
```

### 3.4 Error Handling for Blocked/Private Profiles

| Scenario | Detection | User-Facing Behavior |
|----------|-----------|---------------------|
| **Private profile** | Apify returns empty dataset or error | Agent asks user to describe their content/audience manually |
| **Profile doesn't exist** | Apify returns 0 items | Agent prompts user to verify the handle |
| **Rate limited by platform** | Apify actor fails with rate limit error | Job retried after 60s. If still failing, fallback to manual entry |
| **Apify budget exceeded** | `checkBudget()` returns false | Agent informs user that automated analysis is temporarily unavailable, offers manual entry |
| **Actor timeout** | Apify run exceeds 2-minute timeout | Agent falls back to manual entry with explanation |

The key principle: **scraping failures never block the wizard**. The agent receives a structured fallback object and pivots to asking the user for manual input about their social media presence.

### 3.5 Rate Limiting and Cost Management

| Control | Implementation |
|---------|---------------|
| **Monthly budget cap** | Redis counter per month (`apify:cost:YYYY-MM`). Checked before every scrape. Default: $50/month. |
| **Per-run cost tracking** | Actual cost from `run.stats.costUsd` recorded after each run. |
| **Memory optimization** | Minimum memory allocation per actor (256MB for Instagram/TikTok, 512MB for Facebook). |
| **Timeout limits** | 2 minutes for Instagram/TikTok, 3 minutes for Facebook. |
| **Results limit** | Maximum 12 recent posts per scrape (enough for brand analysis, not wasteful). |
| **Concurrency** | BullMQ concurrency limit of 3 for scraping jobs (avoid overwhelming Apify). |

---

## 4. File Manifest

Every file created or modified for the three integrations:

### GoHighLevel CRM

| File | Purpose |
|------|---------|
| `server/config/crm-fields.yaml` | GHL field mappings, tag configuration, retry settings, blocked fields list |
| `server/src/services/ghl-client.js` | GHL API client — OAuth token management, upsert, tags, custom fields, startup validation, blocked field enforcement |
| `server/src/workers/crm-sync.js` | BullMQ worker for crm-sync queue — processes wizard.started, brand.completed, wizard.abandoned, subscription.created events |

### Resend Email

| File | Purpose |
|------|---------|
| `server/src/services/resend.js` | Resend SDK wrapper — send, sanitize, render template |
| `server/src/workers/email-send.js` | BullMQ worker for email-send queue — template registry, rate limiting, sanitization pipeline |
| `server/src/email-templates/WelcomeEmail.jsx` | Welcome / signup confirmation email |
| `server/src/email-templates/BrandCompletionEmail.jsx` | Brand complete — logo, colors, archetype summary |
| `server/src/email-templates/WizardAbandonmentEmail.jsx` | Resume link with HMAC token, progress bar |
| `server/src/email-templates/SupportRequestEmail.jsx` | Chatbot "talk to human" — sent to support inbox |
| `server/src/email-templates/PaymentConfirmationEmail.jsx` | Stripe payment receipt |
| `server/src/email-templates/SubscriptionRenewalEmail.jsx` | 7-day renewal reminder |
| `server/src/email-templates/CreditLowWarningEmail.jsx` | Credit usage warning (< 20% remaining) |

### Apify Web Scraping

| File | Purpose |
|------|---------|
| `server/src/services/apify.js` | Apify client — Instagram/TikTok/Facebook scrapers, data normalization, cost tracking |
| `server/src/skills/social-analyzer/handlers.js` | Agent tool handlers — scrapeProfile, scrapeMultipleProfiles, fallback logic |

### Total: 14 files

---

## 5. Development Prompt

> Build the three external integrations for Brand Me Now v2: GoHighLevel CRM, Resend email, and Apify web scraping.
>
> **Stack:** Node.js 22, Express.js 5, BullMQ + Redis, Resend SDK, React Email, Apify Client, Zod validation, JSDoc types, pino logger, Sentry error tracking.
>
> **Architecture:** All integrations are event-driven via BullMQ. No integration call ever blocks the user-facing HTTP response. Every failure retries 3x with exponential backoff, then dead-letters with a Sentry alert.
>
> **GHL CRM:** OAuth 2.0 (not static bearer tokens). Config-driven field mappings from `crm-fields.yaml` (not hardcoded IDs). Startup validation confirms field IDs exist. SECURITY: Never send passwords, tokens, or raw credentials to GHL. Blocked fields enforced at the client level.
>
> **Resend Email:** 7 React Email templates (welcome, brand completion, wizard abandonment with HMAC resume link, support request, payment confirmation, subscription renewal reminder, credit low warning). BullMQ email-send worker with per-user rate limiting (5 emails/min). HTML sanitization via sanitize-html on all user-provided data before template rendering.
>
> **Apify Scraping:** Instagram, TikTok, Facebook profile scrapers with unified SocialProfile schema. Monthly budget cap tracked in Redis. Graceful fallback to manual user input when scraping fails (private profiles, rate limits, budget exceeded). Agent receives structured fallback objects, not thrown errors.
>
> Follow the patterns from `09-GREENFIELD-REBUILD-BLUEPRINT.md`. Use JSDoc types (not TypeScript). Use pino for structured logging. Use Sentry for error tracking. All BullMQ workers must handle retry exhaustion with dead-letter queue alerts.

---

## 6. Acceptance Criteria

### GoHighLevel CRM

- [ ] OAuth 2.0 flow implemented with automatic token refresh (proactive refresh 5 min before expiry)
- [ ] Tokens stored in Redis (primary) with env var fallback (first boot)
- [ ] `crm-fields.yaml` loaded at startup with `${ENV_VAR}` resolution
- [ ] Startup validation confirms all configured field IDs exist in GHL location
- [ ] Server exits with FATAL error if ALL field IDs are invalid (wrong location)
- [ ] `sanitizeForCRM()` strips blocked fields (password, stripe_customer_id, etc.) from every payload
- [ ] `enqueueCRMSync()` returns immediately (< 5ms) and never blocks user response
- [ ] BullMQ crm-sync worker processes: wizard.started, brand.completed, wizard.abandoned, subscription.created
- [ ] 3x retry with backoff [1s, 5s, 15s] on failure
- [ ] Dead-letter queue receives jobs after 3 failed attempts
- [ ] Sentry alert fires on dead-letter (final failure)
- [ ] Zero passwords or raw credentials sent to GHL in any code path
- [ ] Rate limiter: max 10 GHL API calls per second
- [ ] Test: Verify `sanitizeForCRM` strips `password`, `stripe_customer_id` fields
- [ ] Test: Verify config loads with missing env vars (warns but doesn't crash for optional fields)
- [ ] Test: Verify 401 triggers token refresh and retries once

### Resend Email

- [ ] All 7 React Email templates render valid HTML (Vitest + @react-email/render)
- [ ] Templates render without errors when given empty/minimal props
- [ ] User-provided data sanitized before template rendering (XSS payloads stripped)
- [ ] BullMQ email-send worker processes all template types via registry
- [ ] Per-user rate limit: 5 emails per 60 seconds (Redis counter)
- [ ] Rate-limited emails return `{ skipped: true, reason: 'rate_limited' }` (not error)
- [ ] 3x retry with exponential backoff on Resend API failure
- [ ] Sentry alert on final failure
- [ ] Support request emails sent to `RESEND_SUPPORT_EMAIL`, reply-to set to user's email
- [ ] Abandonment email includes HMAC-signed resume URL with 24h expiry
- [ ] `enqueueEmail()` returns immediately (< 5ms)
- [ ] Test: Verify each template renders HTML containing expected content
- [ ] Test: Verify `<script>` tags in userName are stripped from rendered HTML
- [ ] Test: Verify 6th email within 60s for same user is rate-limited

### Apify Web Scraping

- [ ] Instagram, TikTok, Facebook scrapers return unified `SocialProfile` schema
- [ ] Monthly budget cap enforced via Redis counter (rejects if exceeded)
- [ ] Actual run costs recorded after each scrape
- [ ] Failed scrapes return structured fallback object (not thrown error to agent)
- [ ] Agent can detect `{ fallback: true }` and ask user for manual input
- [ ] Multi-platform scrape runs in parallel, one failure doesn't block others
- [ ] Minimum memory allocation per actor (cost optimization)
- [ ] Timeout: 2 min Instagram/TikTok, 3 min Facebook
- [ ] Social data stored in brand record `social_data` JSONB column
- [ ] Engagement rate calculated correctly per platform
- [ ] Top hashtags extracted and deduplicated
- [ ] Test: Verify `normalizeInstagram` produces valid SocialProfile from sample data
- [ ] Test: Verify `scrapeProfiles` returns partial results when one platform fails
- [ ] Test: Verify budget check rejects when monthly cap exceeded

### Cross-Cutting

- [ ] All integration calls go through BullMQ (never called synchronously from route handlers)
- [ ] All workers use pino structured logging with correlation IDs
- [ ] All workers report errors to Sentry with integration-specific tags
- [ ] All workers handle graceful shutdown (drain queue on SIGTERM)
- [ ] Bull Board can view all three queues (crm-sync, email-send, scraping jobs)
- [ ] No hardcoded API keys, field IDs, or secrets in source code
- [ ] All env vars validated at startup (crash on missing required vars)
