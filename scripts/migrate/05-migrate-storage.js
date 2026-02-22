#!/usr/bin/env node

/**
 * 05-migrate-storage.js -- Copy files from v1 Supabase Storage to v2.
 *
 * Downloads files from the old Supabase project's storage buckets and uploads
 * them to the new project. After upload, updates the `url` column in v2
 * `brand_assets` to point to the new storage location.
 *
 * Supports concurrency limiting (default: 5 parallel downloads/uploads).
 *
 * Usage:
 *   node scripts/migrate/05-migrate-storage.js [--dry-run] [--verbose] [--batch-size=50] [--concurrency=5]
 *
 * Env:
 *   V1_SUPABASE_URL         -- Old Supabase project URL
 *   V1_SUPABASE_SERVICE_KEY  -- Old Supabase service role key
 *   V2_SUPABASE_URL          -- New Supabase project URL
 *   V2_SUPABASE_SERVICE_KEY  -- New Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { getV2Client, log, createTimer, parseCliArgs, isDryRun } from './lib/utils.js';

/**
 * Bucket mapping: v1 bucket -> v2 bucket.
 * v2 unifies into 'brand-assets' and 'product-images'.
 */
const BUCKET_MAP = {
  'brand-logos': 'brand-assets',
  'brand-mockups': 'brand-assets',
  'product-images': 'product-images',
  'product-masks': 'product-images',
};

/**
 * Parse concurrency from CLI args.
 * @returns {number}
 */
const parseConcurrency = () => {
  const arg = process.argv.find((a) => a.startsWith('--concurrency='));
  return arg ? parseInt(arg.split('=')[1], 10) || 5 : 5;
};

/**
 * Process items with a concurrency limit.
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} handler
 */
const withConcurrency = async (items, concurrency, handler) => {
  const queue = [...items];
  const executing = new Set();

  while (queue.length > 0 || executing.size > 0) {
    while (executing.size < concurrency && queue.length > 0) {
      const item = queue.shift();
      const promise = handler(item)
        .then(() => executing.delete(promise))
        .catch(() => executing.delete(promise));
      executing.add(promise);
    }
    if (executing.size > 0) {
      await Promise.race(executing);
    }
  }
};

/**
 * Run the storage migration step.
 * @returns {Promise<{ success: boolean, copied: number, failed: number, urlsUpdated: number }>}
 */
