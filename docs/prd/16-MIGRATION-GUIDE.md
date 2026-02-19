# 16 -- Migration Guide

**Product:** Brand Me Now v1 -> v2 Migration
**Date:** February 19, 2026
**Status:** Ready for development
**Risk Level:** HIGH -- This is the most risk-prone phase of the rebuild.
**Depends on:** 01-PRODUCT-REQUIREMENTS.md, 03-DATABASE-SCHEMA.md, 04-INTEGRATIONS-MAP.md, 09-GREENFIELD-REBUILD-BLUEPRINT.md

---

## 0. Migration Overview

```
OLD SYSTEM (v1)                         NEW SYSTEM (v2)
+------------------------+              +---------------------------+
| Supabase (OLD project) |  ---------> | Supabase (NEW project)    |
|  - profiles            |   migrate   |  - profiles               |
|  - brands              |             |  - brands                 |
|  - brand_assets        |             |  - brand_assets           |
|  - brand_mockups       |  ---------> |  - generation_jobs  (NEW) |
|  - brand_products      |             |  - subscriptions    (NEW) |
|  - products            |             |  - gen_credits      (NEW) |
|  - user_socials        |             |  - audit_log        (NEW) |
|  - ghl_contacts        |             |  - products               |
+------------------------+              +---------------------------+
| NocoDB                 |  discard
|  - Wizard Data V2      |  (extract what's useful, discard rest)
|  - wizard_database     |
+------------------------+
| Supabase Storage (OLD) |  ---------> | Supabase Storage (NEW)    |
|  - brand-logos         |   migrate   |  + Cloudflare R2           |
|  - brand-mockups       |             |    (generated images)      |
|  - product-images      |             +---------------------------+
|  - product-masks       |
+------------------------+
| GoHighLevel            |  ---------> | GoHighLevel               |
|  - Contacts + fields   |   update    |  - Same contacts           |
|  - Hardcoded field IDs |   mappings  |  - Config-driven fields    |
|  - Password fields     |   remove    |  - No passwords            |
+------------------------+              +---------------------------+
```

### Migration Principles

1. **Never delete old data until new system is verified** -- keep old Supabase project alive for 2 weeks minimum post-cutover.
2. **Migrate in stages** -- database first, then assets, then DNS. Each stage verifiable independently.
3. **Dry run everything** -- run migration scripts against a staging Supabase project before touching production.
4. **Rollback at every step** -- if any stage fails, revert to old system with zero data loss.
5. **Users should not lose any brands, logos, mockups, or account data.**

---

## 1. Data Migration Strategy

### 1.1 Supabase OLD -> Supabase NEW

The old and new Supabase projects are separate instances. Data must be extracted from the old project and loaded into the new one with schema transformations applied.

#### Approach: pg_dump + Transform + pg_restore

```bash
# Step 1: Export old database
pg_dump --no-owner --no-acl \
  --table=public.profiles \
  --table=public.brands \
  --table=public.brand_assets \
  --table=public.brand_mockups \
  --table=public.brand_products \
  --table=public.products \
  --table=public.user_socials \
  --table=public.ghl_contacts \
  -h db.OLD_PROJECT.supabase.co \
  -U postgres \
  -d postgres \
  > old_data_export.sql

# Step 2: Run transformation script (see below)
node scripts/migrate/transform-data.js

# Step 3: Import into new Supabase project
psql -h db.NEW_PROJECT.supabase.co \
  -U postgres \
  -d postgres \
  < transformed_data.sql
```

#### Auth Users Migration

Supabase Auth users live in the `auth` schema and require the Supabase CLI or Management API for migration:

```bash
# Export auth users via Supabase Management API
# Note: passwords are hashed -- they transfer as-is (bcrypt hashes)
supabase db dump --linked --data-only --schema auth > auth_users_export.sql

# Filter to only auth.users and auth.identities tables
# Import into new project
supabase db push --linked < auth_users_export.sql
```

**Important:** After importing auth users, verify that:
- Users can log in with existing email/password credentials
- Google OAuth identities are linked (may require re-auth on first login)
- JWT secrets differ between old and new projects -- existing JWTs will NOT work after cutover

### 1.2 Table-by-Table Migration

#### profiles (OLD -> NEW)

**Schema changes:**
- REMOVE: `password` column (was storing hashed password redundantly -- Supabase Auth handles this)
- ADD: `avatar_url TEXT` (new field for user avatars)
- ADD: `stripe_customer_id TEXT` (Stripe integration)
- ADD: `subscription_tier TEXT DEFAULT 'free'` (subscription system)
- ADD: `org_id UUID` (future multi-tenant)
- RENAME: `tc_accepted_at` stays the same

```sql
-- Migration SQL: profiles
-- Run AFTER auth.users have been imported

INSERT INTO new_project.public.profiles (
  id,
  email,
  phone,
  full_name,
  -- password OMITTED (no longer stored in profiles)
  avatar_url,
  tc_accepted_at,
  stripe_customer_id,
  subscription_tier,
  org_id,
  created_at,
  updated_at
)
SELECT
  op.id,
  op.email,
  op.phone,
  op.full_name,
  -- op.password OMITTED
  NULL AS avatar_url,              -- New field, no old data
  op.tc_accepted_at,
  NULL AS stripe_customer_id,      -- Will be set when user subscribes
  'free' AS subscription_tier,     -- All existing users start on free
  NULL AS org_id,                  -- Future feature
  op.created_at,
  op.updated_at
FROM old_export.profiles op
WHERE op.id IN (SELECT id FROM auth.users);  -- Only users who exist in auth

-- Verification:
-- SELECT COUNT(*) FROM profiles;  -- Should match old count
-- SELECT COUNT(*) FROM profiles WHERE email IS NULL;  -- Should be 0
```

#### brands (OLD -> NEW)

**Schema changes:**
- REMOVE: `description` column (merged into `vision`)
- REMOVE: `label_design` column (no longer a separate concept)
- REMOVE: `step_url` column (replaced by wizard_step as URL path)
- CHANGE: `wizard_step` from INT to TEXT (URL path instead of magic number)
- CHANGE: `brand_archetype` -> `archetype` (shorter column name)
- CHANGE: `brand_values` -> stays `brand_values` (same)
- CHANGE: `target_audience` -> stays (same)
- ADD: `social_data JSONB` (stores raw social analysis inline instead of separate join)

