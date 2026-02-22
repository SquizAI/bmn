#!/usr/bin/env node

/**
 * 00-verify-source.js -- Verify the v1 source database.
 *
 * Connects to the old Supabase Postgres database, lists all tables with row
 * counts, and validates that the required tables exist.
 *
 * Usage:
 *   node scripts/migrate/00-verify-source.js [--verbose]
 *
 * Env:
 *   V1_DATABASE_URL -- Postgres connection string for the OLD project
 */

import { getV1Client, closeV1Client, validateEnv, log, createTimer, parseCliArgs } from './lib/utils.js';

/** Tables required for migration to proceed. */
const REQUIRED_TABLES = ['profiles', 'brands', 'brand_assets', 'products'];

/** Tables that are migrated if they exist (optional). */
const OPTIONAL_TABLES = ['brand_mockups', 'brand_products', 'user_socials', 'ghl_contacts'];

/**
 * Run the source verification step.
 * @returns {Promise<{ success: boolean, tables: Record<string, number> }>}
 */
export const run = async () => {
  const { verbose } = parseCliArgs();
  log.verbose = verbose;

  log.section('Step 00 -- Verify Source Database');
  const timer = createTimer();

  validateEnv();
  const v1 = getV1Client();

  // ── Test connectivity ──────────────────────────────────────────────────
  log.info('Connecting to v1 database...');
  try {
    const { rows } = await v1.query('SELECT current_database(), current_user, version()');
    const row = rows[0];
    log.success(`Connected to "${row.current_database}" as "${row.current_user}"`);
    log.debug(`PostgreSQL version: ${row.version}`);
  } catch (err) {
    log.error(`Failed to connect to v1 database: ${err.message}`);
    await closeV1Client();
    return { success: false, tables: {} };
  }

  // ── List all public tables with row counts ─────────────────────────────
  log.info('Listing public tables...');
  const { rows: tableRows } = await v1.query(`
    SELECT
      t.table_name,
      (
        SELECT reltuples::BIGINT
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = t.table_name
      ) AS estimated_count
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `);

  /** @type {Record<string, number>} */
  const tables = {};
  for (const row of tableRows) {
    tables[row.table_name] = Number(row.estimated_count ?? 0);
  }

  log.info(`Found ${tableRows.length} table(s) in public schema:\n`);
  log.table(
    Object.fromEntries(
      Object.entries(tables).map(([name, count]) => [name, `${count.toLocaleString()} rows (est.)`])
    )
  );

  // ── Verify required tables ─────────────────────────────────────────────
  log.info('\nVerifying required tables...');
  const missingRequired = REQUIRED_TABLES.filter((t) => !(t in tables));

  if (missingRequired.length > 0) {
    log.error(`Missing required tables: ${missingRequired.join(', ')}`);
    log.error('Migration cannot proceed. Check your V1_DATABASE_URL.');
    await closeV1Client();
    return { success: false, tables };
  }

  for (const t of REQUIRED_TABLES) {
    log.success(`  ${t} -- ${tables[t]?.toLocaleString() ?? 0} rows`);
  }

  // ── Check optional tables ──────────────────────────────────────────────
  log.info('\nChecking optional tables...');
  for (const t of OPTIONAL_TABLES) {
    if (t in tables) {
      log.success(`  ${t} -- ${tables[t]?.toLocaleString() ?? 0} rows`);
    } else {
      log.warn(`  ${t} -- NOT FOUND (will be skipped during migration)`);
    }
  }

  // ── Get exact counts for key tables (slow but accurate) ────────────────
  log.info('\nFetching exact row counts for key tables...');
  const exactCounts = {};
  for (const table of REQUIRED_TABLES) {
    try {
      const { rows } = await v1.query(`SELECT COUNT(*) AS cnt FROM public."${table}"`);
      exactCounts[table] = Number(rows[0].cnt);
      log.debug(`  ${table}: ${exactCounts[table].toLocaleString()} rows (exact)`);
    } catch (err) {
      log.warn(`  Could not count ${table}: ${err.message}`);
      exactCounts[table] = tables[table] ?? 0;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('Source Verification Summary');
  log.table({
    'Required tables': `${REQUIRED_TABLES.length - missingRequired.length}/${REQUIRED_TABLES.length} found`,
    Users: `${exactCounts.profiles ?? '?'} profiles`,
    Brands: `${exactCounts.brands ?? '?'} brands`,
    Assets: `${exactCounts.brand_assets ?? '?'} brand_assets`,
    Products: `${exactCounts.products ?? '?'} products`,
    Duration: timer.elapsed(),
    Status: 'READY FOR MIGRATION',
  });

  await closeV1Client();
  return { success: true, tables: { ...tables, ...exactCounts } };
};

// ── Run standalone ──────────────────────────────────────────────────────────
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  run()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      log.error(`Unhandled error: ${err.message}`);
      console.error(err);
      process.exit(1);
    });
}