export const run = async () => {
  const { dryRun, verbose, batchSize } = parseCliArgs();
  const concurrency = parseConcurrency();
  log.verbose = verbose;

  log.section('Step 05 -- Migrate Storage Files');
  if (dryRun) log.warn('DRY RUN -- no files will be copied.\n');

  const timer = createTimer();

  // ── Validate storage-specific env vars ─────────────────────────────────
  const v1Url = process.env.V1_SUPABASE_URL;
  const v1Key = process.env.V1_SUPABASE_SERVICE_KEY;
  const v2Url = process.env.V2_SUPABASE_URL;
  const v2Key = process.env.V2_SUPABASE_SERVICE_KEY;

  if (!v1Url || !v1Key) {
    log.error('Missing V1_SUPABASE_URL or V1_SUPABASE_SERVICE_KEY.');
    log.error('These are needed to download files from the old storage.');
    return { success: false, copied: 0, failed: 0, urlsUpdated: 0 };
  }
  if (!v2Url || !v2Key) {
    log.error('Missing V2_SUPABASE_URL or V2_SUPABASE_SERVICE_KEY.');
    return { success: false, copied: 0, failed: 0, urlsUpdated: 0 };
  }

  const v1Storage = createClient(v1Url, v1Key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const v2 = getV2Client();

  let totalCopied = 0;
  let totalFailed = 0;
  const errors = [];

  // ── Process each v1 bucket ─────────────────────────────────────────────
  for (const [v1Bucket, v2Bucket] of Object.entries(BUCKET_MAP)) {
    log.info(`\nProcessing bucket: ${v1Bucket} -> ${v2Bucket}`);

    // List files in the v1 bucket
    const { data: files, error: listError } = await v1Storage.storage
      .from(v1Bucket)
      .list('', { limit: 10000, sortBy: { column: 'created_at', order: 'asc' } });

    if (listError) {
      log.error(`  Failed to list ${v1Bucket}: ${listError.message}`);
      errors.push({ bucket: v1Bucket, error: listError.message });
      continue;
    }

    // Filter out folders (entries without metadata/size)
    const realFiles = (files || []).filter(
      (f) => f.name && !f.name.endsWith('/') && f.id
    );
    log.info(`  Found ${realFiles.length} files.`);

    if (realFiles.length === 0) continue;

    // Process with concurrency limit
    let bucketCopied = 0;
    let bucketFailed = 0;

    await withConcurrency(realFiles, concurrency, async (file) => {
      const sourcePath = file.name;
      // Prefix with source bucket name to avoid collisions in unified bucket
      const destPath = v1Bucket === v2Bucket
        ? sourcePath
        : `migrated/${v1Bucket}/${sourcePath}`;

      if (dryRun) {
        log.debug(`  [DRY RUN] Would copy: ${v1Bucket}/${sourcePath} -> ${v2Bucket}/${destPath}`);
        bucketCopied++;
        return;
      }

      try {
        // Download from v1
        const { data: fileData, error: downloadError } = await v1Storage.storage
          .from(v1Bucket)
          .download(sourcePath);

        if (downloadError) throw downloadError;

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const contentType = file.metadata?.mimetype || 'image/png';

        // Upload to v2
        const { error: uploadError } = await v2.storage
          .from(v2Bucket)
          .upload(destPath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        bucketCopied++;
        if (bucketCopied % 50 === 0) {
          log.info(`  Progress: ${bucketCopied}/${realFiles.length} files copied.`);
        }
      } catch (err) {
        bucketFailed++;
        errors.push({
          bucket: v1Bucket,
          file: sourcePath,
          error: err.message,
        });
        log.error(`  FAILED: ${v1Bucket}/${sourcePath}: ${err.message}`);
      }
    });

    totalCopied += bucketCopied;
    totalFailed += bucketFailed;
    log.info(`  Bucket ${v1Bucket}: ${bucketCopied} copied, ${bucketFailed} failed.`);
  }

  // ── Update URLs in brand_assets ────────────────────────────────────────
  log.info('\nUpdating brand_assets URLs...');
  let urlsUpdated = 0;

  if (!dryRun) {
    // Extract the project ref from the URLs
    const oldRef = v1Url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    const newRef = v2Url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

    if (oldRef && newRef && oldRef !== newRef) {
      log.info(`  Rewriting URLs: ${oldRef} -> ${newRef}`);

      // Fetch all brand_assets with old URLs
      const { data: assetsToUpdate, error: fetchError } = await v2
        .from('brand_assets')
        .select('id, url')
        .like('url', `%${oldRef}.supabase.co%`);

      if (fetchError) {
        log.error(`  Failed to fetch assets for URL rewrite: ${fetchError.message}`);
      } else if (assetsToUpdate && assetsToUpdate.length > 0) {
        log.info(`  Found ${assetsToUpdate.length} assets with old URLs.`);

        for (const asset of assetsToUpdate) {
          const newUrl = asset.url.replace(
            `${oldRef}.supabase.co`,
            `${newRef}.supabase.co`
          );

          const { error: updateError } = await v2
            .from('brand_assets')
            .update({ url: newUrl })
            .eq('id', asset.id);

          if (updateError) {
            log.error(`  Failed to update URL for asset ${asset.id}: ${updateError.message}`);
          } else {
            urlsUpdated++;
          }
        }
      } else {
        log.info('  No assets with old URLs found -- nothing to rewrite.');
      }
    } else {
      log.info('  Same project ref or could not parse -- skipping URL rewrite.');
    }
  } else {
    log.debug('[DRY RUN] Would update brand_assets URLs.');
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('Storage Migration Summary');
  log.table({
    'Files copied': String(totalCopied),
    'Files failed': String(totalFailed),
    'URLs updated': String(urlsUpdated),
    'Concurrency': String(concurrency),
    Duration: timer.elapsed(),
    Mode: dryRun ? 'DRY RUN' : 'LIVE',
  });

  if (errors.length > 0 && verbose) {
    log.info('\nErrors:');
    for (const err of errors.slice(0, 20)) {
      log.error(`  ${err.bucket}/${err.file || '(bucket-level)'}: ${err.error}`);
    }
    if (errors.length > 20) {
      log.info(`  ...and ${errors.length - 20} more.`);
    }
  }

  return {
    success: totalFailed === 0,
    copied: totalCopied,
    failed: totalFailed,
    urlsUpdated,
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