```sql
-- Migration SQL: brands

INSERT INTO new_project.public.brands (
  id,
  user_id,
  status,
  name,
  vision,
  color_palette,
  fonts,
  logo_style,
  archetype,
  brand_values,
  target_audience,
  wizard_step,
  social_data,
  created_at,
  updated_at
)
SELECT
  ob.id,
  ob.user_id,
  ob.status,
  ob.name,
  -- Merge description into vision if vision is empty
  COALESCE(ob.vision, ob.description) AS vision,
  ob.color_palette,
  ob.fonts,
  ob.logo_style,
  ob.brand_archetype AS archetype,          -- Column rename
  ob.brand_values,
  ob.target_audience,
  -- Convert integer wizard_step to URL path
  CASE ob.wizard_step
    WHEN 0 THEN 'onboarding'
    WHEN 1 THEN 'onboarding'
    WHEN 2 THEN 'social-analysis'
    WHEN 3 THEN 'brand-identity'
    WHEN 4 THEN 'customization'
    WHEN 5 THEN 'logo-generation'
    WHEN 6 THEN 'logo-refinement'
    WHEN 7 THEN 'product-selection'
    WHEN 8 THEN 'mockup-review'
    WHEN 9 THEN 'bundle-builder'
    WHEN 10 THEN 'profit-calculator'
    WHEN 11 THEN 'checkout'
    WHEN 12 THEN 'complete'
    ELSE 'onboarding'
  END AS wizard_step,
  -- Pull in social data from user_socials (denormalize)
  (
    SELECT jsonb_agg(jsonb_build_object(
      'platform', us.platform,
      'handle', us.handle,
      'profile_url', us.profile_url,
      'analysis_data', us.analysis_data,
      'analyzed_at', us.analyzed_at
    ))
    FROM old_export.user_socials us
    WHERE us.user_id = ob.user_id
  ) AS social_data,
  ob.created_at,
  ob.updated_at
FROM old_export.brands ob
WHERE ob.user_id IN (SELECT id FROM new_project.public.profiles);

-- Verification:
-- SELECT COUNT(*) FROM brands;  -- Should match old count
-- SELECT COUNT(*) FROM brands WHERE wizard_step IS NULL;  -- Should be 0
-- SELECT DISTINCT wizard_step FROM brands;  -- Should all be valid URL paths
```

#### brand_assets (OLD -> NEW)

**Schema changes:**
- RENAME: `file_url` -> `url`
- REMOVE: `file_name` (can be derived from URL)
- RENAME: `is_primary` -> `is_selected`
- ADD: `thumbnail_url TEXT` (for optimized thumbnails)
- Existing logos and brand guides keep their asset_type values

**Also: merge brand_mockups INTO brand_assets** (unified asset table in v2):

```sql
-- Migration SQL: brand_assets (from old brand_assets)

INSERT INTO new_project.public.brand_assets (
  id,
  brand_id,
  asset_type,
  url,
  thumbnail_url,
  metadata,
  is_selected,
  created_at
)
SELECT
  oba.id,
  oba.brand_id,
  oba.asset_type,
  oba.file_url AS url,
  NULL AS thumbnail_url,               -- Will be generated post-migration
  COALESCE(oba.metadata, '{}'::jsonb) AS metadata,
  COALESCE(oba.is_primary, false) AS is_selected,
  oba.created_at
FROM old_export.brand_assets oba
WHERE oba.brand_id IN (SELECT id FROM new_project.public.brands);

-- Migration SQL: brand_assets (from old brand_mockups -> merge into brand_assets)

INSERT INTO new_project.public.brand_assets (
  id,
  brand_id,
  asset_type,
  url,
  thumbnail_url,
  metadata,
  is_selected,
  created_at
)
SELECT
  obm.id,
  obm.brand_id,
  'mockup' AS asset_type,
  obm.mockup_url AS url,
  NULL AS thumbnail_url,
  jsonb_build_object(
    'product_id', obm.product_id,
    'prompt_used', obm.prompt_used,
    'generation_params', obm.generation_params,
    'variation_number', obm.variation_number,
    'label_url', obm.label_url,
    'old_status', obm.status
  ) AS metadata,
  CASE WHEN obm.status = 'approved' THEN true ELSE false END AS is_selected,
  obm.created_at
FROM old_export.brand_mockups obm
WHERE obm.brand_id IN (SELECT id FROM new_project.public.brands);

-- Verification:
-- SELECT asset_type, COUNT(*) FROM brand_assets GROUP BY asset_type;
-- Check that logo count matches old brand_assets count
-- Check that mockup count matches old brand_mockups count
-- SELECT COUNT(*) FROM brand_assets WHERE url IS NULL;  -- Should be 0
```

#### products (OLD -> NEW)

**Schema changes:**
- ADD: `base_cost DECIMAL(10,2)` (was missing in old schema)
- ADD: `retail_price DECIMAL(10,2)` (was missing in old schema)
- ADD: `image_url TEXT` (reference product photo)
- ADD: `mockup_template_url TEXT` (template for AI generation)
- ADD: `metadata JSONB` (extensible product data)

```sql
-- Migration SQL: products

INSERT INTO new_project.public.products (
  id,
  sku,
  name,
  category,
  base_cost,
  retail_price,
  image_url,
  mockup_template_url,
  is_active,
  metadata
)
SELECT
  op.id,
  op.sku,
  op.name,
  op.category,
  NULL AS base_cost,                    -- Needs manual data entry post-migration
  NULL AS retail_price,                 -- Needs manual data entry post-migration
  NULL AS image_url,                    -- Needs manual upload post-migration
  NULL AS mockup_template_url,          -- Needs setup for new AI pipeline
  op.is_active,
  '{}'::jsonb AS metadata
FROM old_export.products op;

-- Post-migration TODO: Manually populate base_cost, retail_price, image_url,
-- and mockup_template_url for each product. These fields are required for the
-- new profit calculator and AI mockup pipeline.

-- Verification:
-- SELECT COUNT(*) FROM products;  -- Should match old count
-- SELECT COUNT(*) FROM products WHERE sku IS NULL;  -- Should be 0
-- SELECT COUNT(*) FROM products WHERE base_cost IS NULL;  -- Track how many need pricing
```

#### New Tables (no migration -- create empty)

These tables are new in v2 and start empty:

```sql
-- These are created by Supabase migrations, not by data migration.
-- Listed here for completeness.

-- generation_jobs: Tracks async AI generation (BullMQ integration)
-- No old data to migrate -- old system had no job tracking.

-- subscriptions: Stripe subscription records
-- No old data -- payment system is new.

-- generation_credits: Usage tracking per user
-- Initialize all migrated users with free tier credits:

INSERT INTO generation_credits (user_id, credits_remaining, credits_used, last_refill_at)
SELECT
  p.id,
  4 AS credits_remaining,    -- Free tier: 4 logo generations
  0 AS credits_used,
  NOW() AS last_refill_at
FROM profiles p;

-- audit_log: Start fresh -- no old audit data to migrate.
```

### 1.3 NocoDB Data Extraction

**Strategy: Extract useful data, discard the system.**

NocoDB contains two tables that may have data not fully synced to Supabase:

| NocoDB Table | What to extract | Destination |
|-------------|----------------|-------------|
| Wizard Data V2 | Brand wizard form data that may not exist in Supabase `brands` | Merge into `brands` table |
| wizard_database | Original wizard storage (superseded) | Discard entirely |

#### Extraction Script

```javascript
// scripts/migrate/extract-nocodb.js

import { Api } from 'nocodb-sdk';

const NOCODB_URL = process.env.NC_URL;
const NOCODB_TOKEN = process.env.NC_AUTH_TOKEN;
const TABLE_ID = process.env.NC_TABLE_ID;

async function extractNocoDB() {
  const api = new Api({ baseURL: NOCODB_URL, headers: { 'xc-auth': NOCODB_TOKEN } });

  // Fetch all records from Wizard Data V2
  const records = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await api.dbTableRow.list('v1', TABLE_ID, { offset, limit });
    records.push(...batch.list);
    if (batch.list.length < limit) break;
    offset += limit;
  }

  console.log(`Extracted ${records.length} NocoDB records`);

  // Cross-reference with Supabase brands table
  // Find records in NocoDB that DON'T exist in Supabase (data drift)
  const missingRecords = [];
  for (const record of records) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', record.session_id)
      .single();

    if (!brand) {
      missingRecords.push(record);
    }
  }

  console.log(`Found ${missingRecords.length} NocoDB records not in Supabase`);

  // Export missing records for manual review
  // These may be abandoned wizard sessions or data drift
  const fs = await import('fs');
  fs.writeFileSync(
    'nocodb-orphaned-records.json',
    JSON.stringify(missingRecords, null, 2)
  );

  console.log('Orphaned records written to nocodb-orphaned-records.json');
  console.log('MANUAL REVIEW REQUIRED: Decide which records to import into new Supabase');
}

extractNocoDB().catch(console.error);
```

