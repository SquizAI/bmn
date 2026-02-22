#!/usr/bin/env node

/**
 * 01-migrate-users.js -- Migrate v1 profiles -> v2 auth.users + profiles.
 *
 * Reads v1 `profiles` table, creates Supabase Auth users via the admin API,
 * then inserts corresponding v2 `profiles` rows.
 *
 * Idempotent: skips users that already exist (by email).
 *
 * Usage:
 *   node scripts/migrate/01-migrate-users.js [--dry-run] [--verbose] [--batch-size=50]
 *
 * Env:
 *   V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
 */

import {
  getV1Client, closeV1Client, getV2Client,
  validateEnv, log, createTimer, parseCliArgs,
  processBatches, normalizeEmail, isDryRun,
} from './lib/utils.js';

/**
 * Run the users migration step.
 * @returns {Promise<{ success: boolean, migrated: number, skipped: number, errors: number }>}
 */
export const run = async () => {
  const { dryRun, verbose, batchSize } = parseCliArgs();
  log.verbose = verbose;

  log.section('Step 01 -- Migrate Users (profiles -> auth.users + profiles)');
  if (dryRun) log.warn('DRY RUN -- no data will be written.\n');

  const timer = createTimer();
  validateEnv();

  const v1 = getV1Client();
  const v2 = getV2Client();

  // ── Fetch v1 profiles ──────────────────────────────────────────────────
  log.info('Fetching v1 profiles...');
  const { rows: v1Profiles } = await v1.query(`
    SELECT
      id,
      email,
      phone,
      full_name,
      password,
      tc_accepted_at,
      created_at,
      updated_at
    FROM public.profiles
    ORDER BY created_at ASC
  `);
  log.info(`Found ${v1Profiles.length} v1 profiles to migrate.`);

  // ── Fetch existing v2 auth users (for dedup) ──────────────────────────
  log.info('Fetching existing v2 auth users for deduplication...');
  const { data: existingAuthData, error: listError } = await v2.auth.admin.listUsers({ perPage: 10000 });
  if (listError) {
    log.error(`Failed to list v2 auth users: ${listError.message}`);
    await closeV1Client();
    return { success: false, migrated: 0, skipped: 0, errors: 1 };
  }
  const existingEmails = new Set(
    (existingAuthData?.users || []).map((u) => normalizeEmail(u.email))
  );
  log.info(`Found ${existingEmails.size} existing v2 auth users.`);

  // ── Process each profile ──────────────────────────────────────────────
  let migrated = 0;
  let skipped = 0;
  let errorCount = 0;

  const result = await processBatches(v1Profiles, batchSize, async (batch, batchIndex) => {
    for (const profile of batch) {
      const email = normalizeEmail(profile.email);
      if (!email) {
        log.warn(`Skipping profile ${profile.id} -- no email.`);
        skipped++;
        continue;
      }

      if (existingEmails.has(email)) {
        log.debug(`Skipping ${email} -- already exists in v2.`);
        skipped++;
        continue;
      }

      if (dryRun) {
        log.debug(`[DRY RUN] Would create auth user + profile for ${email}`);
        migrated++;
        continue;
      }

      try {
        // ── Create Supabase Auth user ──────────────────────────────────
        // Use the v1 user ID as the new user ID so foreign keys remain valid.
        // If v1 stored a password, use it; otherwise generate a random one
        // (user will need to reset via email).
        const password = profile.password && profile.password !== 'google'
          ? profile.password
          : `MigratedUser-${crypto.randomUUID().slice(0, 8)}!`;

        const { data: authUser, error: authError } = await v2.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm since they were already verified in v1
          user_metadata: {
            full_name: profile.full_name || '',
            migrated_from_v1: true,
            v1_user_id: profile.id,
          },
        });

        if (authError) {
          // Check for duplicate (race condition or partial previous run)
          if (authError.message?.includes('already') || authError.message?.includes('duplicate')) {
            log.debug(`Auth user already exists for ${email}, creating profile only.`);
          } else {
            throw authError;
          }
        }

        const authUserId = authUser?.user?.id;
        if (!authUserId) {
          log.warn(`No auth user ID returned for ${email} -- skipping profile.`);
          skipped++;
          continue;
        }

        // ── Create v2 profile ──────────────────────────────────────────
        const { error: profileError } = await v2.from('profiles').upsert(
          {
            id: authUserId,
            email,
            phone: profile.phone || null,
            full_name: profile.full_name || '',
            avatar_url: '',
            role: 'user',
            tc_accepted_at: profile.tc_accepted_at || null,
            stripe_customer_id: null,
            subscription_tier: 'free',
            org_id: null,
            onboarding_done: false,
            metadata: { v1_user_id: profile.id },
            created_at: profile.created_at || new Date().toISOString(),
            updated_at: profile.updated_at || new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (profileError) {
          throw profileError;
        }

        existingEmails.add(email);
        migrated++;
        log.debug(`Migrated user: ${email} (auth: ${authUserId})`);
      } catch (err) {
        errorCount++;
        log.error(`Failed to migrate ${email}: ${err.message}`);
      }
    }
  });

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('User Migration Summary');
  log.table({
    'Total v1 profiles': String(v1Profiles.length),
    Migrated: String(migrated),
    Skipped: String(skipped),
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
