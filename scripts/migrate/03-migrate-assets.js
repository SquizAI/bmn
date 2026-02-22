#!/usr/bin/env node

/**
 * 03-migrate-assets.js -- Migrate v1 brand_assets + brand_mockups -> v2 brand_assets.
 *
 * v2 uses a unified `brand_assets` table that holds logos, mockups, bundles,
 * social assets, labels, and brand guides. This script reads from both the v1
 * `brand_assets` table and the optional `brand_mockups` table, transforms them,
 * and upserts into the v2 schema.
 *
 * Usage:
 *   node scripts/migrate/03-migrate-assets.js [--dry-run] [--verbose] [--batch-size=100]
 *
 * Env:
 *   V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
 */

import {
  getV1Client, closeV1Client, getV2Client,
  validateEnv, log, createTimer, parseCliArgs,
  processBatches, mapAssetType, safeJsonParse, isDryRun,
} from './lib/utils.js';

/**
 * Run the assets migration step.
 * @returns {Promise<{ success: boolean, migrated: number, skipped: number, errors: number }>}
 */
export const run = async () => {
  const { dryRun, verbose, batchSize } = parseCliArgs();
  log.verbose = verbose;

  log.section('Step 03 -- Migrate Assets (brand_assets + brand_mockups -> brand_assets)');
  if (dryRun) log.warn('DRY RUN -- no data will be written.\n');

  const timer = createTimer();
  validateEnv();

  const v1 = getV1Client();
  const v2 = getV2Client();

  // ── Fetch valid v2 brand IDs ──────────────────────────────────────────
  log.info('Fetching v2 brand IDs...');
  const { data: v2Brands, error: brandsError } = await v2.from('brands').select('id');
  if (brandsError) {
    log.error(`Failed to fetch v2 brands: ${brandsError.message}`);
    await closeV1Client();
    return { success: false, migrated: 0, skipped: 0, errors: 1 };
  }
  const validBrandIds = new Set(v2Brands.map((b) => b.id));
  log.info(`Found ${validBrandIds.size} v2 brands.`);

  /** @type {Array<Record<string, unknown>>} */
  const allAssetRows = [];

  // ── Fetch v1 brand_assets ─────────────────────────────────────────────
  log.info('Fetching v1 brand_assets...');
  const { rows: v1Assets } = await v1.query(`
    SELECT
      id,
      brand_id,
      asset_type,
      file_url,
      file_name,
      metadata,
      is_primary,
      product_id,
      created_at
    FROM public.brand_assets
    ORDER BY created_at ASC
  `);
  log.info(`Found ${v1Assets.length} v1 brand_assets.`);

  for (const asset of v1Assets) {
    if (!validBrandIds.has(asset.brand_id)) {
      continue; // Brand not migrated -> skip asset
    }

    allAssetRows.push({
      id: asset.id,
      brand_id: asset.brand_id,
      asset_type: mapAssetType(asset.asset_type),
      product_id: asset.product_id || null,
      url: asset.file_url || '',
      thumbnail_url: null, // Will be generated post-migration
      file_name: asset.file_name || null,
      file_size_bytes: null,
      mime_type: null,
      width: null,
      height: null,
      is_selected: asset.is_primary === true,
      is_archived: false,
      generation_model: null,
      generation_prompt: null,
      generation_params: {},
      variation_number: 1,
      metadata: safeJsonParse(asset.metadata, {}),
      created_at: asset.created_at || new Date().toISOString(),
    });
  }

  // ── Fetch v1 brand_mockups (if table exists) ──────────────────────────
  try {
    log.info('Fetching v1 brand_mockups...');
    const { rows: v1Mockups } = await v1.query(`
      SELECT
        id,
        brand_id,
        product_id,
        mockup_url,
        label_url,
        prompt_used,
        generation_params,
        variation_number,
        status,
        created_at
      FROM public.brand_mockups
      ORDER BY created_at ASC
    `);
    log.info(`Found ${v1Mockups.length} v1 brand_mockups.`);

    for (const mockup of v1Mockups) {
      if (!validBrandIds.has(mockup.brand_id)) {
        continue;
      }

      allAssetRows.push({
        id: mockup.id,
        brand_id: mockup.brand_id,
        asset_type: 'mockup',
        product_id: mockup.product_id || null,
        url: mockup.mockup_url || '',
        thumbnail_url: null,
        file_name: null,
        file_size_bytes: null,
        mime_type: null,
        width: null,
        height: null,
        is_selected: mockup.status === 'approved',
        is_archived: false,
        generation_model: null,
        generation_prompt: mockup.prompt_used || null,
        generation_params: safeJsonParse(mockup.generation_params, {}),
        variation_number: mockup.variation_number || 1,
        metadata: {
          label_url: mockup.label_url || null,
          v1_status: mockup.status || null,
        },
        created_at: mockup.created_at || new Date().toISOString(),
      });
    }
  } catch {
    log.warn('brand_mockups table not found -- only brand_assets will be migrated.');
  }

  log.info(`Total assets to migrate: ${allAssetRows.length}`);

  // ── Filter out assets with no URL ─────────────────────────────────────
  const validAssets = allAssetRows.filter((a) => a.url && a.url !== '');
  const noUrlCount = allAssetRows.length - validAssets.length;
  if (noUrlCount > 0) {
    log.warn(`Skipping ${noUrlCount} assets with no URL.`);
  }

  // ── Upsert into v2 ───────────────────────────────────────────────────
  let migrated = 0;
  let skipped = noUrlCount;
  let errorCount = 0;

  await processBatches(validAssets, batchSize, async (batch) => {
    if (dryRun) {
      log.debug(`[DRY RUN] Would upsert ${batch.length} assets.`);
      migrated += batch.length;
      return;
    }

    const { error } = await v2.from('brand_assets').upsert(batch, { onConflict: 'id' });
    if (error) {
      log.error(`Batch upsert failed: ${error.message}`);
      // Fallback: one-by-one
      for (const row of batch) {
        const { error: singleError } = await v2
          .from('brand_assets')
          .upsert(row, { onConflict: 'id' });
        if (singleError) {
          errorCount++;
          log.error(`  Asset ${row.id}: ${singleError.message}`);
        } else {
          migrated++;
        }
      }
    } else {
      migrated += batch.length;
    }
  });

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('Assets Migration Summary');
  log.table({
    'v1 brand_assets': String(v1Assets.length),
    'v1 brand_mockups': String(allAssetRows.length - v1Assets.length),
    'Total source assets': String(allAssetRows.length),
    'Migrated to v2': String(migrated),
    'Skipped (no URL)': String(skipped),
    Errors: String(errorCount),
    Duration: timer.elapsed(),
    Mode: dryRun ? 'DRY RUN' : 'LIVE',
  });

  await closeV1Client();
  return {
    success: errorCount === 0,
    migrated,
    skipped,
    errors: errorCount,
  };
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