**Decision point:** After extracting orphaned NocoDB records, manually review them. Most will be abandoned wizard sessions that can be safely discarded. Any records with completed brands that somehow never made it to Supabase should be merged into the new `brands` table.

**After migration is verified:** Delete the NocoDB instance entirely. Remove all `NC_*` environment variables. Delete the `nocodb_client.py` file.

---

## 2. Asset Migration

### 2.1 Storage Architecture Change

```
OLD:                                    NEW:
Supabase Storage                        Supabase Storage (same project)
  brand-logos/                            brand-logos/      (user uploads, originals)
  brand-mockups/                          brand-mockups/    (kept for reference)
  product-images/                         product-images/
  product-masks/                          product-masks/

                                        Cloudflare R2 (NEW -- generated images)
                                          logos/            (AI-generated logos)
                                          mockups/          (AI-generated mockups)
                                          bundles/          (AI-generated bundles)
```

### 2.2 Migration Script

```javascript
// scripts/migrate/migrate-assets.js

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const oldSupabase = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_SERVICE_KEY);
const newSupabase = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_SERVICE_KEY);

// R2 uses S3-compatible API
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKETS = ['brand-logos', 'brand-mockups', 'product-images', 'product-masks'];

async function migrateAssets() {
  const results = { success: 0, failed: 0, errors: [] };

  for (const bucket of BUCKETS) {
    console.log(`\nMigrating bucket: ${bucket}`);

    // List all files in old bucket
    const { data: files, error: listError } = await oldSupabase.storage
      .from(bucket)
      .list('', { limit: 10000, sortBy: { column: 'created_at', order: 'asc' } });

    if (listError) {
      console.error(`Failed to list ${bucket}:`, listError);
      results.errors.push({ bucket, error: listError.message });
      continue;
    }

    console.log(`  Found ${files.length} files`);

    for (const file of files) {
      try {
        // Download from old storage
        const { data: fileData, error: downloadError } = await oldSupabase.storage
          .from(bucket)
          .download(file.name);

        if (downloadError) throw downloadError;

        const buffer = Buffer.from(await fileData.arrayBuffer());

        // Upload to new Supabase Storage (same bucket structure)
        const { error: uploadError } = await newSupabase.storage
          .from(bucket)
          .upload(file.name, buffer, {
            contentType: file.metadata?.mimetype || 'image/png',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // For AI-generated images, ALSO upload to R2 for CDN delivery
        if (bucket === 'brand-logos' || bucket === 'brand-mockups') {
          const r2Key = `${bucket.replace('brand-', '')}/${file.name}`;
          await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key,
            Body: buffer,
            ContentType: file.metadata?.mimetype || 'image/png',
          }));
        }

        results.success++;
        if (results.success % 100 === 0) console.log(`  Progress: ${results.success} files migrated`);
      } catch (err) {
        results.failed++;
        results.errors.push({ bucket, file: file.name, error: err.message });
        console.error(`  FAILED: ${bucket}/${file.name}: ${err.message}`);
      }
    }
  }

  console.log('\n--- Asset Migration Summary ---');
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${JSON.stringify(results.errors, null, 2)}`);
  }

  return results;
}

migrateAssets().catch(console.error);
```

### 2.3 URL Rewriting

After migrating assets, update all URL references in the database to point to the new storage locations:

```sql
-- URL rewriting: Update brand_assets URLs to new Supabase Storage domain

-- Step 1: Identify old URL pattern
-- Old: https://OLD_PROJECT.supabase.co/storage/v1/object/public/brand-logos/...
-- New: https://NEW_PROJECT.supabase.co/storage/v1/object/public/brand-logos/...

UPDATE brand_assets
SET url = REPLACE(
  url,
  'https://OLD_PROJECT_REF.supabase.co/storage/v1/object/public/',
  'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/'
)
WHERE url LIKE '%OLD_PROJECT_REF.supabase.co%';

-- Step 2: For logos/mockups also stored in R2, add R2 CDN URL to metadata
-- (The app will prefer R2 URLs for delivery, fall back to Supabase Storage)

UPDATE brand_assets
SET metadata = metadata || jsonb_build_object(
  'r2_url',
  REPLACE(
    REPLACE(url, 'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/brand-', 'https://YOUR_R2_DOMAIN/'),
    'brand-logos/', 'logos/'
  )
)
WHERE asset_type IN ('logo', 'mockup')
  AND url LIKE '%supabase.co%';

-- Step 3: Also update mockup metadata that contains label_url references
UPDATE brand_assets
SET metadata = jsonb_set(
  metadata,
  '{label_url}',
  to_jsonb(REPLACE(
    metadata->>'label_url',
    'https://OLD_PROJECT_REF.supabase.co/storage/v1/object/public/',
    'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/'
  ))
)
WHERE metadata->>'label_url' IS NOT NULL
  AND metadata->>'label_url' LIKE '%OLD_PROJECT_REF%';

-- Verification:
-- SELECT COUNT(*) FROM brand_assets WHERE url LIKE '%OLD_PROJECT_REF%';  -- Should be 0
-- SELECT COUNT(*) FROM brand_assets WHERE url IS NULL OR url = '';  -- Should be 0
```

### 2.4 Asset Verification

```javascript
// scripts/migrate/verify-assets.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_SERVICE_KEY);

async function verifyAssets() {
  const { data: assets, error } = await supabase
    .from('brand_assets')
    .select('id, url, asset_type, metadata');

  if (error) throw error;

  let accessible = 0;
  let broken = 0;
  const brokenAssets = [];

  for (const asset of assets) {
    try {
      const response = await fetch(asset.url, { method: 'HEAD' });
      if (response.ok) {
        accessible++;
      } else {
        broken++;
        brokenAssets.push({ id: asset.id, url: asset.url, status: response.status });
      }
    } catch (err) {
      broken++;
      brokenAssets.push({ id: asset.id, url: asset.url, error: err.message });
    }
  }

  console.log(`\n--- Asset Verification ---`);
  console.log(`Total assets: ${assets.length}`);
  console.log(`Accessible: ${accessible}`);
  console.log(`Broken: ${broken}`);

  if (brokenAssets.length > 0) {
    console.log(`\nBroken assets:`);
    console.table(brokenAssets);
  }

  return { total: assets.length, accessible, broken, brokenAssets };
}

verifyAssets().catch(console.error);
```

---

## 3. GHL Contact Migration

### 3.1 Strategy: Keep Contacts, Update Configuration

Existing GoHighLevel contacts **stay in place**. The CRM data (contacts, tags, pipeline positions, workflow triggers) is preserved. What changes is how the new system interacts with GHL.

### 3.2 Field Mapping Update

**OLD approach:** 9 custom field IDs hardcoded as string constants in Python source code.

**NEW approach:** Config-driven YAML file validated at server startup.

```yaml
# OLD: Hardcoded in Python source
# {
#     "brand_vision": "7gTEXhtHJ20LXwSXP9EZ",
#     "brand_info": "YYIHFkR0MJbCv40cerrU",
#     "logo_url": "upQvGHd7GWg16dSQqJ73",
#     "mockup_url": "SkN9Yaimnw4ZC674yWHV",
#     "social_handle": "Z8cGrbi295489NAn7hHT",
#     "social_url": "8BNIEqOskmnb42bYarw8",
#     "product_skus": "m08fiHiqR4unBNodhGrW",
#     "bmn_username": "puq0UAa4aJTAxZ4hwDYO",    <- REMOVE
#     "bmn_password": "oPaUSdgHGbfAfv5J2Gd4",    <- REMOVE
# }

