/**
 * Migration Utilities -- Shared helpers for v1 -> v2 data migration.
 *
 * @module scripts/migrate/lib/utils
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

// ─── Environment ────────────────────────────────────────────────────────────

/**
 * Required environment variables for migration.
 * V1_DATABASE_URL     -- Postgres connection string for the OLD Supabase project
 * V2_SUPABASE_URL     -- URL for the NEW Supabase project
 * V2_SUPABASE_SERVICE_KEY -- Service role key for the NEW Supabase project
 */
const REQUIRED_ENV = ['V1_DATABASE_URL', 'V2_SUPABASE_URL', 'V2_SUPABASE_SERVICE_KEY'];

/**
 * Validate that all required environment variables are present.
 * @throws {Error} If any required variable is missing.
 */
export const validateEnv = () => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
      'Copy .env.example to .env and fill in the values.'
    );
  }
};

// ─── Database Clients ───────────────────────────────────────────────────────

/** @type {pg.Pool | null} */
let v1Pool = null;

/**
 * Get a pg Pool connection to the v1 (source) database.
 * @returns {pg.Pool}
 */
export const getV1Client = () => {
  if (!v1Pool) {
    v1Pool = new pg.Pool({
      connectionString: process.env.V1_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return v1Pool;
};

/**
 * Close the v1 database connection pool.
 */
export const closeV1Client = async () => {
  if (v1Pool) {
    await v1Pool.end();
    v1Pool = null;
  }
};

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let v2Client = null;

/**
 * Get a Supabase admin client for the v2 (target) database.
 * Uses the service role key so RLS is bypassed during migration.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const getV2Client = () => {
  if (!v2Client) {
    v2Client = createSupabaseClient(
      process.env.V2_SUPABASE_URL,
      process.env.V2_SUPABASE_SERVICE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }
  return v2Client;
};

// ─── Batch Processor ────────────────────────────────────────────────────────

/**
 * Process an array of records in batches, calling `handler` for each batch.
 *
 * @template T
 * @param {T[]} records -- The full array to process.
 * @param {number} batchSize -- How many records per batch.
 * @param {(batch: T[], batchIndex: number) => Promise<void>} handler
 * @returns {Promise<{ total: number, processed: number, errors: Array<{batchIndex: number, error: Error}> }>}
 */
export const processBatches = async (records, batchSize, handler) => {
  const result = { total: records.length, processed: 0, errors: [] };
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const batch = records.slice(i * batchSize, (i + 1) * batchSize);
    try {
      await handler(batch, i);
      result.processed += batch.length;
    } catch (err) {
      result.errors.push({ batchIndex: i, error: err });
      log.error(`Batch ${i + 1}/${totalBatches} failed: ${err.message}`);
    }
  }

  return result;
};

// ─── Logger ─────────────────────────────────────────────────────────────────

/**
 * Simple structured logger with timing helpers.
 */
export const log = {
  /** @type {boolean} */
  verbose: false,

  /** @param {string} msg */
  info: (msg) => {
    console.log(`[INFO]  ${new Date().toISOString()}  ${msg}`);
  },

  /** @param {string} msg */
  warn: (msg) => {
    console.warn(`[WARN]  ${new Date().toISOString()}  ${msg}`);
  },

  /** @param {string} msg */
  error: (msg) => {
    console.error(`[ERROR] ${new Date().toISOString()}  ${msg}`);
  },

  /** @param {string} msg */
  debug: (msg) => {
    if (log.verbose) {
      console.log(`[DEBUG] ${new Date().toISOString()}  ${msg}`);
    }
  },

  /** @param {string} msg */
  success: (msg) => {
    console.log(`[OK]    ${new Date().toISOString()}  ${msg}`);
  },

  /**
   * Log a separator line with a heading.
   * @param {string} heading
   */
  section: (heading) => {
    const line = '─'.repeat(60);
    console.log(`\n${line}`);
    console.log(`  ${heading}`);
    console.log(`${line}\n`);
  },

  /**
   * Log a table of key-value pairs.
   * @param {Record<string, string|number>} data
   */
  table: (data) => {
    const maxKey = Math.max(...Object.keys(data).map((k) => k.length));
    for (const [key, value] of Object.entries(data)) {
      console.log(`  ${key.padEnd(maxKey + 2)} ${value}`);
    }
  },
};

// ─── Timer ──────────────────────────────────────────────────────────────────

/**
 * Create a simple timer. Call `.elapsed()` to get formatted duration.
 * @returns {{ elapsed: () => string, ms: () => number }}
 */
export const createTimer = () => {
  const start = performance.now();
  return {
    elapsed: () => {
      const ms = performance.now() - start;
      if (ms < 1000) return `${Math.round(ms)}ms`;
      if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60_000).toFixed(1)}m`;
    },
    ms: () => performance.now() - start,
  };
};

// ─── Dry-Run Support ────────────────────────────────────────────────────────

/**
 * Check whether the current run is a dry run.
 * @returns {boolean}
 */
export const isDryRun = () => {
  return process.argv.includes('--dry-run');
};

/**
 * Parse CLI flags common to all migration scripts.
 * @returns {{ dryRun: boolean, verbose: boolean, batchSize: number }}
 */
export const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 100;

  if (verbose) {
    log.verbose = true;
  }

  return { dryRun, verbose, batchSize };
};

// ─── Wizard Step Mapping ────────────────────────────────────────────────────

/**
 * Map v1 wizard_step values to v2 text enum values.
 *
 * v1 used TWO formats:
 *   1. Integer steps (0-12) -- from the old Supabase brand builder
 *   2. GHL tag strings -- from GoHighLevel CRM sync
 *
 * v2 uses URL-path-style text: 'onboarding', 'social-analysis', etc.
 */

/** @type {Record<number, string>} */
const INT_TO_V2_STEP = {
  0: 'onboarding',
  1: 'onboarding',
  2: 'social-analysis',
  3: 'brand-identity',
  4: 'customization',
  5: 'logo-generation',
  6: 'logo-refinement',
  7: 'product-selection',
  8: 'mockup-review',
  9: 'bundle-builder',
  10: 'profit-calculator',
  11: 'checkout',
  12: 'complete',
};

/** @type {Record<string, string>} */
const GHL_TAG_TO_V2_STEP = {
  'brand-builder-started': 'onboarding',
  'brand-identity-defined': 'brand-identity',
  'logo-and-name-selected': 'logo-generation',
  'products-and-mockups-created': 'mockup-review',
  'brand-submitted-for-review': 'complete',
};

/**
 * Convert a v1 wizard_step (int or GHL tag string) to a v2 text value.
 * @param {number|string|null|undefined} v1Step
 * @returns {string} The v2 wizard_step text value.
 */
export const mapWizardStep = (v1Step) => {
  if (v1Step === null || v1Step === undefined) {
    return 'onboarding';
  }

  // Integer step
  const asInt = typeof v1Step === 'number' ? v1Step : parseInt(String(v1Step), 10);
  if (!isNaN(asInt) && INT_TO_V2_STEP[asInt]) {
    return INT_TO_V2_STEP[asInt];
  }

  // GHL tag string
  const asString = String(v1Step).trim();
  if (GHL_TAG_TO_V2_STEP[asString]) {
    return GHL_TAG_TO_V2_STEP[asString];
  }

  // If it already looks like a v2 step (URL path style), pass through
  const V2_VALID_STEPS = new Set([
    'onboarding', 'social-analysis', 'brand-identity', 'customization',
    'logo-generation', 'logo-refinement', 'product-selection',
    'mockup-review', 'bundle-builder', 'profit-calculator',
    'checkout', 'complete',
  ]);
  if (V2_VALID_STEPS.has(asString)) {
    return asString;
  }

  log.warn(`Unknown wizard_step value: "${v1Step}" -- defaulting to "onboarding"`);
  return 'onboarding';
};

// ─── Data Helpers ───────────────────────────────────────────────────────────

/**
 * Normalize an email address (trim + lowercase).
 * @param {string|null|undefined} email
 * @returns {string|null}
 */
export const normalizeEmail = (email) => {
  if (!email) return null;
  return String(email).trim().toLowerCase();
};

/**
 * Safely parse a JSONB value that might be a string or already an object.
 * @param {*} value
 * @param {*} fallback
 * @returns {*}
 */
export const safeJsonParse = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

/**
 * Map v1 brand status values to v2 enum.
 * @param {string|null|undefined} status
 * @returns {string}
 */
export const mapBrandStatus = (status) => {
  const s = String(status || '').toLowerCase().trim();
  const MAP = {
    active: 'complete',
    completed: 'complete',
    complete: 'complete',
    draft: 'draft',
    'in-progress': 'draft',
    in_progress: 'draft',
    generating: 'generating',
    review: 'review',
    archived: 'archived',
  };
  return MAP[s] || 'draft';
};

/**
 * Map v1 brand_assets asset_type values to v2 enum.
 * v2 valid: 'logo', 'mockup', 'bundle_image', 'social_asset', 'label', 'brand_guide'
 * @param {string|null|undefined} assetType
 * @returns {string}
 */
export const mapAssetType = (assetType) => {
  const t = String(assetType || '').toLowerCase().trim();
  const MAP = {
    logo: 'logo',
    mockup: 'mockup',
    bundle: 'bundle_image',
    bundle_image: 'bundle_image',
    social: 'social_asset',
    social_asset: 'social_asset',
    label: 'label',
    brand_guide: 'brand_guide',
    guide: 'brand_guide',
  };
  return MAP[t] || 'logo';
};
