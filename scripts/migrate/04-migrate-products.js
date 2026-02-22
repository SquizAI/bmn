#!/usr/bin/env node

/**
 * 04-migrate-products.js -- Migrate v1 products + brand_products -> v2.
 *
 * Reads v1 `products` table, transforms to v2 schema (adds SKU if missing,
 * normalizes categories), then migrates the `brand_products` junction records.
 *
 * v2 products table adds: base_cost, retail_price, image_url,
 * mockup_template_url, mockup_instructions, sort_order, fts.
 * These fields are set to defaults and require manual post-migration data entry.
 *
 * Usage:
 *   node scripts/migrate/04-migrate-products.js [--dry-run] [--verbose] [--batch-size=100]
 *
 * Env:
 *   V1_DATABASE_URL, V2_SUPABASE_URL, V2_SUPABASE_SERVICE_KEY
 */

import {
  getV1Client, closeV1Client, getV2Client,
  validateEnv, log, createTimer, parseCliArgs,
  processBatches, safeJsonParse, isDryRun,
} from './lib/utils.js';

/**
 * Normalize a v1 category to v2 enum value.
 * v2 valid: 'apparel', 'accessories', 'home_goods', 'packaging', 'digital'
 * @param {string|null|undefined} category
 * @returns {string}
 */