# NEW: server/config/crm-fields.yaml
ghl:
  location_id: ${GHL_LOCATION_ID}
  oauth:
    client_id: ${GHL_OAUTH_CLIENT_ID}
    client_secret: ${GHL_OAUTH_CLIENT_SECRET}
  field_mappings:
    brand_vision: ${GHL_FIELD_BRAND_VISION}        # Same GHL field ID, now env var
    brand_info: ${GHL_FIELD_BRAND_INFO}
    logo_url: ${GHL_FIELD_LOGO_URL}
    mockup_url: ${GHL_FIELD_MOCKUP_URL}
    social_handle: ${GHL_FIELD_SOCIAL_HANDLE}
    social_url: ${GHL_FIELD_SOCIAL_URL}
    product_skus: ${GHL_FIELD_PRODUCT_SKUS}
    # bmn_username: REMOVED -- no credentials in CRM
    # bmn_password: REMOVED -- no credentials in CRM
  tags:
    wizard_started: 'wizard-started'
    wizard_abandoned: 'wizard-abandoned'
    brand_completed: 'brand-completed'
    paid_subscriber: 'paid-subscriber'
```

### 3.3 Remove Password Fields from GHL

**Critical security fix.** The old system synced `bmn_username` and `bmn_password` to GHL custom fields. This must be cleaned up.

```javascript
// scripts/migrate/clean-ghl-passwords.js
// Run this ONCE during migration to scrub password data from GHL

import fetch from 'node-fetch';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Old hardcoded field IDs for username/password
const USERNAME_FIELD_ID = 'puq0UAa4aJTAxZ4hwDYO';
const PASSWORD_FIELD_ID = 'oPaUSdgHGbfAfv5J2Gd4';

async function cleanGHLPasswords() {
  let offset = 0;
  const limit = 100;
  let totalCleaned = 0;
  let totalContacts = 0;

  while (true) {
    // Fetch contacts page
    const response = await fetch(
      `${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
    );
    const data = await response.json();

    if (!data.contacts || data.contacts.length === 0) break;
    totalContacts += data.contacts.length;

    for (const contact of data.contacts) {
      const customFields = contact.customFields || [];
      const hasUsername = customFields.some(f => f.id === USERNAME_FIELD_ID && f.value);
      const hasPassword = customFields.some(f => f.id === PASSWORD_FIELD_ID && f.value);

      if (hasUsername || hasPassword) {
        // Clear username and password fields
        await fetch(`${GHL_API_BASE}/contacts/${contact.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
          body: JSON.stringify({
            customFields: [
              { id: USERNAME_FIELD_ID, value: '' },
              { id: PASSWORD_FIELD_ID, value: '' },
            ],
          }),
        });

        totalCleaned++;
        console.log(`Cleaned contact ${contact.id} (${contact.email})`);
      }
    }

    offset += limit;
    console.log(`Processed ${totalContacts} contacts, cleaned ${totalCleaned}`);

    // Rate limit: GHL API allows ~10 req/s
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n--- GHL Password Cleanup ---`);
  console.log(`Total contacts scanned: ${totalContacts}`);
  console.log(`Contacts cleaned: ${totalCleaned}`);
}

cleanGHLPasswords().catch(console.error);
```

### 3.4 GHL Auth Migration

**OLD:** Static bearer token that never rotates.
**NEW:** OAuth 2.0 with automatic token refresh.

Steps:
1. Register a new OAuth app in GHL Marketplace (or request OAuth credentials from GHL support)
2. Implement OAuth 2.0 authorization code flow in the new Express.js server
3. Store refresh tokens securely (encrypted in database or env var)
4. Auto-refresh access tokens before expiry
5. Deprecate the static bearer token after verifying OAuth works

### 3.5 GHL Contact Verification

```javascript
// scripts/migrate/verify-ghl.js

async function verifyGHLContacts() {
  const { data: users } = await supabase.from('profiles').select('id, email');

  let matched = 0;
  let missing = 0;
  const missingUsers = [];

  for (const user of users) {
    const response = await fetch(
      `${GHL_API_BASE}/contacts/lookup?email=${encodeURIComponent(user.email)}&locationId=${GHL_LOCATION_ID}`,
      { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
    );
    const data = await response.json();

    if (data.contacts && data.contacts.length > 0) {
      matched++;
    } else {
      missing++;
      missingUsers.push(user.email);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`GHL Contacts: ${matched} matched, ${missing} missing`);
  if (missingUsers.length > 0) {
    console.log('Missing users (will be created on first login):', missingUsers);
  }
}
```

---

## 4. Environment Variable Migration

### 4.1 Complete Mapping Table

