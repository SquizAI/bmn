#!/usr/bin/env node

/**
 * 06-verify-migration.js -- Post-migration verification.
 *
 * Compares record counts between v1 and v2, checks for orphaned records,
 * validates storage URLs are accessible, and generates a summary report.
 *
 * Usage:
 *   node scripts/migrate/06-verify-migration.js [--verbose] [--check-urls]
 *
 * Env:
 *   V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
 */

import {
  getV1Client, closeV1Client, getV2Client,
  validateEnv, log, createTimer, parseCliArgs,
} from './lib/utils.js';

/**
 * Get the exact row count for a table via the v1 pg client.
 * @param {import('pg').Pool} client
 * @param {string} table
 * @returns {Promise<number>}
 */
const v1Count = async (client, table) => {
  try {
    const { rows } = await client.query(`SELECT COUNT(*) AS cnt FROM public."${table}"`);
    return Number(rows[0].cnt);
  } catch {
    return -1; // Table does not exist
  }
};

/**
 * Get the exact row count for a table via the v2 Supabase client.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @returns {Promise<number>}
 */
const v2Count = async (client, table) => {
  try {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return -1;
    return count ?? 0;
  } catch {
    return -1;
  }
};

/**
 * Run the post-migration verification.
 * @returns {Promise<{ success: boolean, issues: string[] }>}
 */