const normalizeCategory = (category) => {
  const c = String(category || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const MAP = {
    apparel: 'apparel',
    clothing: 'apparel',
    tshirt: 'apparel',
    t_shirt: 'apparel',
    hoodie: 'apparel',
    accessories: 'accessories',
    accessory: 'accessories',
    mug: 'accessories',
    hat: 'accessories',
    bag: 'accessories',
    home: 'home_goods',
    home_goods: 'home_goods',
    homegoods: 'home_goods',
    candle: 'home_goods',
    packaging: 'packaging',
    label: 'packaging',
    box: 'packaging',
    digital: 'digital',
    download: 'digital',
    ebook: 'digital',
  };
  return MAP[c] || 'apparel';
};

/**
 * Generate a SKU from a product name if one is missing.
 * Format: CAT-NAME-001 (e.g. APR-TSHIRT-001)
 * @param {string} name
 * @param {string} category
 * @param {number} index
 * @returns {string}
 */
const generateSku = (name, category, index) => {
  const catPrefix = {
    apparel: 'APR',
    accessories: 'ACC',
    home_goods: 'HMG',
    packaging: 'PKG',
    digital: 'DIG',
  };
  const prefix = catPrefix[category] || 'GEN';
  const namePart = String(name || 'ITEM')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  const num = String(index + 1).padStart(3, '0');
  return `${prefix}-${namePart}-${num}`;
};

/**
 * Run the products migration step.
 * @returns {Promise<{ success: boolean, products: number, brandProducts: number, errors: number }>}
 */
export const run = async () => {
  const { dryRun, verbose, batchSize } = parseCliArgs();
  log.verbose = verbose;

  log.section('Step 04 -- Migrate Products + Brand Products');
  if (dryRun) log.warn('DRY RUN -- no data will be written.\n');

  const timer = createTimer();
  validateEnv();

  const v1 = getV1Client();
  const v2 = getV2Client();

  // ── Phase 1: Migrate products catalog ─────────────────────────────────
  log.info('Fetching v1 products...');
  const { rows: v1Products } = await v1.query(`
    SELECT
      id,
      sku,
      name,
      category,
      description,
      base_cost,
      retail_price,
      image_url,
      mockup_template_url,
      is_active,
      sort_order,
      metadata,
      created_at,
      updated_at
    FROM public.products
    ORDER BY sort_order, created_at ASC
  `);
  log.info(`Found ${v1Products.length} v1 products.`);

  // Check for existing v2 products (skip seed data collisions)
  const { data: existingProducts } = await v2.from('products').select('id, sku');
  const existingSkus = new Set((existingProducts || []).map((p) => p.sku));
  const existingProductIds = new Set((existingProducts || []).map((p) => p.id));
  log.info(`Found ${existingSkus.size} existing v2 products.`);

  let productsMigrated = 0;
  let productsSkipped = 0;
  let errorCount = 0;

  await processBatches(v1Products, batchSize, async (batch, batchIndex) => {
    /** @type {Array<Record<string, unknown>>} */
    const upsertRows = [];

    for (let i = 0; i < batch.length; i++) {
      const product = batch[i];

      // Skip if this product ID already exists in v2
      if (existingProductIds.has(product.id)) {
        log.debug(`Skipping product ${product.id} -- already in v2.`);
        productsSkipped++;
        continue;
      }

      const category = normalizeCategory(product.category);
      const sku = product.sku || generateSku(product.name, category, batchIndex * batchSize + i);

      // Skip if SKU collision
      if (existingSkus.has(sku)) {
        log.warn(`Skipping product "${product.name}" -- SKU "${sku}" already exists.`);
        productsSkipped++;
        continue;
      }

      upsertRows.push({
        id: product.id,
        sku,
        name: product.name || 'Unnamed Product',
        category,
        description: product.description || '',
        base_cost: product.base_cost || 0.00,
        retail_price: product.retail_price || 0.00,
        image_url: product.image_url || null,
        mockup_template_url: product.mockup_template_url || null,
        mockup_instructions: '',
        is_active: product.is_active !== false,
        sort_order: product.sort_order || 0,
        metadata: safeJsonParse(product.metadata, {}),
        created_at: product.created_at || new Date().toISOString(),
        updated_at: product.updated_at || new Date().toISOString(),
      });

      existingSkus.add(sku);
    }

    if (upsertRows.length === 0) return;

    if (dryRun) {
      log.debug(`[DRY RUN] Would upsert ${upsertRows.length} products.`);
      productsMigrated += upsertRows.length;
      return;
    }

    const { error } = await v2.from('products').upsert(upsertRows, { onConflict: 'id' });
    if (error) {
      log.error(`Product batch upsert failed: ${error.message}`);
      for (const row of upsertRows) {
        const { error: singleError } = await v2.from('products').upsert(row, { onConflict: 'id' });
        if (singleError) {
          errorCount++;
          log.error(`  Product ${row.id} (${row.sku}): ${singleError.message}`);
        } else {
          productsMigrated++;
        }
      }
    } else {
      productsMigrated += upsertRows.length;
    }
  });

  // ── Phase 2: Migrate brand_products junction ──────────────────────────
  let brandProductsMigrated = 0;
  let brandProductsSkipped = 0;

  try {
    log.info('\nFetching v1 brand_products...');
    const { rows: v1BrandProducts } = await v1.query(`
      SELECT
        id,
        brand_id,
        product_id,
        quantity,
        retail_price,
        notes,
        selected_at,
        created_at
      FROM public.brand_products
      ORDER BY created_at ASC
    `);
    log.info(`Found ${v1BrandProducts.length} v1 brand_products.`);

    // Fetch valid v2 brand IDs and product IDs
    const { data: v2BrandIds } = await v2.from('brands').select('id');
    const validBrandIds = new Set((v2BrandIds || []).map((b) => b.id));
    const { data: v2ProductIds } = await v2.from('products').select('id');
    const validProductIds = new Set((v2ProductIds || []).map((p) => p.id));

    await processBatches(v1BrandProducts, batchSize, async (batch) => {
      /** @type {Array<Record<string, unknown>>} */
      const upsertRows = [];

      for (const bp of batch) {
        if (!validBrandIds.has(bp.brand_id)) {
          log.debug(`Skipping brand_product ${bp.id} -- brand ${bp.brand_id} not in v2.`);
          brandProductsSkipped++;
          continue;
        }
        if (!validProductIds.has(bp.product_id)) {
          log.debug(`Skipping brand_product ${bp.id} -- product ${bp.product_id} not in v2.`);
          brandProductsSkipped++;
          continue;
        }

        upsertRows.push({
          id: bp.id,
          brand_id: bp.brand_id,
          product_id: bp.product_id,
          quantity: bp.quantity || 1,
          custom_retail_price: bp.retail_price || null,
          notes: bp.notes || '',
          selected_at: bp.selected_at || bp.created_at || new Date().toISOString(),
        });
      }

      if (upsertRows.length === 0) return;

      if (dryRun) {
        log.debug(`[DRY RUN] Would upsert ${upsertRows.length} brand_products.`);
        brandProductsMigrated += upsertRows.length;
        return;
      }

      const { error } = await v2.from('brand_products').upsert(upsertRows, { onConflict: 'id' });
      if (error) {
        log.error(`brand_products batch upsert failed: ${error.message}`);
        for (const row of upsertRows) {
          const { error: singleError } = await v2
            .from('brand_products')
            .upsert(row, { onConflict: 'id' });
          if (singleError) {
            errorCount++;
            log.error(`  brand_product ${row.id}: ${singleError.message}`);
          } else {
            brandProductsMigrated++;
          }
        }
      } else {
        brandProductsMigrated += upsertRows.length;
      }
    });
  } catch {
    log.warn('brand_products table not found or empty -- skipping junction migration.');
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log.section('Products Migration Summary');
  log.table({
    'v1 products': String(v1Products.length),
    'Products migrated': String(productsMigrated),
    'Products skipped': String(productsSkipped),
    'brand_products migrated': String(brandProductsMigrated),
    'brand_products skipped': String(brandProductsSkipped),
    Errors: String(errorCount),
    Duration: timer.elapsed(),
    Mode: dryRun ? 'DRY RUN' : 'LIVE',
  });

  if (productsMigrated > 0 && !dryRun) {
    log.warn('\nPOST-MIGRATION TODO: Manually populate base_cost, retail_price,');
    log.warn('image_url, and mockup_template_url for migrated products.');
    log.warn('These fields are required for the profit calculator and AI mockup pipeline.');
  }

  await closeV1Client();
  return {
    success: errorCount === 0,
    products: productsMigrated,
    brandProducts: brandProductsMigrated,
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