| Category | Old Variable | New Variable | Status | Notes |
|----------|-------------|-------------|--------|-------|
| **Supabase** | `SUPABASE_URL` | `SUPABASE_URL` | CHANGED | New project URL |
| | `SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_ANON_KEY` | RENAMED | Standardized name |
| | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` | CHANGED | New project key |
| | `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | RENAMED | Standardized name |
| | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | CHANGED | New project key |
| | `VITE_SUPABASE_URL` | `VITE_SUPABASE_URL` | CHANGED | New project URL |
| **AI - Anthropic** | _(none)_ | `ANTHROPIC_API_KEY` | NEW | Primary AI provider |
| **AI - OpenAI** | `OPENAI_API_KEY` | `OPENAI_API_KEY` | KEPT | Now for image gen only (GPT Image 1.5) |
| | `CHATBOT_OPENAI_MODEL` | _(removed)_ | REMOVED | Chatbot now uses Claude Haiku 4.5 |
| **AI - Google** | `GEMINI_API_KEY` | `GOOGLE_API_KEY` | RENAMED | Unified Google API key |
| | `GOOGLE_API_KEY` | `GOOGLE_API_KEY` | KEPT | Same |
| **AI - Image** | `FAL_KEY` | `FAL_KEY` | KEPT | Fal.ai for prototype, optional in production |
| | `FAL_MODEL` | _(removed)_ | REMOVED | Model selection handled by skill modules |
| | _(none)_ | `BFL_API_KEY` | NEW | FLUX.2 Pro direct API (production logos) |
| | _(none)_ | `IDEOGRAM_API_KEY` | NEW | Ideogram v3 for text-in-image |
| **GHL** | `HIGHLEVEL_ACCESS_TOKEN` | _(removed)_ | REMOVED | Replaced by OAuth |
| | `GHL_API_KEY` | _(removed)_ | REMOVED | Replaced by OAuth |
| | `HIGHLEVEL_LOCATION_ID` | `GHL_LOCATION_ID` | RENAMED | Standardized |
| | `GHL_LOCATION_ID` | `GHL_LOCATION_ID` | KEPT | Same |
| | `HIGHLEVEL_CALENDAR_ID` | `GHL_CALENDAR_ID` | RENAMED | Standardized |
| | `GHL_CF_BRAND_LOGO_URL_ID` | `GHL_FIELD_LOGO_URL` | RENAMED | Config-driven pattern |
| | `GHL_CF_BRAND_MOCKUP_URL_ID` | `GHL_FIELD_MOCKUP_URL` | RENAMED | Config-driven pattern |
| | _(none)_ | `GHL_OAUTH_CLIENT_ID` | NEW | OAuth 2.0 |
| | _(none)_ | `GHL_OAUTH_CLIENT_SECRET` | NEW | OAuth 2.0 |
| | _(none)_ | `GHL_FIELD_BRAND_VISION` | NEW | Config-driven field mapping |
| | _(none)_ | `GHL_FIELD_BRAND_INFO` | NEW | Config-driven field mapping |
| | _(none)_ | `GHL_FIELD_SOCIAL_HANDLE` | NEW | Config-driven field mapping |
| | _(none)_ | `GHL_FIELD_SOCIAL_URL` | NEW | Config-driven field mapping |
| | _(none)_ | `GHL_FIELD_PRODUCT_SKUS` | NEW | Config-driven field mapping |
| **Email** | `CHATBOT_EMAIL_API_KEY` | `RESEND_API_KEY` | RENAMED | Unified |
| | `RESEND_API_KEY` | `RESEND_API_KEY` | KEPT | Same |
| | `CHATBOT_SUPPORT_EMAIL` | `SUPPORT_EMAIL` | RENAMED | |
| | `CHATBOT_FROM_EMAIL` | `FROM_EMAIL` | RENAMED | |
| **Apify** | `APIFY_API_TOKEN` | `APIFY_API_TOKEN` | KEPT | Same |
| | `APIFY_SHARED` | _(removed)_ | REMOVED | Not needed |
| **NocoDB** | `NC_URL` | _(removed)_ | REMOVED | NocoDB eliminated |
| | `NC_AUTH_TOKEN` | _(removed)_ | REMOVED | NocoDB eliminated |
| | `NC_TABLE_ID` | _(removed)_ | REMOVED | NocoDB eliminated |
| | `NC_TABLE2_ID` | _(removed)_ | REMOVED | NocoDB eliminated |
| | All `NC_*` vars | _(removed)_ | REMOVED | NocoDB eliminated |
| **Redis** | _(none)_ | `REDIS_URL` | NEW | BullMQ job queue + cache |
| **Stripe** | _(none)_ | `STRIPE_SECRET_KEY` | NEW | Payment processing |
| | _(none)_ | `STRIPE_PUBLISHABLE_KEY` | NEW | Client-side Stripe |
| | _(none)_ | `STRIPE_WEBHOOK_SECRET` | NEW | Webhook verification |
| **Monitoring** | _(none)_ | `SENTRY_DSN` | NEW | Error tracking |
| | _(none)_ | `NEXT_PUBLIC_POSTHOG_KEY` | NEW | Product analytics |
| | _(none)_ | `NEXT_PUBLIC_POSTHOG_HOST` | NEW | PostHog API host |
| **Storage** | _(none)_ | `R2_ENDPOINT` | NEW | Cloudflare R2 |
| | _(none)_ | `R2_ACCESS_KEY_ID` | NEW | R2 credentials |
| | _(none)_ | `R2_SECRET_ACCESS_KEY` | NEW | R2 credentials |
| | _(none)_ | `R2_BUCKET_NAME` | NEW | R2 bucket |
| **App** | _(none)_ | `VITE_API_URL` | NEW | API server URL for SPA |
| | _(none)_ | `VITE_SOCKET_URL` | NEW | Socket.io server URL |
| | _(none)_ | `NEXT_PUBLIC_APP_URL` | NEW | Marketing -> App bridge |
| **TextRazor** | `TEXTRAZOR_API_KEY` | _(removed)_ | REMOVED | Not used in v2 |
| **Ideogram (old)** | `IDEOGRAM_API_KEY` | `IDEOGRAM_API_KEY` | KEPT | Now primary for text-in-image |

### 4.2 Environment Setup Checklist

```bash
# Generate a .env.template for the new system
# Each service gets its own section with clear documentation

# === SUPABASE (NEW PROJECT) ===
SUPABASE_URL=https://NEW_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VITE_SUPABASE_URL=https://NEW_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# === AI PROVIDERS ===
ANTHROPIC_API_KEY=sk-ant-...          # PRIMARY: Claude Sonnet/Haiku
OPENAI_API_KEY=sk-...                 # Image gen: GPT Image 1.5
GOOGLE_API_KEY=AI...                  # Gemini Flash/Pro + Veo 3
BFL_API_KEY=bfl-...                   # FLUX.2 Pro (logos)
IDEOGRAM_API_KEY=ide-...              # Ideogram v3 (text-in-image)
FAL_KEY=fal-...                       # Fal.ai (prototype only, optional in prod)

# === INFRASTRUCTURE ===
REDIS_URL=redis://localhost:6379

# === PAYMENTS ===
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# === CRM (GoHighLevel) ===
GHL_LOCATION_ID=...
GHL_OAUTH_CLIENT_ID=...
GHL_OAUTH_CLIENT_SECRET=...
GHL_FIELD_BRAND_VISION=7gTEXhtHJ20LXwSXP9EZ
GHL_FIELD_BRAND_INFO=YYIHFkR0MJbCv40cerrU
GHL_FIELD_LOGO_URL=upQvGHd7GWg16dSQqJ73
GHL_FIELD_MOCKUP_URL=SkN9Yaimnw4ZC674yWHV
GHL_FIELD_SOCIAL_HANDLE=Z8cGrbi295489NAn7hHT
GHL_FIELD_SOCIAL_URL=8BNIEqOskmnb42bYarw8
GHL_FIELD_PRODUCT_SKUS=m08fiHiqR4unBNodhGrW

# === EMAIL ===
RESEND_API_KEY=re_...
SUPPORT_EMAIL=support@brandmenow.com
FROM_EMAIL=hello@brandmenow.com

# === SCRAPING ===
APIFY_API_TOKEN=apify_...

# === STORAGE ===
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=bmn-assets

# === MONITORING ===
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# === ANALYTICS ===
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# === APP URLs ===
VITE_API_URL=https://api.brandmenow.com
VITE_SOCKET_URL=https://api.brandmenow.com
NEXT_PUBLIC_APP_URL=https://app.brandmenow.com
```

---

## 5. DNS Cutover Plan

### 5.1 Domain Architecture

| Domain | Points To | Purpose |
|--------|----------|---------|
| `brandmenow.com` | Vercel (marketing site) | Landing, pricing, blog, legal |
| `app.brandmenow.com` | Vercel or Cloudflare Pages (SPA) | Brand Builder React app |
| `api.brandmenow.com` | DO K8s / Cloud Run (API server) | Express.js API |

### 5.2 Step-by-Step Cutover

**Pre-cutover (1 week before):**