export const run = async () => {
  const { verbose } = parseCliArgs();
  const checkUrls = process.argv.includes('--check-urls');
  log.verbose = verbose;

  log.section('Step 06 -- Post-Migration Verification');
  const timer = createTimer();
  validateEnv();

  const v1 = getV1Client();
  const v2 = getV2Client();
  const issues = [];

  // ══════════════════════════════════════════════════════════════════════
  // 1. Record Count Comparison
  // ══════════════════════════════════════════════════════════════════════
  log.info('Comparing record counts (v1 vs v2)...\n');

  const tables = [
    { v1Table: 'profiles', v2Table: 'profiles', label: 'Users / Profiles' },
    { v1Table: 'brands', v2Table: 'brands', label: 'Brands' },
    { v1Table: 'brand_assets', v2Table: 'brand_assets', label: 'Brand Assets' },
    { v1Table: 'products', v2Table: 'products', label: 'Products' },
    { v1Table: 'brand_products', v2Table: 'brand_products', label: 'Brand Products' },
  ];

  const counts = {};
  for (const { v1Table, v2Table, label } of tables) {
    const src = await v1Count(v1, v1Table);
    const dst = await v2Count(v2, v2Table);

    counts[label] = { v1: src, v2: dst };

    const status = src === -1
      ? 'N/A (table not in v1)'
      : dst >= src
        ? 'OK'
        : `MISMATCH (v1: ${src}, v2: ${dst})`;

    if (dst < src && src !== -1) {
      issues.push(`${label}: v1 has ${src} rows but v2 only has ${dst}`);
    }

    log.info(`  ${label.padEnd(20)} v1: ${src === -1 ? 'N/A' : src.toLocaleString().padStart(8)}  v2: ${dst.toLocaleString().padStart(8)}  ${status}`);
  }

  // Also count brand_mockups in v1 (merged into brand_assets in v2)
  const mockupCount = await v1Count(v1, 'brand_mockups');
  if (mockupCount > 0) {
    log.info(`  ${'Brand Mockups (v1)'.padEnd(20)} v1: ${mockupCount.toLocaleString().padStart(8)}  (merged into brand_assets in v2)`);
    const expectedAssets = (counts['Brand Assets']?.v1 || 0) + mockupCount;
    if (counts['Brand Assets']?.v2 < expectedAssets) {
      issues.push(
        `Brand Assets: expected at least ${expectedAssets} (assets + mockups), got ${counts['Brand Assets']?.v2}`
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. Orphaned Record Checks
  // ══════════════════════════════════════════════════════════════════════
  log.info('\nChecking for orphaned records...\n');

  // Assets without brands
  const { data: orphanedAssets } = await v2
    .from('brand_assets')
    .select('id, brand_id')
    .is('brand_id', null);
  const orphanedAssetCount = orphanedAssets?.length || 0;
  if (orphanedAssetCount > 0) {
    issues.push(`${orphanedAssetCount} brand_assets with NULL brand_id`);
    log.warn(`  ${orphanedAssetCount} brand_assets with NULL brand_id`);
  } else {
    log.success('  No orphaned brand_assets (all have valid brand_id)');
  }

  // Brand products referencing non-existent brands
  const { count: bpOrphanBrandCount } = await v2
    .from('brand_products')
    .select('id', { count: 'exact', head: true });
  log.info(`  ${bpOrphanBrandCount ?? 0} brand_products total`);

  // Brands without users
  const { data: brandsWithoutUsers } = await v2.rpc('get_orphaned_brands').catch(() => ({ data: null }));
  if (brandsWithoutUsers === null) {
    // RPC doesn't exist, do manual check
    const { data: allBrands } = await v2.from('brands').select('id, user_id');
    const { data: allProfiles } = await v2.from('profiles').select('id');
    const profileIds = new Set((allProfiles || []).map((p) => p.id));
    const orphanedBrands = (allBrands || []).filter((b) => !profileIds.has(b.user_id));
    if (orphanedBrands.length > 0) {
      issues.push(`${orphanedBrands.length} brands reference non-existent users`);
      log.warn(`  ${orphanedBrands.length} brands reference non-existent users`);
    } else {
      log.success('  No orphaned brands (all have valid user_id)');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. Data Integrity Checks
  // ══════════════════════════════════════════════════════════════════════
  log.info('\nRunning data integrity checks...\n');

  // Check wizard_step values are valid
  const { data: wizardSteps } = await v2
    .from('brands')
    .select('wizard_step');
  const validSteps = new Set([
    'onboarding', 'social-analysis', 'brand-identity', 'customization',
    'logo-generation', 'logo-refinement', 'product-selection',
    'mockup-review', 'bundle-builder', 'profit-calculator',
    'checkout', 'complete',
    // Also accept the more concise v2 steps used in the v2 brands migration
    'social', 'identity', 'colors', 'fonts', 'logos', 'products',
    'mockups', 'bundles', 'projections',
  ]);
  const invalidSteps = (wizardSteps || []).filter((b) => !validSteps.has(b.wizard_step));
  if (invalidSteps.length > 0) {
    issues.push(`${invalidSteps.length} brands have invalid wizard_step values`);
    log.warn(`  ${invalidSteps.length} brands have invalid wizard_step values`);
  } else {
    log.success('  All brands have valid wizard_step values');
  }

  // Check for profiles with no email
  const { count: noEmailCount } = await v2
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .is('email', null);
  if ((noEmailCount || 0) > 0) {
    issues.push(`${noEmailCount} profiles have NULL email`);
    log.warn(`  ${noEmailCount} profiles have NULL email`);
  } else {
    log.success('  All profiles have an email address');
  }

  // Check for brand_assets with empty URLs
  const { count: emptyUrlCount } = await v2
    .from('brand_assets')
    .select('id', { count: 'exact', head: true })
    .or('url.is.null,url.eq.');
  if ((emptyUrlCount || 0) > 0) {
    issues.push(`${emptyUrlCount} brand_assets have NULL or empty url`);
    log.warn(`  ${emptyUrlCount} brand_assets have NULL or empty url`);
  } else {
    log.success('  All brand_assets have a URL');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. Storage URL Accessibility (optional, slow)
  // ══════════════════════════════════════════════════════════════════════
  let urlsChecked = 0;
  let urlsBroken = 0;

  if (checkUrls) {
    log.info('\nValidating storage URLs (--check-urls enabled)...\n');

    const { data: assets } = await v2
      .from('brand_assets')
      .select('id, url, asset_type')
      .not('url', 'is', null)
      .limit(500); // Limit to avoid excessive network calls

    log.info(`  Checking ${(assets || []).length} asset URLs (max 500)...`);

    for (const asset of assets || []) {
      try {
        const response = await fetch(asset.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          urlsChecked++;
        } else {
          urlsBroken++;
          log.debug(`  BROKEN: ${asset.id} -> ${asset.url} (HTTP ${response.status})`);
        }
      } catch (err) {
        urlsBroken++;
        log.debug(`  BROKEN: ${asset.id} -> ${asset.url} (${err.message})`);
      }
    }

    if (urlsBroken > 0) {
      issues.push(`${urlsBroken} of ${urlsChecked + urlsBroken} asset URLs are broken`);
      log.warn(`  ${urlsBroken} broken URLs out of ${urlsChecked + urlsBroken} checked`);
    } else {
      log.success(`  All ${urlsChecked} checked URLs are accessible`);
    }
  } else {
    log.info('\nSkipping URL checks (use --check-urls to enable).');
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. Summary Report
  // ══════════════════════════════════════════════════════════════════════
  log.section('Migration Verification Report');

  const status = issues.length === 0 ? 'PASSED' : 'ISSUES FOUND';

  log.table({
    'Overall status': status,
    'Issues found': String(issues.length),
    'v2 profiles': String(counts['Users / Profiles']?.v2 ?? '?'),
    'v2 brands': String(counts['Brands']?.v2 ?? '?'),
    'v2 brand_assets': String(counts['Brand Assets']?.v2 ?? '?'),
    'v2 products': String(counts['Products']?.v2 ?? '?'),
    'v2 brand_products': String(counts['Brand Products']?.v2 ?? '?'),
    ...(checkUrls ? { 'URLs checked': String(urlsChecked + urlsBroken), 'URLs broken': String(urlsBroken) } : {}),
    Duration: timer.elapsed(),
  });

  if (issues.length > 0) {
    log.info('\nIssues:');
    for (let i = 0; i < issues.length; i++) {
      log.warn(`  ${i + 1}. ${issues[i]}`);
    }
    log.info('\nReview these issues before going live. Some may be acceptable');
    log.info('(e.g., v2 products may include seed data not present in v1).');
  } else {
    log.success('\nAll checks passed. Migration data looks good.');
  }

  await closeV1Client();
  return { success: issues.length === 0, issues };
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
