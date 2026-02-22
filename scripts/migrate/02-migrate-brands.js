#!/usr/bin/env node

/**
 * 02-migrate-brands.js -- Migrate v1 brands -> v2 brands.
 *
 * Transforms wizard_step (INT -> TEXT), merges social_data from user_socials,
 * renames columns, and inserts into the v2 brands table.
 *
 * Idempotent: upserts on brand ID, skipping brands whose user_id does not
 * exist in v2 profiles.
 *
 * Usage:
 *   node scripts/migrate/02-migrate-brands.js [--dry-run] [--verbose] [--batch-size=100]
 *
 * Env:
 *   V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
 */

import {
  getV1Client, closeV1Client, getV2Client,
  validateEnv, log, createTimer, parseCliArgs,
  processBatches, mapWizardStep, mapBrandStatus,
  safeJsonParse, isDryRun,
} from './lib/utils.js';

/**
 * Run the brands migration step.
 * @returns {Promise<{ success: boolean, migrated: number, skipped: number, errors: number }>}
 */
export const run = async () => {
  const { dryRun, verbose, batchSize } = parseCliArgs();
  log.verbose = verbose;

  log.section('Step 02 -- Migrate Brands');
  if (dryRun) log.warn('DRY RUN -- no data will be written.\n');

  const timer = createTimer();
  validateEnv();

  const v1 = getV1Client();
  const v2 = getV2Client();

  // ── Fetch v2 profile IDs (only migrate brands for existing users) ─────
  log.info('Fetching v2 profile IDs...');
  const { data: v2Profiles, error: profilesError } = await v2
    .from('profiles')
    .select('id, metadata');
  if (profilesError) {
    log.error(`Failed to fetch v2 profiles: ${profilesError.message}`);
    await closeV1Client();
    return { success: false, migrated: 0, skipped: 0, errors: 1 };
  }

  // Build map: v1_user_id -> v2_profile_id
  const v1ToV2UserMap = new Map();
  for (const profile of v2Profiles) {
    const v1Id = profile.metadata?.v1_user_id;
    if (v1Id) {
      v1ToV2UserMap.set(v1Id, profile.id);
    }
    // Also add identity mapping (same ID if no v1 mapping)
    v1ToV2UserMap.set(profile.id, profile.id);
  }
  const validV2UserIds = new Set(v2Profiles.map((p) => p.id));
  log.info(`Found ${validV2UserIds.size} v2 profiles.`);

  // ── Fetch v1 brands ───────────────────────────────────────────────────
  log.info('Fetching v1 brands...');
  const { rows: v1Brands } = await v1.query(`
    SELECT
      b.id,
      b.user_id,
      b.status,
      b.name,
      b.description,
      b.vision,
      b.color_palette,
      b.fonts,
      b.logo_style,
      b.brand_archetype,
      b.brand_values,
      b.target_audience,
      b.wizard_step,
      b.step_url,
      b.created_at,
      b.updated_at
    FROM public.brands b
    ORDER BY b.created_at ASC
  `);
  log.info(`Found ${v1Brands.length} v1 brands.`);

  // ── Fetch user_socials for social_data merging (if table exists) ───────
  let socialDataByUser = new Map();
  try {
    const { rows: socials } = await v1.query(`
      SELECT user_id, platform, handle, profile_url, analysis_data, analyzed_at
      FROM public.user_socials
      ORDER BY user_id, platform
    `);
    for (const s of socials) {
      if (!socialDataByUser.has(s.user_id)) {
        socialDataByUser.set(s.user_id, []);
      }
      socialDataByUser.get(s.user_id).push({
        platform: s.platform,
        handle: s.handle,
        profile_url: s.profile_url,
        analysis_data: safeJsonParse(s.analysis_data, null),
        analyzed_at: s.analyzed_at,
      });
    }
    log.info(`Loaded social data for ${socialDataByUser.size} users.`);
  } catch {
    log.warn('user_socials table not found -- social_data will be empty.');
  }

  // ── Migrate brands ────────────────────────────────────────────────────
  let migrated = 0;
  let skipped = 0;
  let errorCount = 0;

  await processBatches(v1Brands, batchSize, async (batch) => {
    /** @type {Array<Record<string, unknown>>} */
    const upsertRows = [];

    for (const brand of batch) {
      // Resolve v1 user_id to v2 user_id
      const v2UserId = v1ToV2UserMap.get(brand.user_id);
      if (!v2UserId || !validV2UserIds.has(v2UserId)) {
        log.debug(`Skipping brand ${brand.id} -- user ${brand.user_id} not in v2.`);
        skipped++;
        continue;
      }

      const v2WizardStep = mapWizardStep(brand.wizard_step);
      const v2Status = mapBrandStatus(brand.status);
      const socialData = socialDataByUser.get(brand.user_id) || [];

      upsertRows.push({
        id: brand.id,
        user_id: v2UserId,
        status: v2Status,
        name: brand.name || null,
        tagline: null,
        vision: brand.vision || brand.description || null,
        description: brand.description || null,
        color_palette: safeJsonParse(brand.color_palette, []),
        fonts: safeJsonParse(brand.fonts, {}),
        logo_style: brand.logo_style || null,
        archetype: brand.brand_archetype || null,
        brand_values: safeJsonParse(brand.brand_values, []),
        target_audience: brand.target_audience || null,
        social_data: socialData.length > 0 ? socialData : {},
        wizard_step: v2WizardStep,
        wizard_state: {},
        resume_token: null,
        completed_at: v2Status === 'complete' ? (brand.updated_at || brand.created_at) : null,
        created_at: brand.created_at || new Date().toISOString(),
        updated_at: brand.updated_at || new Date().toISOString(),
      });
    }

    if (upsertRows.length === 0) return;

    if (dryRun) {
      log.debug(`[DRY RUN] Would upsert ${upsertRows.length} brands.`);
      migrated += upsertRows.length;
      return;
    }

    const { error } = await v2.from('brands').upsert(upsertRows, { onConflict: 'id' });
    if (error) {
      errorCount += upsertRows.length;
      log.error(`Batch insert failed: ${error.message}`);
      // Try one-by-one fallback
      for (const row of upsertRows) {
        const { error: singleError } = await v2.from('brands').upsert(row, { onConflict: 'id' });
        if (singleError) {
          errorCount++;
          log.error(`  Brand ${row.id}: ${singleError.message}`);
        } else {
          migrated++;
          errorCount--; // Undo the batch error count for this one
        }
      }
    } else {
      migrated += upsertRows.length;
    }
  });

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('Brands Migration Summary');
  log.table({
    'Total v1 brands': String(v1Brands.length),
    Migrated: String(migrated),
    'Skipped (no user)': String(skipped),
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