```
Day -7: Preparation
  [ ] New Supabase project fully set up with migrated data
  [ ] All assets migrated and verified accessible
  [ ] GHL passwords cleaned, field mappings updated
  [ ] New system fully tested on staging domains:
      - staging.brandmenow.com (marketing)
      - staging-app.brandmenow.com (SPA)
      - staging-api.brandmenow.com (API)
  [ ] SSL certificates provisioned for all production domains
  [ ] Environment variables configured in production
  [ ] Team notified of cutover window

Day -3: Dry Run
  [ ] Run full migration script against staging
  [ ] Run verification queries (Section 6)
  [ ] Run asset verification script
  [ ] Test user login flow end-to-end on staging
  [ ] Test wizard flow end-to-end on staging
  [ ] Measure total migration time (target: < 2 hours)
  [ ] Document any issues found during dry run
  [ ] Fix all issues and re-run dry run if needed

Day -1: Final Prep
  [ ] Notify users of scheduled maintenance window (if any)
  [ ] Prepare rollback DNS records
  [ ] Verify old system DNS TTL is set to 300 seconds (5 min) -- reduces propagation time
```

**Cutover Day (target: Saturday, low traffic):**

```
Hour 0: Begin Cutover
  [ ] Put old system in read-only mode (disable writes to prevent data loss during migration)
  [ ] Take final pg_dump of old Supabase (captures any data since last migration)
  [ ] Run delta migration (only new/changed records since last full migration)

Hour 0.5: Data Sync
  [ ] Run delta data migration script
  [ ] Run asset migration for any new assets since last sync
  [ ] Verify record counts match
  [ ] Run verification queries (Section 6)

Hour 1: DNS Update
  [ ] Update DNS records:
      brandmenow.com        -> Vercel (marketing site)
      app.brandmenow.com    -> Vercel/CF Pages (SPA)
      api.brandmenow.com    -> DO K8s / Cloud Run (API)
  [ ] DNS propagation begins (5-30 min with low TTL)

Hour 1.5: Verification
  [ ] Verify marketing site loads at brandmenow.com
  [ ] Verify SPA loads at app.brandmenow.com
  [ ] Verify API responds at api.brandmenow.com/api/v1/health
  [ ] Test user login with existing credentials
  [ ] Test brand visibility (existing brands appear in dashboard)
  [ ] Test asset loading (logos and mockups display correctly)
  [ ] Test wizard flow (new brand creation works)

Hour 2: Monitor
  [ ] Monitor Sentry for errors
  [ ] Monitor PostHog for user activity
  [ ] Check Supabase dashboard for query patterns
  [ ] Verify Socket.io connections are establishing

Hour 3: Confirm or Rollback
  [ ] If all checks pass: cutover COMPLETE
  [ ] If critical issues: execute rollback plan (Section 7)
  [ ] Keep old system running (do not shut down)

Post-Cutover:
  [ ] Monitor for 48 hours
  [ ] Address any reported issues
  [ ] Confirm with 5-10 real users that their brands/assets are intact
```

### 5.3 DNS Records (Reference)

```
# Production DNS records (Cloudflare or registrar)

# Marketing site (Vercel)
brandmenow.com          CNAME   cname.vercel-dns.com
www.brandmenow.com      CNAME   cname.vercel-dns.com

# Brand Builder SPA (Vercel or Cloudflare Pages)
app.brandmenow.com      CNAME   cname.vercel-dns.com
# OR for Cloudflare Pages:
# app.brandmenow.com    CNAME   bmn-app.pages.dev

# API Server (DigitalOcean K8s Load Balancer or Cloud Run)
api.brandmenow.com      A       <DO_LOAD_BALANCER_IP>
# OR for Cloud Run:
# api.brandmenow.com    CNAME   bmn-api-xxx.a.run.app

# Email (for Resend)
# Verify Resend DNS records are in place:
# SPF, DKIM, DMARC records for brandmenow.com
```

### 5.4 Minimizing Downtime

1. **Set DNS TTL to 300s (5 min)** at least 48 hours before cutover -- ensures fast propagation
2. **Keep old system running during transition** -- users hitting old DNS will still get a working (read-only) app
3. **Use maintenance page on old system** during the 1-2 hour cutover window: "We're upgrading! Back shortly."
4. **Target cutover during lowest-traffic window** -- Saturday morning (US time) based on PostHog data
5. **No data written to old system during cutover** -- read-only mode prevents data loss from split-brain

---

## 6. Verification Checklist

### 6.1 Data Integrity Verification Queries

Run these queries on the NEW Supabase project after migration:

```sql
-- ========================================
-- RECORD COUNT VERIFICATION
-- ========================================

-- Compare counts between old export and new database
-- Run these on BOTH old and new, compare results

-- Users
SELECT 'profiles' AS table_name, COUNT(*) AS record_count FROM profiles;
-- Expected: old count = new count

-- Brands
SELECT 'brands' AS table_name, COUNT(*) AS record_count FROM brands;
-- Expected: old count = new count

-- Brand assets (should equal old brand_assets + old brand_mockups)
SELECT 'brand_assets' AS table_name, COUNT(*) AS record_count FROM brand_assets;
-- Expected: old brand_assets count + old brand_mockups count

-- Asset breakdown by type
SELECT asset_type, COUNT(*) AS count FROM brand_assets GROUP BY asset_type ORDER BY asset_type;
-- Expected: 'logo' count = old brand_assets WHERE asset_type='logo'
-- Expected: 'mockup' count = old brand_mockups count

-- Products
SELECT 'products' AS table_name, COUNT(*) AS record_count FROM products;
-- Expected: old count = new count

-- ========================================
-- DATA QUALITY CHECKS
-- ========================================

-- No orphaned brands (every brand has a valid user)
SELECT COUNT(*) AS orphaned_brands
FROM brands b
LEFT JOIN profiles p ON b.user_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- No orphaned assets (every asset has a valid brand)
SELECT COUNT(*) AS orphaned_assets
FROM brand_assets ba
LEFT JOIN brands b ON ba.brand_id = b.id
WHERE b.id IS NULL;
-- Expected: 0

-- No NULL URLs in assets
SELECT COUNT(*) AS null_urls
FROM brand_assets
WHERE url IS NULL OR url = '';
-- Expected: 0

-- No old Supabase URLs remaining (URL rewrite verification)
SELECT COUNT(*) AS old_urls
FROM brand_assets
WHERE url LIKE '%OLD_PROJECT_REF%';
-- Expected: 0

-- Wizard step values are all valid URL paths
SELECT DISTINCT wizard_step, COUNT(*) AS count
FROM brands
GROUP BY wizard_step
ORDER BY wizard_step;
-- Expected: only valid paths (onboarding, social-analysis, brand-identity, etc.)

-- No password column in profiles
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'password';
-- Expected: 0 rows (column should not exist)

-- All users have generation credits initialized
SELECT COUNT(*) AS users_without_credits
FROM profiles p
LEFT JOIN generation_credits gc ON p.id = gc.user_id
WHERE gc.id IS NULL;
-- Expected: 0

-- ========================================
-- RELATIONSHIP INTEGRITY
-- ========================================

-- Every profile has a corresponding auth.users entry
SELECT COUNT(*) AS orphaned_profiles
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;
-- Expected: 0

-- Brand count per user (sanity check)
SELECT
  p.email,
  COUNT(b.id) AS brand_count
FROM profiles p
LEFT JOIN brands b ON p.id = b.user_id
GROUP BY p.email
ORDER BY brand_count DESC
LIMIT 20;
-- Expected: reasonable distribution, no user with 1000+ brands

-- ========================================
-- JSONB DATA INTEGRITY
-- ========================================

-- Color palette is valid JSONB array
SELECT COUNT(*) AS invalid_palettes
FROM brands
WHERE color_palette IS NOT NULL
  AND jsonb_typeof(color_palette) != 'array';
-- Expected: 0

-- Brand values is valid JSONB array
SELECT COUNT(*) AS invalid_values
FROM brands
WHERE brand_values IS NOT NULL
  AND jsonb_typeof(brand_values) != 'array';
-- Expected: 0

-- Social data is valid JSONB (array or null)
SELECT COUNT(*) AS invalid_social
FROM brands
WHERE social_data IS NOT NULL
  AND jsonb_typeof(social_data) NOT IN ('array', 'null');
-- Expected: 0
```

