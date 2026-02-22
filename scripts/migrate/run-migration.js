#!/usr/bin/env node

/**
 * run-migration.js -- Master migration orchestrator for v1 -> v2.
 *
 * Imports and runs all 7 migration step scripts (00-06) in order,
 * collecting timing data and pass/fail status for a summary report.
 *
 * Usage:
 *   node scripts/migrate/run-migration.js                          # run all steps
 *   node scripts/migrate/run-migration.js --dry-run                # dry run all steps
 *   node scripts/migrate/run-migration.js --step=2                 # run only step 02
 *   node scripts/migrate/run-migration.js --verbose --batch-size=50
 *   node scripts/migrate/run-migration.js --help
 *
 * @module scripts/migrate/run-migration
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { log, createTimer, validateEnv, closeV1Client } from './lib/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Array<{ file: string, label: string }>} */
const STEPS = [
  { file: '00-verify-source.js',    label: '00  Verify source database' },
  { file: '01-migrate-users.js',    label: '01  Migrate users' },
  { file: '02-migrate-brands.js',   label: '02  Migrate brands' },
  { file: '03-migrate-assets.js',   label: '03  Migrate assets' },
  { file: '04-migrate-products.js', label: '04  Migrate products' },
  { file: '05-migrate-storage.js',  label: '05  Migrate storage files' },
  { file: '06-verify-migration.js', label: '06  Verify migration' },
];

// ─── CLI Parsing ────────────────────────────────────────────────────────────

const parseArgs = () => {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const stepArg = args.find((a) => a.startsWith('--step='));
  const step = stepArg ? parseInt(stepArg.split('=')[1], 10) : null;
  const batchArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 100;
  return { dryRun, verbose, step, batchSize, help };
};

const HELP_TEXT = `
Brand Me Now v2 -- Migration Orchestrator
==========================================

Usage:
  node scripts/migrate/run-migration.js [options]

Options:
  --dry-run          No writes to v2 database.
  --step=N           Run only step N (0-6).
  --verbose, -v      Debug-level logging.
  --batch-size=N     Override batch size (default: 100).
  --help, -h         Show this help.

Steps:
  0  Verify source database      (00-verify-source.js)
  1  Migrate users               (01-migrate-users.js)
  2  Migrate brands              (02-migrate-brands.js)
  3  Migrate assets              (03-migrate-assets.js)
  4  Migrate products            (04-migrate-products.js)
  5  Migrate storage files       (05-migrate-storage.js)
  6  Verify migration            (06-verify-migration.js)

Environment Variables (required):
  V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
`;

// ─── Step Runner ────────────────────────────────────────────────────────────

/**
 * @param {{ file: string, label: string }} stepDef
 * @param {number} index
 * @param {number} total
 * @returns {Promise<{ label: string, success: boolean, duration: string, durationMs: number, error: string|null }>}
 */
const runStep = async (stepDef, index, total) => {
  const { file, label } = stepDef;
  const modulePath = join(__dirname, file);

  log.section(`Step ${index + 1}/${total}: ${label}`);
  log.info(`Loading ${file}...`);

  const timer = createTimer();

  try {
    const mod = await import(modulePath);

    if (typeof mod.run === 'function') {
      const result = await mod.run();
      const success = result && result.success !== false;

      if (success) {
        log.success(`${label} completed in ${timer.elapsed()}`);
      } else {
        log.error(`${label} reported failure after ${timer.elapsed()}`);
      }

      return { label, success, duration: timer.elapsed(), durationMs: timer.ms(), error: success ? null : 'Step returned { success: false }' };
    }

    log.warn(`${file} does not export a run() function; treated as standalone import.`);
    log.success(`${label} completed in ${timer.elapsed()}`);
    return { label, success: true, duration: timer.elapsed(), durationMs: timer.ms(), error: null };
  } catch (err) {
    log.error(`${label} threw an error after ${timer.elapsed()}: ${err.message}`);
    if (log.verbose && err.stack) log.debug(err.stack);
    return { label, success: false, duration: timer.elapsed(), durationMs: timer.ms(), error: err.message };
  }
};

// ─── Summary ────────────────────────────────────────────────────────────────

const printSummary = (results, totalElapsed, dryRun) => {
  const line = '='.repeat(68);
  const thin = '-'.repeat(60);

  console.log(`\n${line}`);
  console.log(`  MIGRATION SUMMARY${dryRun ? '  (DRY RUN)' : ''}`);
  console.log(`${line}\n`);

  console.log(`  ${'Status'.padEnd(8)}  ${'Step'.padEnd(36)}  ${'Duration'.padStart(12)}`);
  console.log(`  ${thin}`);

  for (const r of results) {
    const icon = r.success ? '[+] PASS' : '[X] FAIL';
    console.log(`  ${icon.padEnd(8)}  ${r.label.padEnd(36)}  ${r.duration.padStart(12)}`);
    if (!r.success && r.error) console.log(`           Error: ${r.error}`);
  }

  console.log(`  ${thin}`);

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log('');
  log.table({ 'Steps run': results.length, Passed: passed, Failed: failed, 'Total time': totalElapsed });
  console.log(`\n${line}\n`);

  if (failed > 0) {
    log.error(`Migration completed with ${failed} failure(s).`);
  } else {
    log.success(`All ${passed} step(s) completed successfully.`);
  }
};

// ─── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.verbose) log.verbose = true;

  log.section('Brand Me Now v2 -- Migration Orchestrator');

  if (args.dryRun) log.warn('DRY RUN MODE -- no data will be written to v2.');

  try {
    validateEnv();
    log.info('Environment variables validated.');
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }

  let stepsToRun;
  if (args.step !== null) {
    if (args.step < 0 || args.step >= STEPS.length || !Number.isInteger(args.step)) {
      log.error(`Invalid step number: ${args.step}. Must be 0-${STEPS.length - 1}.`);
      process.exit(1);
    }
    stepsToRun = [STEPS[args.step]];
    log.info(`Running single step: ${STEPS[args.step].label}`);
  } else {
    stepsToRun = STEPS;
    log.info(`Running all ${STEPS.length} steps in sequence.`);
  }

  const totalTimer = createTimer();
  const results = [];
  let aborted = false;

  for (let i = 0; i < stepsToRun.length; i++) {
    const result = await runStep(stepsToRun[i], i, stepsToRun.length);
    results.push(result);

    if (!result.success && stepsToRun[i].file === '00-verify-source.js' && stepsToRun.length > 1) {
      log.error('Source verification failed. Aborting migration.');
      aborted = true;
      break;
    }
  }

  try {
    await closeV1Client();
  } catch (err) {
    log.warn(`Error closing v1 client: ${err.message}`);
  }

  printSummary(results, totalTimer.elapsed(), args.dryRun);

  if (aborted) {
    log.warn('Migration was aborted early due to source verification failure.');
    log.warn(`Steps skipped: ${stepsToRun.length - results.length}`);
  }

  process.exit(results.some((r) => !r.success) ? 1 : 0);
};

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