### 6.2 Functional Verification

Run these checks manually after DNS cutover:

```
AUTHENTICATION
[ ] User can log in with email/password at app.brandmenow.com/login
[ ] User can log in with Google OAuth
[ ] JWT tokens are valid and API calls succeed
[ ] Session persists across page refreshes
[ ] Logout works and clears session

BRAND DATA
[ ] User sees all their existing brands on dashboard
[ ] Brand detail page shows correct name, vision, colors, fonts, archetype
[ ] Color palette renders correctly (JSONB array)
[ ] Font selections display correctly
[ ] Wizard step reflects the correct last-known position

ASSETS
[ ] Logo images load on brand detail page
[ ] Mockup images load on brand detail page
[ ] Asset URLs resolve (no 404s, no broken images)
[ ] Download buttons work for logo/mockup files

WIZARD
[ ] New brand creation starts at step 1
[ ] Returning user can resume wizard from saved step
[ ] Social media analysis works (Apify integration)
[ ] Logo generation produces results (FLUX.2 Pro / Fal.ai)
[ ] Mockup generation produces results (GPT Image 1.5)
[ ] Real-time progress updates appear (Socket.io)

CRM
[ ] New user signup creates GHL contact
[ ] Brand completion updates GHL contact fields
[ ] No password data in GHL contacts
[ ] Tags applied correctly (wizard-started, brand-completed)

EMAIL
[ ] Welcome email sends on signup
[ ] Brand completion email sends with correct logo
[ ] Support email from contact form delivers

MARKETING SITE
[ ] brandmenow.com loads (landing page)
[ ] /pricing shows correct tiers ($0, $29, $79, $199)
[ ] /blog loads with posts
[ ] CTAs link to app.brandmenow.com correctly
[ ] SEO meta tags present (inspect with View Source)
```

### 6.3 Performance Verification

```
[ ] API health check responds in < 100ms: GET api.brandmenow.com/api/v1/health
[ ] Dashboard loads brands in < 500ms
[ ] Marketing site Lighthouse score > 95
[ ] Socket.io connection establishes in < 500ms
[ ] No memory leaks after 1 hour of operation (monitor with Sentry)
```

---

## 7. Rollback Plan

### 7.1 When to Rollback

Trigger a rollback if ANY of these occur within the first 48 hours:

- Users cannot log in (auth completely broken)
- More than 20% of assets return 404 (broken images)
- API error rate exceeds 10% (Sentry alerts)
- Data integrity queries show orphaned records
- Payment processing fails (if Stripe is live)
- Multiple users report missing brands or data

### 7.2 Rollback Procedure

```
IMMEDIATE (< 15 minutes):

  Step 1: Revert DNS records to old system
    [ ] brandmenow.com -> old Vercel deployment
    [ ] app.brandmenow.com -> old Vercel deployment
    [ ] (api.brandmenow.com wasn't used in old system -- just remove the record)

  Step 2: Disable read-only mode on old system
    [ ] Re-enable writes on old Supabase
    [ ] Old system is now fully operational again

  Step 3: Notify team
    [ ] Post in team channel: "Rollback executed. Old system is live."
    [ ] Document what went wrong

POST-ROLLBACK (same day):

  Step 4: Capture any data written to new system during cutover window
    [ ] Export any new user signups from new Supabase (if any)
    [ ] Export any new brands created on new system (if any)
    [ ] Merge back into old system if needed

  Step 5: Root cause analysis
    [ ] Review Sentry errors from new system
    [ ] Review verification query results
    [ ] Identify specific failure points
    [ ] Create fix plan before next cutover attempt

  Step 6: Schedule next cutover attempt
    [ ] Fix identified issues
    [ ] Re-run dry run on staging
    [ ] Schedule new cutover window (minimum 48 hours later)
```

### 7.3 Rollback Prerequisites

These must be in place BEFORE any cutover attempt:

```
[ ] Old Supabase project is NOT deleted (keep for 2 weeks minimum post-cutover)
[ ] Old Vercel deployment is NOT removed
[ ] Old DNS records documented (ready to restore in < 5 minutes)
[ ] Old system put in read-only mode (not shut down)
[ ] Old .env files backed up separately
[ ] Old system can be restored to full operation in < 15 minutes
```

### 7.4 Post-Cutover Old System Decommission Timeline

```
Day 0:     Cutover complete. Old system in read-only mode.
Day 1-2:   Monitor new system. Address issues.
Day 3-7:   Verify with real users. Collect feedback.
Day 7:     If no issues: schedule old system decommission.
Day 14:    Decommission old Supabase project.
             - Take final backup
             - Delete old project (saves $25/mo)
Day 14:    Remove old Vercel deployment.
Day 14:    Delete NocoDB instance.
Day 14:    Revoke old API keys (GHL bearer token, old Supabase keys).
Day 30:    Remove all migration scripts from codebase.
           Delete nocodb_client.py.
           Remove all NC_* env var references.
           Archive this migration guide as completed.
```

---

## 8. Migration Script Outline

### 8.1 Master Migration Script

```javascript
// scripts/migrate/run-migration.js
// Master orchestrator -- runs all migration steps in order

import { migrateAuthUsers } from './steps/01-auth-users.js';
import { migrateProfiles } from './steps/02-profiles.js';
import { migrateBrands } from './steps/03-brands.js';
import { migrateBrandAssets } from './steps/04-brand-assets.js';
import { migrateBrandMockups } from './steps/05-brand-mockups.js';
import { migrateProducts } from './steps/06-products.js';
import { initializeNewTables } from './steps/07-new-tables.js';
import { migrateAssets } from './steps/08-assets.js';
import { rewriteUrls } from './steps/09-rewrite-urls.js';
import { cleanGHLPasswords } from './steps/10-ghl-cleanup.js';
import { verifyMigration } from './steps/11-verify.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function runMigration() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BRAND ME NOW: v1 -> v2 MIGRATION`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const steps = [
    { name: 'Auth Users', fn: migrateAuthUsers },
    { name: 'Profiles', fn: migrateProfiles },
    { name: 'Brands', fn: migrateBrands },
    { name: 'Brand Assets', fn: migrateBrandAssets },
    { name: 'Brand Mockups -> Assets', fn: migrateBrandMockups },
    { name: 'Products', fn: migrateProducts },
    { name: 'Initialize New Tables', fn: initializeNewTables },
    { name: 'Asset Files', fn: migrateAssets },
    { name: 'URL Rewriting', fn: rewriteUrls },
    { name: 'GHL Password Cleanup', fn: cleanGHLPasswords },
    { name: 'Verification', fn: verifyMigration },
  ];

  const results = [];

  for (const step of steps) {
    console.log(`\n--- Step: ${step.name} ---`);
    const start = Date.now();

    try {
      const result = await step.fn({ dryRun: DRY_RUN });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ step: step.name, status: 'SUCCESS', elapsed: `${elapsed}s`, ...result });
      console.log(`  DONE in ${elapsed}s`);
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ step: step.name, status: 'FAILED', elapsed: `${elapsed}s`, error: err.message });
      console.error(`  FAILED: ${err.message}`);

      // Ask whether to continue or abort
      if (!DRY_RUN) {
        console.error(`\n  MIGRATION HALTED at step: ${step.name}`);
        console.error(`  Review the error above, fix the issue, and re-run.`);
        console.error(`  Previous successful steps are idempotent and safe to re-run.`);
        process.exit(1);
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MIGRATION SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.table(results);

  const failed = results.filter(r => r.status === 'FAILED');
  if (failed.length > 0) {
    console.log(`\n  ${failed.length} step(s) FAILED. Review errors above.`);
    process.exit(1);
  } else {
    console.log(`\n  All steps completed successfully.`);
    console.log(`  Run verification queries (Section 6) to confirm data integrity.`);
  }
}

runMigration().catch(err => {
  console.error('Migration failed with unhandled error:', err);
  process.exit(1);
});
```

### 8.2 Script Directory Structure

```
scripts/migrate/
├── run-migration.js              # Master orchestrator
├── steps/
│   ├── 01-auth-users.js          # Export + import auth.users
│   ├── 02-profiles.js            # Transform + import profiles
│   ├── 03-brands.js              # Transform + import brands (wizard_step INT->TEXT)
│   ├── 04-brand-assets.js        # Transform + import brand_assets
│   ├── 05-brand-mockups.js       # Merge brand_mockups into brand_assets
│   ├── 06-products.js            # Import products (add new columns)
│   ├── 07-new-tables.js          # Initialize generation_credits, etc.
│   ├── 08-assets.js              # File migration (Supabase Storage -> Storage + R2)
│   ├── 09-rewrite-urls.js        # Update URLs in database
│   ├── 10-ghl-cleanup.js         # Remove passwords from GHL contacts
│   └── 11-verify.js              # Run verification queries
├── extract-nocodb.js             # Standalone NocoDB extraction
├── verify-assets.js              # Standalone asset URL verification
├── verify-ghl.js                 # Standalone GHL contact verification
└── README.md                     # Migration runbook
```

---

## 9. Development Prompt

> You are building migration scripts for Brand Me Now v1 to v2. The migration moves data from an OLD Supabase project to a NEW Supabase project with schema changes. Use JavaScript (Node.js 22 LTS) with JSDoc types. The scripts must be idempotent (safe to re-run). Use `@supabase/supabase-js` for database operations and `@aws-sdk/client-s3` for Cloudflare R2 uploads. Every script must support a `--dry-run` flag that logs what WOULD happen without writing. Every step must log progress and provide counts. The master migration script runs all steps in order and halts on any failure. Old system data must never be deleted -- only read. The migration merges the old `brand_mockups` table into the new unified `brand_assets` table. Wizard step integers (0-12) must be converted to URL path strings. The `password` column is removed from profiles. GHL password fields must be scrubbed. All URLs must be rewritten from old Supabase project to new. After migration, run verification queries to confirm data integrity.

---

## 10. Acceptance Criteria

### Data Migration
- [ ] All `auth.users` records exist in new Supabase project
- [ ] All `profiles` records migrated (minus `password` column)
- [ ] All `brands` records migrated with `wizard_step` converted from INT to URL path TEXT
- [ ] All `brand_assets` records migrated with `file_url` -> `url`, `is_primary` -> `is_selected`
- [ ] All `brand_mockups` merged into `brand_assets` with `asset_type = 'mockup'`
- [ ] All `products` records migrated with new columns (NULL for base_cost/retail_price until populated)
- [ ] `generation_credits` initialized for all users (free tier defaults)
- [ ] Record counts match between old and new for all tables
- [ ] Zero orphaned records (no brands without users, no assets without brands)
- [ ] All JSONB columns contain valid JSON
- [ ] Migration scripts are idempotent (safe to re-run)
- [ ] `--dry-run` mode works without writing to any database

### Asset Migration
- [ ] All files from old Supabase Storage exist in new Supabase Storage
- [ ] AI-generated images (logos, mockups) also uploaded to Cloudflare R2
- [ ] All asset URLs in database point to new storage locations
- [ ] Zero broken asset URLs (verify with HEAD requests)
- [ ] Old Supabase Storage URLs no longer referenced in database

### GHL Migration
- [ ] All GHL contacts preserved (no contacts deleted)
- [ ] `bmn_username` field cleared on all contacts
- [ ] `bmn_password` field cleared on all contacts
- [ ] Field mappings moved to config-driven YAML (not hardcoded)
- [ ] OAuth 2.0 credentials configured (replace static bearer token)
- [ ] CRM sync works with new BullMQ-based worker

### Environment Migration
- [ ] All old env vars mapped to new equivalents
- [ ] All `NC_*` variables removed
- [ ] All new env vars documented in `.env.template`
- [ ] Server startup validation catches missing env vars (crash-fast)
- [ ] No hardcoded API keys or secrets in source code

### DNS Cutover
- [ ] DNS TTL lowered to 300s at least 48 hours before cutover
- [ ] All three domains resolve correctly after cutover (brandmenow.com, app, api)
- [ ] SSL certificates valid for all domains
- [ ] Old system remains accessible during transition period
- [ ] Cutover completes within 2-hour window
- [ ] Rollback can be executed in < 15 minutes

### Verification
- [ ] All verification queries pass (Section 6.1)
- [ ] Functional checks pass (Section 6.2)
- [ ] Performance targets met (Section 6.3)
- [ ] 5+ real users confirm their brands and assets are intact
- [ ] No Sentry alerts in first 48 hours post-cutover
- [ ] Old system decommissioned after 14-day cooling period

### Rollback
- [ ] Rollback procedure documented and tested
- [ ] Old system can be restored in < 15 minutes
- [ ] Old DNS records documented and ready to restore
- [ ] Old Supabase project preserved for 14 days post-cutover
- [ ] Any data written to new system during cutover can be captured and merged back

---

## 11. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Auth users can't log in after migration | Medium | Critical | Test with 5 real accounts on staging. Supabase bcrypt hashes transfer correctly. Google OAuth may need re-auth. |
| Asset URLs broken (404s) | Medium | High | URL rewrite script + verification script. Run HEAD check on every URL before cutover. |
| JSONB data corruption during transform | Low | High | Validate all JSONB columns post-migration. Use `jsonb_typeof()` checks. |
| DNS propagation delay | Medium | Medium | Low TTL (300s). Keep old system running during propagation. |
| NocoDB has data not in Supabase | Medium | Medium | Run extraction script. Manual review of orphaned records. |
| GHL rate limiting during password cleanup | High | Low | 200ms delay between API calls. Can be run over multiple sessions. |
| Migration takes longer than 2-hour window | Low | Medium | Dry run to measure time. Optimize if > 1 hour. |
| Rollback needed but old data has drifted | Low | High | Old system in read-only mode during cutover. No writes to old DB. |

---

## 12. Dependencies on Other PRDs

| PRD | Dependency |
|-----|-----------|
| 01-PRODUCT-REQUIREMENTS | Defines the new subscription tiers and credit system |
| 03-DATABASE-SCHEMA | Documents old schema for transformation SQL |
| 04-INTEGRATIONS-MAP | Documents old GHL field IDs and env vars |
| 09-GREENFIELD-REBUILD-BLUEPRINT | Defines new schema, new env vars, new architecture |
| 15-MARKETING-SITE | DNS cutover includes marketing site deployment |
