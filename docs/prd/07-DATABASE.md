# 07 — Database Specification (Supabase / PostgreSQL 17)

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Status:** Ready for implementation
**Dependencies:** None (build in parallel with 03-SERVER-CORE)
**Build Phase:** Phase 1, Week 1

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Complete SQL Schema](#2-complete-sql-schema)
3. [Row Level Security (RLS) Policies](#3-row-level-security-rls-policies)
4. [Database Functions & Triggers](#4-database-functions--triggers)
5. [Seed Data](#5-seed-data)
6. [Migration Strategy](#6-migration-strategy)
7. [Supabase Storage Buckets](#7-supabase-storage-buckets)
8. [Performance Considerations](#8-performance-considerations)
9. [File Manifest, Development Prompt & Acceptance Criteria](#9-file-manifest-development-prompt--acceptance-criteria)

---

## 1. Schema Overview

### 1.1 Entity Relationship Diagram

```
auth.users (Supabase Auth — managed, do not modify)
     │
     │ 1:1
     ▼
┌──────────────────┐
│    profiles       │
│──────────────────│
│ id (PK = auth)   │
│ email            │
│ phone            │
│ full_name        │
│ avatar_url       │
│ role             │
│ tc_accepted_at   │
│ stripe_cust_id   │
│ subscription_tier│
│ org_id           │
│ onboarding_done  │
│ created_at       │
│ updated_at       │
└──┬──┬──┬──┬──┬───┘
   │  │  │  │  │
   │  │  │  │  └──────────────────────────────────────────────────────────┐
   │  │  │  └────────────────────────────────────────────┐               │
   │  │  └──────────────────────────────┐                │               │
   │  └────────────────┐                │                │               │
   │  1:N              │ 1:N            │ 1:N            │ 1:N           │ 1:N
   ▼                   ▼                ▼                ▼               ▼
┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐
│   brands     │ │gen_credits    │ │subscriptions │ │audit_log  │ │chat_messages │
│──────────────│ │───────────────│ │──────────────│ │───────────│ │──────────────│
│ id (PK)      │ │ id (PK)       │ │ id (PK)      │ │ id (PK)   │ │ id (PK)      │
│ user_id (FK) │ │ user_id (FK)  │ │ user_id (FK) │ │ user_id   │ │ user_id (FK) │
│ status       │ │ credit_type   │ │ stripe_sub_id│ │ action    │ │ brand_id(FK) │
│ name         │ │ remaining     │ │ tier         │ │ resource  │ │ role         │
│ vision       │ │ used          │ │ status       │ │ metadata  │ │ content      │
│ color_palette│ │ period_start  │ │ period_start │ │ ip        │ │ created_at   │
│ fonts        │ │ period_end    │ │ period_end   │ │ created_at│ └──────────────┘
│ logo_style   │ │ created_at    │ │ created_at   │ └───────────┘
│ archetype    │ └───────────────┘ └──────────────┘
│ brand_values │
│ audience     │
│ social_data  │
│ wizard_step  │
│ created_at   │
│ updated_at   │
└──┬──┬──┬──┬──┘
   │  │  │  │
   │  │  │  │  1:N
   │  │  │  └───────────────────────────────────┐
   │  │  │  1:N                                 │
   │  │  └────────────────────┐                 │
   │  │  1:N                  │                 │
   │  └──────────┐            │                 │
   │  1:N        │            │                 │
   ▼             ▼            ▼                 ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐
│brand_assets│ │gen_jobs    │ │brand_products│ │brand_bundles │
│────────────│ │────────────│ │──────────────│ │──────────────│
│ id (PK)    │ │ id (PK)    │ │ id (PK)      │ │ id (PK)      │
│ brand_id   │ │ brand_id   │ │ brand_id(FK) │ │ brand_id(FK) │
│ asset_type │ │ user_id    │ │ product_id   │ │ name         │
│ url        │ │ job_type   │ │ quantity     │ │ description  │
│ thumb_url  │ │ status     │ │ retail_price │ │ total_cost   │
│ metadata   │ │ progress   │ │ notes        │ │ retail_price │
│ is_selected│ │ result     │ │ selected_at  │ │ image_url    │
│ product_id │ │ error      │ └──────┬───────┘ │ created_at   │
│ created_at │ │ bullmq_id  │       │          └──────┬───────┘
└────────────┘ │ created_at │       │                 │
               │ finished_at│       │ N:1             │ 1:N
               └────────────┘       │                 │
                                    ▼                 ▼
                             ┌──────────────┐  ┌─────────────────┐
                             │  products    │  │brand_bundle_items│
                             │──────────────│  │─────────────────│
                             │ id (PK)      │  │ id (PK)         │
                             │ sku (unique) │  │ bundle_id (FK)  │
                             │ name         │  │ product_id (FK) │
                             │ category     │  │ quantity         │
                             │ base_cost    │  └─────────────────┘
                             │ retail_price │
                             │ image_url    │
                             │ template_url │
                             │ mockup_instr │
                             │ is_active    │
                             │ metadata     │
                             │ sort_order   │
                             │ created_at   │
                             │ updated_at   │
                             └──────────────┘

Additional standalone tables:

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ payment_history  │  │  admin_flags     │  │  ghl_sync_log    │
│──────────────────│  │──────────────────│  │──────────────────│
│ id (PK)          │  │ id (PK)          │  │ id (PK)          │
│ user_id (FK)     │  │ flagged_by (FK)  │  │ user_id (FK)     │
│ stripe_payment_id│  │ resource_type    │  │ ghl_contact_id   │
│ amount           │  │ resource_id      │  │ direction        │
│ currency         │  │ reason           │  │ event_type       │
│ status           │  │ status           │  │ payload          │
│ metadata         │  │ notes            │  │ status           │
│ created_at       │  │ created_at       │  │ error            │
└──────────────────┘  │ resolved_at      │  │ created_at       │
                      └──────────────────┘  └──────────────────┘
```

### 1.2 All Tables

| # | Table | Description |
|---|-------|-------------|
| 1 | `profiles` | Extends `auth.users` with app-specific fields (phone, role, Stripe ID, subscription tier) |
| 2 | `brands` | Core brand entity created during wizard (identity, colors, fonts, social data) |
| 3 | `brand_assets` | Unified table for all generated files: logos, mockups, bundle images, social assets |
| 4 | `brand_products` | Junction table linking a brand to selected products from the catalog |
| 5 | `brand_bundles` | Named product bundles a user creates from their selected products |
| 6 | `brand_bundle_items` | Junction table linking a bundle to its constituent products |
| 7 | `products` | Admin-managed product catalog (apparel, accessories, home goods, packaging, digital) |
| 8 | `generation_credits` | Per-user credit tracking with period windows for subscription billing |
| 9 | `generation_jobs` | Async AI job history linked to BullMQ job IDs with progress tracking |
| 10 | `subscriptions` | Stripe subscription records with tier, status, and billing period |
| 11 | `payment_history` | Stripe payment/invoice records for billing history display |
| 12 | `audit_log` | Immutable append-only log of all system events for compliance and debugging |
| 13 | `admin_flags` | Content moderation flags on AI-generated assets |
| 14 | `chat_messages` | AI chatbot conversation history per user/brand |
| 15 | `ghl_sync_log` | GoHighLevel CRM sync event tracking with payload and error logging |

### 1.3 Table Relationships Summary

| Relationship | Type | FK Column | ON DELETE |
|-------------|------|-----------|-----------|
| profiles -> auth.users | 1:1 | profiles.id | CASCADE |
| brands -> profiles | N:1 | brands.user_id | CASCADE |
| brand_assets -> brands | N:1 | brand_assets.brand_id | CASCADE |
| brand_assets -> products | N:1 (nullable) | brand_assets.product_id | SET NULL |
| brand_products -> brands | N:1 | brand_products.brand_id | CASCADE |
| brand_products -> products | N:1 | brand_products.product_id | CASCADE |
| brand_bundles -> brands | N:1 | brand_bundles.brand_id | CASCADE |
| brand_bundle_items -> brand_bundles | N:1 | brand_bundle_items.bundle_id | CASCADE |
| brand_bundle_items -> products | N:1 | brand_bundle_items.product_id | CASCADE |
| generation_credits -> profiles | N:1 | generation_credits.user_id | CASCADE |
| generation_jobs -> brands | N:1 (nullable) | generation_jobs.brand_id | SET NULL |
| generation_jobs -> profiles | N:1 | generation_jobs.user_id | CASCADE |
| subscriptions -> profiles | N:1 | subscriptions.user_id | CASCADE |
| payment_history -> profiles | N:1 | payment_history.user_id | CASCADE |
| payment_history -> subscriptions | N:1 (nullable) | payment_history.subscription_id | SET NULL |
| audit_log -> profiles | N:1 (nullable) | audit_log.user_id | SET NULL |
| admin_flags -> profiles (flagged_by) | N:1 | admin_flags.flagged_by | CASCADE |
| admin_flags -> profiles (resolved_by) | N:1 (nullable) | admin_flags.resolved_by | SET NULL |
| chat_messages -> profiles | N:1 | chat_messages.user_id | CASCADE |
| chat_messages -> brands | N:1 (nullable) | chat_messages.brand_id | SET NULL |
| ghl_sync_log -> profiles | N:1 (nullable) | ghl_sync_log.user_id | SET NULL |

---

## 2. Complete SQL Schema

### 2.0 Extensions and Utility Functions

```sql
-- =============================================================================
-- 00_extensions.sql — Required PostgreSQL extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Crypto functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN indexes on scalar types
```

```sql
-- =============================================================================
-- 01_utility_functions.sql — Shared trigger functions
-- =============================================================================

-- Auto-update updated_at on every row modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create a profile row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 2.1 profiles

```sql
-- =============================================================================
-- 02_profiles.sql
-- =============================================================================

CREATE TABLE public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  phone             TEXT,
  full_name         TEXT        NOT NULL DEFAULT '',
  avatar_url        TEXT        DEFAULT '',
  role              TEXT        NOT NULL DEFAULT 'user'
                                CHECK (role IN ('user', 'admin', 'super_admin')),
  tc_accepted_at    TIMESTAMPTZ,
  stripe_customer_id TEXT       UNIQUE,
  subscription_tier TEXT        NOT NULL DEFAULT 'free'
                                CHECK (subscription_tier IN ('free', 'starter', 'pro', 'agency')),
  org_id            UUID,       -- Future: multi-tenant organization
  onboarding_done   BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata          JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email       ON public.profiles (email);
CREATE INDEX idx_profiles_phone       ON public.profiles (phone)    WHERE phone IS NOT NULL;
CREATE INDEX idx_profiles_role        ON public.profiles (role)     WHERE role != 'user';
CREATE INDEX idx_profiles_stripe      ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_profiles_org         ON public.profiles (org_id)   WHERE org_id IS NOT NULL;
CREATE INDEX idx_profiles_tier        ON public.profiles (subscription_tier);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.profiles IS 'Extends auth.users with application-specific profile data.';
COMMENT ON COLUMN public.profiles.role IS 'user | admin | super_admin';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'free | starter | pro | agency';
COMMENT ON COLUMN public.profiles.org_id IS 'Future: multi-tenant org FK. Not used at launch.';
```

### 2.2 brands

```sql
-- =============================================================================
-- 03_brands.sql
-- =============================================================================

CREATE TABLE public.brands (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'generating', 'review', 'complete', 'archived')),
  name              TEXT,
  tagline           TEXT,
  vision            TEXT,
  description       TEXT,
  color_palette     JSONB       DEFAULT '[]',
  -- Expected shape: [{"hex":"#FF5733","name":"Sunset","role":"primary"}, ...]
  fonts             JSONB       DEFAULT '{}',
  -- Expected shape: {"primary":"Montserrat","secondary":"Open Sans","body":"Inter"}
  logo_style        TEXT        CHECK (logo_style IS NULL OR logo_style IN (
                                  'minimal', 'bold', 'vintage', 'modern', 'playful'
                                )),
  archetype         TEXT,
  brand_values      JSONB       DEFAULT '[]',
  -- Expected shape: ["Innovation","Authenticity","Community"]
  target_audience   TEXT,
  social_data       JSONB       DEFAULT '{}',
  -- Raw social analysis results from the social-analyzer skill
  wizard_step       TEXT        NOT NULL DEFAULT 'onboarding',
  -- URL path segment, not a number.
  -- Valid values: onboarding, social, identity, colors, fonts, logos, products, mockups, bundles, projections, checkout, complete
  resume_token      TEXT,
  -- HMAC-signed token for wizard resume (24hr expiry)
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brands_user_id       ON public.brands (user_id);
CREATE INDEX idx_brands_status        ON public.brands (status);
CREATE INDEX idx_brands_user_status   ON public.brands (user_id, status);
CREATE INDEX idx_brands_wizard_step   ON public.brands (wizard_step)     WHERE status = 'draft';
CREATE INDEX idx_brands_created       ON public.brands (created_at DESC);
CREATE INDEX idx_brands_social_data   ON public.brands USING GIN (social_data jsonb_path_ops);
CREATE INDEX idx_brands_color_palette ON public.brands USING GIN (color_palette jsonb_path_ops);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.brands IS 'Core brand entity. One per wizard session. Stores all identity data.';
COMMENT ON COLUMN public.brands.wizard_step IS 'URL path segment for wizard resume. Not a number.';
COMMENT ON COLUMN public.brands.color_palette IS 'JSONB array of {hex, name, role} objects.';
COMMENT ON COLUMN public.brands.social_data IS 'Raw analysis from social-analyzer skill.';
```

### 2.3 products

```sql
-- =============================================================================
-- 04_products.sql — must be created before brand_assets (FK dependency)
-- =============================================================================

CREATE TABLE public.products (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 TEXT          UNIQUE NOT NULL,
  name                TEXT          NOT NULL,
  category            TEXT          NOT NULL
                                    CHECK (category IN ('apparel', 'accessories', 'home_goods', 'packaging', 'digital')),
  description         TEXT          DEFAULT '',
  base_cost           NUMERIC(10,2) NOT NULL DEFAULT 0.00
                                    CHECK (base_cost >= 0),
  retail_price        NUMERIC(10,2) NOT NULL DEFAULT 0.00
                                    CHECK (retail_price >= 0),
  image_url           TEXT,
  mockup_template_url TEXT,
  mockup_instructions TEXT          NOT NULL DEFAULT '',
  -- Prompt instructions for GPT Image 1.5: where to place logo, constraints, style notes
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  metadata            JSONB         DEFAULT '{}',
  -- Extensible: dimensions, weight, supplier info, etc.
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category       ON public.products (category) WHERE is_active = TRUE;
CREATE INDEX idx_products_active         ON public.products (is_active, sort_order);
CREATE INDEX idx_products_sku_trgm       ON public.products USING GIN (sku gin_trgm_ops);
CREATE INDEX idx_products_name_trgm      ON public.products USING GIN (name gin_trgm_ops);

-- Full-text search index on name + description
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED;
CREATE INDEX idx_products_fts ON public.products USING GIN (fts);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.products IS 'Admin-managed product catalog. Users select from this during the wizard.';
COMMENT ON COLUMN public.products.mockup_instructions IS 'Prompt instructions for AI mockup generation: logo placement, constraints.';
COMMENT ON COLUMN public.products.fts IS 'Generated tsvector column for full-text search.';
```

### 2.4 brand_assets

```sql
-- =============================================================================
-- 05_brand_assets.sql
-- =============================================================================

CREATE TABLE public.brand_assets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  asset_type        TEXT        NOT NULL
                                CHECK (asset_type IN ('logo', 'mockup', 'bundle_image', 'social_asset', 'label', 'brand_guide')),
  product_id        UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  -- Non-null for mockups; links the asset to the product it depicts
  url               TEXT        NOT NULL,
  thumbnail_url     TEXT,
  file_name         TEXT,
  file_size_bytes   INTEGER,
  mime_type         TEXT,
  width             INTEGER,
  height            INTEGER,
  is_selected       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- User's chosen asset (e.g., selected logo out of 4 options)
  is_archived       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Soft-delete: regenerated assets are archived, not deleted
  generation_model  TEXT,
  -- Which AI model generated this (e.g., 'flux-2-pro', 'gpt-image-1.5')
  generation_prompt TEXT,
  -- The prompt used to generate this asset
  generation_params JSONB       DEFAULT '{}',
  -- Full generation parameters (seed, style, guidance_scale, etc.)
  variation_number  SMALLINT    NOT NULL DEFAULT 1,
  metadata          JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brand_assets_brand       ON public.brand_assets (brand_id);
CREATE INDEX idx_brand_assets_type        ON public.brand_assets (brand_id, asset_type);
CREATE INDEX idx_brand_assets_selected    ON public.brand_assets (brand_id, asset_type, is_selected)
             WHERE is_selected = TRUE;
CREATE INDEX idx_brand_assets_product     ON public.brand_assets (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_brand_assets_not_archived ON public.brand_assets (brand_id, asset_type)
             WHERE is_archived = FALSE;
CREATE INDEX idx_brand_assets_metadata    ON public.brand_assets USING GIN (metadata jsonb_path_ops);

COMMENT ON TABLE  public.brand_assets IS 'Unified table for all generated brand files: logos, mockups, bundle images, social assets.';
COMMENT ON COLUMN public.brand_assets.is_archived IS 'Soft delete. Regenerated assets are archived, not removed.';
COMMENT ON COLUMN public.brand_assets.product_id IS 'Non-null for mockups. Links asset to the product it depicts.';
```

### 2.5 brand_products

```sql
-- =============================================================================
-- 06_brand_products.sql
-- =============================================================================

CREATE TABLE public.brand_products (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID          NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  product_id        UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity          INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  custom_retail_price NUMERIC(10,2),
  -- User-adjusted retail price (overrides product default for profit calculations)
  notes             TEXT          DEFAULT '',
  selected_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_brand_product UNIQUE (brand_id, product_id)
);

-- Indexes
CREATE INDEX idx_brand_products_brand   ON public.brand_products (brand_id);
CREATE INDEX idx_brand_products_product ON public.brand_products (product_id);

COMMENT ON TABLE  public.brand_products IS 'Junction: brand <-> product selections made during the wizard.';
COMMENT ON COLUMN public.brand_products.custom_retail_price IS 'User override of the default retail_price for margin calculations.';
```

### 2.6 brand_bundles

```sql
-- =============================================================================
-- 07_brand_bundles.sql
-- =============================================================================

CREATE TABLE public.brand_bundles (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           UUID          NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name               TEXT          NOT NULL,
  description        TEXT          DEFAULT '',
  total_base_cost    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_retail_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  image_url          TEXT,
  -- Generated bundle composition image (Gemini 3 Pro Image)
  sort_order         INTEGER       NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brand_bundles_brand ON public.brand_bundles (brand_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_brand_bundles_updated_at
  BEFORE UPDATE ON public.brand_bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.brand_bundles IS 'Named product bundles created by users from their selected products.';
```

### 2.7 brand_bundle_items

```sql
-- =============================================================================
-- 08_brand_bundle_items.sql
-- =============================================================================

CREATE TABLE public.brand_bundle_items (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id         UUID    NOT NULL REFERENCES public.brand_bundles(id) ON DELETE CASCADE,
  product_id        UUID    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

  CONSTRAINT uq_bundle_product UNIQUE (bundle_id, product_id)
);

-- Indexes
CREATE INDEX idx_bundle_items_bundle  ON public.brand_bundle_items (bundle_id);
CREATE INDEX idx_bundle_items_product ON public.brand_bundle_items (product_id);

COMMENT ON TABLE public.brand_bundle_items IS 'Junction: bundle <-> products. Defines which products are in each bundle.';
```

### 2.8 generation_credits

```sql
-- =============================================================================
-- 09_generation_credits.sql
-- =============================================================================

CREATE TABLE public.generation_credits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type       TEXT        NOT NULL
                                CHECK (credit_type IN ('logo', 'mockup', 'video', 'bundle', 'analysis')),
  credits_remaining INTEGER     NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_used      INTEGER     NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  period_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  last_refill_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_credit_type_period UNIQUE (user_id, credit_type, period_start)
);

-- Indexes
CREATE INDEX idx_gen_credits_user      ON public.generation_credits (user_id);
CREATE INDEX idx_gen_credits_active    ON public.generation_credits (user_id, credit_type)
             WHERE credits_remaining > 0;
CREATE INDEX idx_gen_credits_period    ON public.generation_credits (period_end);

COMMENT ON TABLE  public.generation_credits IS 'Per-user credit tracking. Separate rows per credit type per billing period.';
COMMENT ON COLUMN public.generation_credits.period_end IS 'Credits expire at period end. Unused credits do not roll over.';
```

### 2.9 generation_jobs

```sql
-- =============================================================================
-- 10_generation_jobs.sql
-- =============================================================================

CREATE TABLE public.generation_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_type          TEXT        NOT NULL
                                CHECK (job_type IN ('logo', 'mockup', 'bundle', 'analysis', 'video', 'social_asset', 'label')),
  status            TEXT        NOT NULL DEFAULT 'queued'
                                CHECK (status IN ('queued', 'processing', 'complete', 'failed', 'cancelled')),
  progress          SMALLINT    NOT NULL DEFAULT 0
                                CHECK (progress >= 0 AND progress <= 100),
  result            JSONB       DEFAULT '{}',
  -- Structured result data (asset URLs, metadata, model output)
  error             TEXT,
  error_code        TEXT,
  retry_count       SMALLINT    NOT NULL DEFAULT 0,
  max_retries       SMALLINT    NOT NULL DEFAULT 3,
  bullmq_job_id     TEXT,
  -- BullMQ reference for job control (cancel, retry, inspect)
  model_used        TEXT,
  -- Which AI model actually executed (for cost tracking)
  cost_usd          NUMERIC(8,4) DEFAULT 0.0000,
  -- Actual cost of this generation (from model billing)
  duration_ms       INTEGER,
  -- Wall-clock execution time
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_gen_jobs_brand        ON public.generation_jobs (brand_id)    WHERE brand_id IS NOT NULL;
CREATE INDEX idx_gen_jobs_user         ON public.generation_jobs (user_id);
CREATE INDEX idx_gen_jobs_status       ON public.generation_jobs (status)      WHERE status IN ('queued', 'processing');
CREATE INDEX idx_gen_jobs_user_type    ON public.generation_jobs (user_id, job_type);
CREATE INDEX idx_gen_jobs_bullmq       ON public.generation_jobs (bullmq_job_id) WHERE bullmq_job_id IS NOT NULL;
CREATE INDEX idx_gen_jobs_created      ON public.generation_jobs (created_at DESC);
CREATE INDEX idx_gen_jobs_result       ON public.generation_jobs USING GIN (result jsonb_path_ops);

COMMENT ON TABLE  public.generation_jobs IS 'Tracks all async AI generation jobs. Linked to BullMQ for queue management.';
COMMENT ON COLUMN public.generation_jobs.bullmq_job_id IS 'Reference to the BullMQ job for cancel/retry/inspect operations.';
COMMENT ON COLUMN public.generation_jobs.cost_usd IS 'Actual cost of this generation from model provider billing.';
```

### 2.10 subscriptions

```sql
-- =============================================================================
-- 11_subscriptions.sql
-- =============================================================================

CREATE TABLE public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT        UNIQUE NOT NULL,
  stripe_price_id         TEXT        NOT NULL,
  tier                    TEXT        NOT NULL
                                      CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing', 'paused', 'incomplete')),
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  trial_start             TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  metadata                JSONB       DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user    ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe  ON public.subscriptions (stripe_subscription_id);
CREATE INDEX idx_subscriptions_status  ON public.subscriptions (status) WHERE status = 'active';
CREATE INDEX idx_subscriptions_period  ON public.subscriptions (current_period_end);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records. One active subscription per user.';
```

### 2.11 payment_history

```sql
-- =============================================================================
-- 12_payment_history.sql
-- =============================================================================

CREATE TABLE public.payment_history (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_id   TEXT          UNIQUE NOT NULL,
  stripe_invoice_id   TEXT,
  subscription_id     UUID          REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency            TEXT          NOT NULL DEFAULT 'usd' CHECK (char_length(currency) = 3),
  status              TEXT          NOT NULL
                                    CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded', 'disputed')),
  description         TEXT          DEFAULT '',
  payment_method_type TEXT,
  -- e.g. 'card', 'bank_transfer'
  receipt_url         TEXT,
  metadata            JSONB         DEFAULT '{}',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_history_user   ON public.payment_history (user_id);
CREATE INDEX idx_payment_history_stripe ON public.payment_history (stripe_payment_id);
CREATE INDEX idx_payment_history_sub    ON public.payment_history (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_payment_history_status ON public.payment_history (status);
CREATE INDEX idx_payment_history_date   ON public.payment_history (created_at DESC);

COMMENT ON TABLE public.payment_history IS 'Stripe payment and invoice records for billing history display.';
```

### 2.12 audit_log

```sql
-- =============================================================================
-- 13_audit_log.sql
-- =============================================================================

CREATE TABLE public.audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- NULL for system-initiated events
  action            TEXT        NOT NULL,
  -- Structured action name: 'brand.created', 'logo.generated', 'user.login', 'admin.flag_content'
  resource_type     TEXT,
  -- Table name: 'brand', 'brand_asset', 'product', 'subscription', etc.
  resource_id       UUID,
  -- PK of the affected row
  old_data          JSONB,
  -- Previous state (for updates)
  new_data          JSONB,
  -- New state (for creates/updates)
  metadata          JSONB       DEFAULT '{}',
  -- Extra context: ip, user_agent, cost_usd, model_used, duration_ms, etc.
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user        ON public.audit_log (user_id)       WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action      ON public.audit_log (action);
CREATE INDEX idx_audit_log_resource    ON public.audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_created     ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_metadata    ON public.audit_log USING GIN (metadata jsonb_path_ops);

-- Future: Partition by month for performance when table exceeds 1M rows
-- CREATE TABLE public.audit_log (...) PARTITION BY RANGE (created_at);

COMMENT ON TABLE  public.audit_log IS 'Immutable append-only log of all system events. 1-year retention policy.';
COMMENT ON COLUMN public.audit_log.action IS 'Structured action: resource.verb (e.g. brand.created, logo.generated, user.login).';
COMMENT ON COLUMN public.audit_log.old_data IS 'Previous row state for UPDATE operations. NULL for INSERT/DELETE.';
```

### 2.13 admin_flags

```sql
-- =============================================================================
-- 14_admin_flags.sql
-- =============================================================================

CREATE TABLE public.admin_flags (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Admin user who flagged the content
  resource_type     TEXT        NOT NULL
                                CHECK (resource_type IN ('brand_asset', 'brand', 'chat_message')),
  resource_id       UUID        NOT NULL,
  reason            TEXT        NOT NULL
                                CHECK (reason IN ('nsfw', 'copyright', 'quality', 'spam', 'other')),
  severity          TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes             TEXT        DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  resolved_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_flags_status    ON public.admin_flags (status) WHERE status IN ('open', 'reviewed');
CREATE INDEX idx_admin_flags_resource  ON public.admin_flags (resource_type, resource_id);
CREATE INDEX idx_admin_flags_flagged   ON public.admin_flags (flagged_by);
CREATE INDEX idx_admin_flags_severity  ON public.admin_flags (severity, status);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_admin_flags_updated_at
  BEFORE UPDATE ON public.admin_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.admin_flags IS 'Content moderation flags on AI-generated assets. Admins review flagged content.';
```

### 2.14 chat_messages

```sql
-- =============================================================================
-- 15_chat_messages.sql
-- =============================================================================

CREATE TABLE public.chat_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id          UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  -- Optional: context-aware chat scoped to a brand
  session_id        TEXT        NOT NULL,
  -- Groups messages into a conversation session
  role              TEXT        NOT NULL
                                CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT        NOT NULL,
  model_used        TEXT,
  -- e.g. 'claude-haiku-4-5', 'gemini-3.0-flash'
  tokens_used       INTEGER     DEFAULT 0,
  cost_usd          NUMERIC(8,6) DEFAULT 0.000000,
  metadata          JSONB       DEFAULT '{}',
  -- Extra data: tool calls, citations, suggested actions
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_user     ON public.chat_messages (user_id);
CREATE INDEX idx_chat_messages_session  ON public.chat_messages (session_id, created_at);
CREATE INDEX idx_chat_messages_brand    ON public.chat_messages (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_chat_messages_created  ON public.chat_messages (created_at DESC);

COMMENT ON TABLE  public.chat_messages IS 'AI chatbot conversation history. One session = one conversation thread.';
COMMENT ON COLUMN public.chat_messages.session_id IS 'Groups messages into a conversation. New session per chat window open.';
```

### 2.15 ghl_sync_log

```sql
-- =============================================================================
-- 16_ghl_sync_log.sql
-- =============================================================================

CREATE TABLE public.ghl_sync_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ghl_contact_id    TEXT,
  -- GoHighLevel contact ID
  direction         TEXT        NOT NULL
                                CHECK (direction IN ('outbound', 'inbound')),
  -- outbound = BMN -> GHL, inbound = GHL -> BMN (webhook)
  event_type        TEXT        NOT NULL,
  -- e.g. 'contact.created', 'contact.updated', 'brand.completed', 'tag.added'
  payload           JSONB       NOT NULL DEFAULT '{}',
  -- Full request/response payload for debugging
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  error             TEXT,
  error_code        TEXT,
  retry_count       SMALLINT    NOT NULL DEFAULT 0,
  next_retry_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ghl_sync_user         ON public.ghl_sync_log (user_id)    WHERE user_id IS NOT NULL;
CREATE INDEX idx_ghl_sync_contact      ON public.ghl_sync_log (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;
CREATE INDEX idx_ghl_sync_status       ON public.ghl_sync_log (status)     WHERE status IN ('pending', 'failed', 'retrying');
CREATE INDEX idx_ghl_sync_event        ON public.ghl_sync_log (event_type);
CREATE INDEX idx_ghl_sync_created      ON public.ghl_sync_log (created_at DESC);
CREATE INDEX idx_ghl_sync_retry        ON public.ghl_sync_log (next_retry_at)
             WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE  public.ghl_sync_log IS 'GoHighLevel CRM sync event log. Tracks every sync attempt with full payload.';
COMMENT ON COLUMN public.ghl_sync_log.direction IS 'outbound = BMN to GHL, inbound = GHL webhook to BMN.';
COMMENT ON COLUMN public.ghl_sync_log.payload IS 'Full request/response for debugging failed syncs.';
```

---

## 3. Row Level Security (RLS) Policies

**Philosophy:** Every table has RLS enabled. Users see only their own data. Admins see everything. The `service_role` key bypasses RLS entirely (used by server-side operations via BullMQ workers and webhook handlers).

```sql
-- =============================================================================
-- 20_rls_policies.sql — Row Level Security for ALL tables
-- =============================================================================

-- ── Helper Functions ──────────────────────────────────────────────────────

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's ID (convenience wrapper)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_super_admin"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );


-- ─────────────────────────────────────────────
-- brands
-- ─────────────────────────────────────────────
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_own"
  ON public.brands FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "brands_insert_own"
  ON public.brands FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_update_own"
  ON public.brands FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_delete_own"
  ON public.brands FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());


-- ─────────────────────────────────────────────
-- brand_assets
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_assets_select_own"
  ON public.brand_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_assets_insert_own"
  ON public.brand_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_update_own"
  ON public.brand_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_delete_own"
  ON public.brand_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );


-- ─────────────────────────────────────────────
-- brand_products
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_products_select_own"
  ON public.brand_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_products_insert_own"
  ON public.brand_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_products_update_own"
  ON public.brand_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_products_delete_own"
  ON public.brand_products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- brand_bundles
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_bundles_select_own"
  ON public.brand_bundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_bundles_insert_own"
  ON public.brand_bundles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundles_update_own"
  ON public.brand_bundles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundles_delete_own"
  ON public.brand_bundles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- brand_bundle_items
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_bundle_items_select_own"
  ON public.brand_bundle_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_bundle_items_insert_own"
  ON public.brand_bundle_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundle_items_update_own"
  ON public.brand_bundle_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundle_items_delete_own"
  ON public.brand_bundle_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- products (public read for authenticated users, admin write)
-- ─────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_active"
  ON public.products FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- generation_credits
-- ─────────────────────────────────────────────
ALTER TABLE public.generation_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_credits_select_own"
  ON public.generation_credits FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Credits are created/updated by server (service_role bypasses RLS).
-- Admin can manually add credits via dashboard.
CREATE POLICY "gen_credits_insert_admin"
  ON public.generation_credits FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "gen_credits_update_admin"
  ON public.generation_credits FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "gen_credits_delete_admin"
  ON public.generation_credits FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- generation_jobs
-- ─────────────────────────────────────────────
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_jobs_select_own"
  ON public.generation_jobs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "gen_jobs_insert_own"
  ON public.generation_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "gen_jobs_update_own"
  ON public.generation_jobs FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

-- Users cannot delete jobs (immutable history)
CREATE POLICY "gen_jobs_delete_admin"
  ON public.generation_jobs FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- subscriptions
-- ─────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Subscriptions are managed exclusively by Stripe webhooks (service_role).
CREATE POLICY "subscriptions_insert_admin"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "subscriptions_update_admin"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "subscriptions_delete_admin"
  ON public.subscriptions FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- payment_history
-- ─────────────────────────────────────────────
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_history_select_own"
  ON public.payment_history FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Payments created by Stripe webhooks (service_role).
CREATE POLICY "payment_history_insert_admin"
  ON public.payment_history FOR INSERT
  WITH CHECK (public.is_admin());

-- Payment records are immutable.
CREATE POLICY "payment_history_update_admin"
  ON public.payment_history FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "payment_history_delete_admin"
  ON public.payment_history FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- audit_log (append-only, read by owner + admin)
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_own"
  ON public.audit_log FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Entries created by server (service_role).
CREATE POLICY "audit_log_insert_admin"
  ON public.audit_log FOR INSERT
  WITH CHECK (public.is_admin());

-- IMMUTABLE: No update policy = no updates permitted via RLS.
-- IMMUTABLE: No delete policy = no deletes permitted via RLS.


-- ─────────────────────────────────────────────
-- admin_flags (admin-only table)
-- ─────────────────────────────────────────────
ALTER TABLE public.admin_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_flags_select_admin"
  ON public.admin_flags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admin_flags_insert_admin"
  ON public.admin_flags FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_flags_update_admin"
  ON public.admin_flags FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "admin_flags_delete_admin"
  ON public.admin_flags FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- chat_messages
-- ─────────────────────────────────────────────
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own"
  ON public.chat_messages FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "chat_messages_insert_own"
  ON public.chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Chat messages are immutable (no update policy).
-- Users cannot delete chat history; admin can for moderation.
CREATE POLICY "chat_messages_delete_admin"
  ON public.chat_messages FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- ghl_sync_log (admin + service only)
-- ─────────────────────────────────────────────
ALTER TABLE public.ghl_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ghl_sync_select_admin"
  ON public.ghl_sync_log FOR SELECT
  USING (public.is_admin());

-- Sync logs created by server (service_role).
CREATE POLICY "ghl_sync_insert_admin"
  ON public.ghl_sync_log FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "ghl_sync_update_admin"
  ON public.ghl_sync_log FOR UPDATE
  USING (public.is_admin());

-- Sync logs are append-only. No deletes.
```

---

## 4. Database Functions & Triggers

### 4.1 Updated At Trigger

Already defined in Section 2.0 (`handle_updated_at`). Applied to: `profiles`, `brands`, `products`, `subscriptions`, `brand_bundles`, `admin_flags`.

### 4.2 Wizard Step Validation

```sql
-- =============================================================================
-- 30_functions.sql — Business logic functions
-- =============================================================================

-- Validate wizard step transitions.
-- Prevents skipping steps. Allows same-step re-saves and forward-by-one movement.
-- Allows reset to 'onboarding' from any step.
CREATE OR REPLACE FUNCTION public.validate_wizard_step()
RETURNS TRIGGER AS $$
DECLARE
  step_order TEXT[] := ARRAY[
    'onboarding', 'social', 'identity', 'colors', 'fonts',
    'logos', 'products', 'mockups', 'bundles', 'projections',
    'checkout', 'complete'
  ];
  old_idx INT;
  new_idx INT;
BEGIN
  -- Allow reset to onboarding from any step
  IF NEW.wizard_step = 'onboarding' THEN
    RETURN NEW;
  END IF;

  -- Find position indexes
  old_idx := array_position(step_order, OLD.wizard_step);
  new_idx := array_position(step_order, NEW.wizard_step);

  -- Reject unknown step names
  IF new_idx IS NULL THEN
    RAISE EXCEPTION 'Invalid wizard step: "%". Valid steps: %', NEW.wizard_step, step_order;
  END IF;

  -- Allow forward movement by at most 1 step, or same step (re-save)
  IF old_idx IS NOT NULL AND new_idx > old_idx + 1 THEN
    RAISE EXCEPTION 'Cannot skip wizard steps. Current: %, Requested: %. Must advance one step at a time.', OLD.wizard_step, NEW.wizard_step;
  END IF;

  -- If moving to 'complete', auto-set completed_at and status
  IF NEW.wizard_step = 'complete' AND OLD.wizard_step != 'complete' THEN
    NEW.completed_at = NOW();
    NEW.status = 'complete';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER validate_brand_wizard_step
  BEFORE UPDATE OF wizard_step ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wizard_step();
```

### 4.3 Credit Deduction Function (Atomic)

```sql
-- Atomically deduct credits. Returns TRUE if deduction succeeded, FALSE if insufficient.
-- Uses SELECT ... FOR UPDATE to prevent race conditions between concurrent requests.
CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_credit_id UUID;
  v_remaining INTEGER;
BEGIN
  -- Lock the active credit row for this user + type within the current period
  SELECT id, credits_remaining
  INTO v_credit_id, v_remaining
  FROM public.generation_credits
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
    AND credits_remaining >= p_amount
    AND period_end > NOW()
  ORDER BY period_end ASC
  LIMIT 1
  FOR UPDATE;

  -- No eligible credit row found
  IF v_credit_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Deduct
  UPDATE public.generation_credits
  SET
    credits_remaining = credits_remaining - p_amount,
    credits_used = credits_used + p_amount
  WHERE id = v_credit_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.deduct_credit IS 'Atomically deduct generation credits. Returns FALSE if insufficient credits. Uses row locking to prevent race conditions.';
```

### 4.4 Refill Credits Function

```sql
-- Refill credits for a user based on their subscription tier.
-- Called by the Stripe webhook handler when a subscription period renews.
CREATE OR REPLACE FUNCTION public.refill_credits(
  p_user_id UUID,
  p_tier TEXT
)
RETURNS VOID AS $$
DECLARE
  v_logo_credits INTEGER;
  v_mockup_credits INTEGER;
  v_period_start TIMESTAMPTZ := NOW();
  v_period_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  -- Determine credit amounts by tier
  CASE p_tier
    WHEN 'free' THEN
      v_logo_credits := 4;
      v_mockup_credits := 4;
    WHEN 'starter' THEN
      v_logo_credits := 20;
      v_mockup_credits := 30;
    WHEN 'pro' THEN
      v_logo_credits := 50;
      v_mockup_credits := 100;
    WHEN 'agency' THEN
      v_logo_credits := 200;
      v_mockup_credits := 500;
    ELSE
      RAISE EXCEPTION 'Unknown subscription tier: "%". Valid tiers: free, starter, pro, agency.', p_tier;
  END CASE;

  -- Upsert logo credits for the new period
  INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (p_user_id, 'logo', v_logo_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT (user_id, credit_type, period_start)
  DO UPDATE SET
    credits_remaining = v_logo_credits,
    credits_used = 0,
    last_refill_at = NOW();

  -- Upsert mockup credits for the new period
  INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (p_user_id, 'mockup', v_mockup_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT (user_id, credit_type, period_start)
  DO UPDATE SET
    credits_remaining = v_mockup_credits,
    credits_used = 0,
    last_refill_at = NOW();

  -- Update profile tier to match
  UPDATE public.profiles SET subscription_tier = p_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refill_credits IS 'Refill generation credits based on subscription tier. Called on subscription renewal via Stripe webhook.';
```

### 4.5 Brand Completion Function

```sql
-- Mark a brand as complete and perform post-completion bookkeeping.
-- Called when the user finishes the wizard checkout step.
-- Returns a JSON summary of the completed brand.
CREATE OR REPLACE FUNCTION public.complete_brand(
  p_brand_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_brand RECORD;
  v_asset_count INTEGER;
  v_product_count INTEGER;
  v_bundle_count INTEGER;
  v_result JSONB;
BEGIN
  -- Verify ownership and lock row
  SELECT * INTO v_brand
  FROM public.brands
  WHERE id = p_brand_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_brand IS NULL THEN
    RAISE EXCEPTION 'Brand not found or not owned by user.';
  END IF;

  IF v_brand.status = 'complete' THEN
    RAISE EXCEPTION 'Brand is already complete.';
  END IF;

  -- Count assets
  SELECT COUNT(*) INTO v_asset_count
  FROM public.brand_assets
  WHERE brand_id = p_brand_id AND is_archived = FALSE;

  -- Count selected products
  SELECT COUNT(*) INTO v_product_count
  FROM public.brand_products
  WHERE brand_id = p_brand_id;

  -- Count bundles
  SELECT COUNT(*) INTO v_bundle_count
  FROM public.brand_bundles
  WHERE brand_id = p_brand_id;

  -- Update brand status
  UPDATE public.brands SET
    status = 'complete',
    wizard_step = 'complete',
    completed_at = NOW()
  WHERE id = p_brand_id;

  -- Create audit log entry
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_user_id,
    'brand.completed',
    'brand',
    p_brand_id,
    jsonb_build_object(
      'asset_count', v_asset_count,
      'product_count', v_product_count,
      'bundle_count', v_bundle_count,
      'brand_name', v_brand.name
    )
  );

  -- Build and return result summary
  v_result := jsonb_build_object(
    'brand_id', p_brand_id,
    'brand_name', v_brand.name,
    'status', 'complete',
    'assets', v_asset_count,
    'products', v_product_count,
    'bundles', v_bundle_count,
    'completed_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_brand IS 'Finalize a brand. Sets status to complete, writes audit log, returns summary JSON.';
```

### 4.6 Get User Credit Summary

```sql
-- Returns a summary of all active credits for a user.
-- Used by the frontend credit display and the server-side credit check.
CREATE OR REPLACE FUNCTION public.get_credit_summary(p_user_id UUID)
RETURNS TABLE (
  credit_type TEXT,
  remaining INTEGER,
  used INTEGER,
  total INTEGER,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.credit_type,
    gc.credits_remaining AS remaining,
    gc.credits_used AS used,
    (gc.credits_remaining + gc.credits_used) AS total,
    gc.period_end
  FROM public.generation_credits gc
  WHERE gc.user_id = p_user_id
    AND gc.period_end > NOW()
  ORDER BY gc.credit_type, gc.period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_credit_summary IS 'Returns active credit balances for a user across all credit types.';
```

---

## 5. Seed Data

### 5.1 Product Catalog (24 products across 5 categories)

```sql
-- =============================================================================
-- 40_seed_products.sql — Product catalog seed data
-- =============================================================================

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order) VALUES

-- ── Apparel (5 products) ──────────────────────────────────────────────────
('APR-TSHIRT-001', 'Classic T-Shirt', 'apparel',
 'Unisex crew neck cotton t-shirt. Available in 20+ colors.',
 8.50, 29.99, '/products/tshirt.jpg', '/templates/tshirt.png',
 'Place the brand logo centered on the chest area of the t-shirt. Logo should be approximately 8 inches wide. Maintain the t-shirt''s fabric texture and natural folds. The logo should appear screen-printed, not digitally overlaid. Keep lighting consistent with the garment.',
 10),

('APR-HOODIE-001', 'Pullover Hoodie', 'apparel',
 'Heavyweight pullover hoodie with kangaroo pocket. Unisex fit.',
 18.00, 54.99, '/products/hoodie.jpg', '/templates/hoodie.png',
 'Place the brand logo centered on the chest of the hoodie, above the kangaroo pocket. Logo should be approximately 10 inches wide. Respect the hoodie''s fabric texture, drawstrings, and hood shadow. Screen-print aesthetic.',
 20),

('APR-TANK-001', 'Tank Top', 'apparel',
 'Lightweight racerback tank top. Ideal for athletic or casual branding.',
 6.00, 24.99, '/products/tank.jpg', '/templates/tank.png',
 'Place the brand logo centered on the chest of the tank top. Logo should be approximately 6 inches wide. Maintain the tank''s lightweight fabric texture. Logo should appear as a heat-transfer print.',
 30),

('APR-SWEAT-001', 'Crewneck Sweatshirt', 'apparel',
 'Midweight fleece crewneck sweatshirt. Unisex.',
 14.00, 44.99, '/products/sweatshirt.jpg', '/templates/sweatshirt.png',
 'Place the brand logo centered on the chest of the sweatshirt. Logo should be approximately 9 inches wide. Embroidered look preferred. Maintain fleece texture and natural garment folds.',
 40),

('APR-HAT-001', 'Snapback Hat', 'apparel',
 'Structured 6-panel snapback cap with flat brim.',
 5.50, 27.99, '/products/hat.jpg', '/templates/hat.png',
 'Place the brand logo centered on the front panel of the hat. Logo should be approximately 3.5 inches wide. Embroidered look. Maintain the hat''s structure, stitching, and brim curvature.',
 50),

-- ── Accessories (5 products) ──────────────────────────────────────────────
('ACC-PHONE-001', 'Phone Case', 'accessories',
 'Slim protective phone case. Compatible with iPhone and Samsung.',
 3.50, 19.99, '/products/phone-case.jpg', '/templates/phone-case.png',
 'Place the brand logo centered on the back of the phone case. Logo should cover approximately 60% of the case surface. The case should have a glossy finish. Show the phone case at a slight angle to show depth.',
 60),

('ACC-TOTE-001', 'Canvas Tote Bag', 'accessories',
 'Heavy-duty canvas tote bag with reinforced handles.',
 4.00, 22.99, '/products/tote.jpg', '/templates/tote.png',
 'Place the brand logo centered on one side of the tote bag. Logo should be approximately 8 inches wide. Screen-printed look on natural canvas. Show the bag slightly open with handles visible.',
 70),

('ACC-BOTTLE-001', 'Water Bottle', 'accessories',
 'Insulated stainless steel water bottle. 20oz capacity.',
 6.00, 24.99, '/products/bottle.jpg', '/templates/bottle.png',
 'Place the brand logo as a wrap-around design on the water bottle. Logo should be visible on the front-facing surface. Maintain the metallic/matte finish of the bottle. Show condensation for realism.',
 80),

('ACC-STICKER-001', 'Sticker Pack', 'accessories',
 'Set of 5 die-cut vinyl stickers in various sizes.',
 1.00, 9.99, '/products/stickers.jpg', '/templates/stickers.png',
 'Create a set of 5 die-cut stickers featuring the brand logo and brand colors. Vary the sizes (2-4 inches). Show them arranged on a flat surface as if freshly peeled. Include the logo as-is plus stylistic variations.',
 90),

('ACC-MUG-001', 'Ceramic Mug', 'accessories',
 '11oz white ceramic mug. Dishwasher and microwave safe.',
 3.50, 16.99, '/products/mug.jpg', '/templates/mug.png',
 'Place the brand logo on the front-facing side of the white ceramic mug. Logo should be approximately 3 inches wide. Show the mug with a slight angle, handle visible. The logo should appear as a sublimation print.',
 100),

-- ── Home Goods (4 products) ──────────────────────────────────────────────
('HOM-PILLOW-001', 'Throw Pillow', 'home_goods',
 '18x18 inch throw pillow with removable cover.',
 7.00, 29.99, '/products/pillow.jpg', '/templates/pillow.png',
 'Place the brand logo as the centerpiece design on the throw pillow. Use brand colors for the background. The logo should be approximately 10 inches wide. Show the pillow on a couch or styled setting. Fabric texture visible.',
 110),

('HOM-CANVAS-001', 'Canvas Print', 'home_goods',
 '16x20 inch gallery-wrapped canvas print.',
 9.00, 39.99, '/products/canvas.jpg', '/templates/canvas.png',
 'Create a canvas print featuring the brand logo as wall art. Use brand colors for a stylized background. Show the canvas hanging on a light-colored wall. Gallery wrap visible at edges. Slight shadow for depth.',
 120),

('HOM-BLANKET-001', 'Fleece Blanket', 'home_goods',
 '50x60 inch fleece throw blanket.',
 12.00, 44.99, '/products/blanket.jpg', '/templates/blanket.png',
 'Place the brand logo as a large centered design on the fleece blanket. Use brand colors. Logo should be approximately 20 inches wide. Show the blanket draped over furniture. Soft fleece texture visible.',
 130),

('HOM-POSTER-001', 'Poster Print', 'home_goods',
 '18x24 inch matte poster print.',
 4.00, 19.99, '/products/poster.jpg', '/templates/poster.png',
 'Create a poster design featuring the brand logo prominently. Include brand name, tagline, and color palette. Modern minimal design. Show the poster in a frame or hanging on a wall.',
 140),

-- ── Packaging (5 products) ────────────────────────────────────────────────
('PKG-BOX-001', 'Shipping Box', 'packaging',
 'Branded corrugated shipping box. 12x10x6 inches.',
 2.50, 8.99, '/products/box.jpg', '/templates/box.png',
 'Apply the brand logo and brand colors to a corrugated shipping box. Logo on top flap and one side. Include brand name. Show the box closed at a 3/4 angle. Professional product packaging aesthetic.',
 150),

('PKG-LABEL-001', 'Product Label', 'packaging',
 'Self-adhesive product label. 3x5 inches.',
 0.50, 2.99, '/products/label.jpg', '/templates/label.png',
 'Design a product label featuring the brand logo, brand name, and brand colors. 3x5 inch label. Include placeholder text for product details. Show the label applied to a generic product container.',
 160),

('PKG-BAG-001', 'Shopping Bag', 'packaging',
 'Branded paper shopping bag with rope handles.',
 1.50, 5.99, '/products/bag.jpg', '/templates/bag.png',
 'Apply the brand logo centered on the front of a paper shopping bag. Include brand name below the logo. Use brand colors for accents. Show the bag standing upright with rope handles visible. Luxury retail aesthetic.',
 170),

('PKG-TISSUE-001', 'Tissue Paper', 'packaging',
 'Custom printed tissue paper for gift wrapping.',
 0.75, 3.99, '/products/tissue.jpg', '/templates/tissue.png',
 'Create a repeating pattern of the brand logo on tissue paper. Logo should be small (1 inch) and repeated in a diagonal grid. Use one brand color on white paper. Show the tissue paper partially crumpled in a gift bag.',
 180),

('PKG-MAILER-001', 'Poly Mailer', 'packaging',
 'Branded poly mailer bag. 10x13 inches.',
 1.00, 4.99, '/products/mailer.jpg', '/templates/mailer.png',
 'Apply the brand logo and brand colors to a poly mailer bag. Logo centered on the front. Include brand name and website URL below. Show the mailer flat with a slight curl at edges.',
 190),

-- ── Digital (5 products) ──────────────────────────────────────────────────
('DIG-SOCIAL-001', 'Social Media Template Pack', 'digital',
 'Set of 10 branded social media post templates (Instagram, TikTok, Facebook).',
 0.00, 14.99, '/products/social-templates.jpg', '/templates/social-pack.png',
 'Create a social media post template using the brand logo, brand colors, and fonts. Instagram square format (1080x1080). Include areas for headline text and product image. Modern, clean design. Show 3-4 template variations.',
 200),

('DIG-BIZCARD-001', 'Business Card', 'digital',
 'Double-sided business card design. Standard 3.5x2 inches.',
 0.00, 9.99, '/products/business-card.jpg', '/templates/bizcard.png',
 'Design a double-sided business card using the brand logo, colors, and fonts. Front: logo centered. Back: placeholder for name, title, phone, email, website. Modern minimal design. Show front and back at slight angle.',
 210),

('DIG-EMAIL-001', 'Email Header', 'digital',
 'Branded email header/banner template. 600px wide.',
 0.00, 7.99, '/products/email-header.jpg', '/templates/email-header.png',
 'Create an email header banner (600x200px) featuring the brand logo and brand colors. Logo on the left, brand name on the right. Clean, professional design suitable for marketing emails.',
 220),

('DIG-WATERMARK-001', 'Photo Watermark', 'digital',
 'Transparent PNG watermark overlay for photos.',
 0.00, 4.99, '/products/watermark.jpg', '/templates/watermark.png',
 'Create a semi-transparent watermark version of the brand logo. White with 30% opacity. Show it overlaid on a sample photo. The watermark should be subtle but visible.',
 230),

('DIG-FAVICON-001', 'Favicon & App Icon', 'digital',
 'Favicon (16x16, 32x32) and app icon (512x512) from brand logo.',
 0.00, 4.99, '/products/favicon.jpg', '/templates/favicon.png',
 'Create a simplified favicon version of the brand logo. Must be recognizable at 16x16px. Show at multiple sizes: 16x16, 32x32, 180x180 (Apple touch), and 512x512 (Android). Clean, iconic design.',
 240);
```

### 5.2 Subscription Tier Reference

```sql
-- =============================================================================
-- 41_seed_subscriptions.sql — Subscription tier definitions (reference data)
-- =============================================================================

-- Subscription tiers are NOT stored as a database table.
-- They are defined as application config and referenced by:
--   1. The refill_credits() function (Section 4.4)
--   2. The Stripe product/price setup
--   3. The CHECK constraint on profiles.subscription_tier
--
-- This file documents the tier definitions for reference.

-- ┌──────────┬──────────┬────────┬──────────────┬────────────────┬──────────────────────────┐
-- │ Tier     │ Price/mo │ Brands │ Logo Credits │ Mockup Credits │ Stripe Price ID          │
-- ├──────────┼──────────┼────────┼──────────────┼────────────────┼──────────────────────────┤
-- │ free     │ $0       │ 1      │ 4            │ 4              │ (no Stripe price)        │
-- │ starter  │ $29      │ 3      │ 20           │ 30             │ price_REPLACE_starter    │
-- │ pro      │ $79      │ 10     │ 50           │ 100            │ price_REPLACE_pro        │
-- │ agency   │ $199     │ Unlim  │ 200          │ 500            │ price_REPLACE_agency     │
-- └──────────┴──────────┴────────┴──────────────┴────────────────┴──────────────────────────┘
--
-- IMPORTANT: Replace price_REPLACE_* with actual Stripe price IDs after creating
-- products in the Stripe Dashboard.
--
-- Credits refresh monthly. Unused credits do NOT roll over. Overage at per-unit rates.
--
-- After user signup, call:
--   SELECT public.refill_credits('<user-uuid>', 'free');
-- to provision the initial free-tier credits.
```

### 5.3 Admin User

```sql
-- =============================================================================
-- 42_seed_admin.sql — Initial admin user setup
-- =============================================================================

-- IMPORTANT: The admin user must first be created through Supabase Auth.
-- The handle_new_user trigger will auto-create the profiles row.
--
-- Step 1: Create user via Supabase CLI:
--   supabase auth admin create-user --email admin@brandmenow.com --password <secure-password>
--
-- Step 2: Run this SQL to promote to super_admin:

UPDATE public.profiles
SET
  role = 'super_admin',
  full_name = 'BMN Admin',
  subscription_tier = 'agency',
  onboarding_done = TRUE
WHERE email = 'admin@brandmenow.com';

-- Step 3: Seed admin credits (effectively unlimited)
INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end)
SELECT
  p.id,
  ct.credit_type,
  99999,
  NOW(),
  NOW() + INTERVAL '10 years'
FROM public.profiles p
CROSS JOIN (VALUES ('logo'), ('mockup'), ('video'), ('bundle'), ('analysis')) AS ct(credit_type)
WHERE p.email = 'admin@brandmenow.com';
```

---

## 6. Migration Strategy

### 6.1 File Naming Convention

```
supabase/migrations/
├── 20260219000000_extensions.sql
├── 20260219000001_utility_functions.sql
├── 20260219000002_profiles.sql
├── 20260219000003_brands.sql
├── 20260219000004_products.sql
├── 20260219000005_brand_assets.sql
├── 20260219000006_brand_products.sql
├── 20260219000007_brand_bundles.sql
├── 20260219000008_brand_bundle_items.sql
├── 20260219000009_generation_credits.sql
├── 20260219000010_generation_jobs.sql
├── 20260219000011_subscriptions.sql
├── 20260219000012_payment_history.sql
├── 20260219000013_audit_log.sql
├── 20260219000014_admin_flags.sql
├── 20260219000015_chat_messages.sql
├── 20260219000016_ghl_sync_log.sql
├── 20260219000020_rls_policies.sql
├── 20260219000030_functions.sql
├── 20260219000040_seed_products.sql
├── 20260219000041_seed_subscriptions.sql
├── 20260219000042_seed_admin.sql
├── 20260219000050_storage_buckets.sql
```

**Convention:** `YYYYMMDDHHMMSS_description.sql`
- Timestamps in UTC
- Zero-padded for deterministic ordering
- Each file is self-contained and runs in isolation

### 6.2 Migration Groups

| Group | Files | Description |
|-------|-------|-------------|
| **Foundation** | 000000-000001 | PostgreSQL extensions, utility functions, auth trigger |
| **Core Tables** | 000002-000008 | profiles, brands, products, brand_assets, junctions, bundles |
| **Billing** | 000009-000012 | generation_credits, generation_jobs, subscriptions, payment_history |
| **Operations** | 000013-000016 | audit_log, admin_flags, chat_messages, ghl_sync_log |
| **Security** | 000020 | All RLS policies in a single atomic file |
| **Functions** | 000030 | Business logic (wizard validation, credit deduction, brand completion) |
| **Seed Data** | 000040-000042 | Product catalog, subscription reference, admin user |
| **Storage** | 000050 | Supabase Storage bucket creation and policies |

### 6.3 Running Migrations

```bash
# ── Prerequisites ──────────────────────────────
npm install -g supabase            # Install Supabase CLI
supabase link --project-ref <ref>  # Link to your Supabase project

# ── Local Development ──────────────────────────
supabase start                     # Start local Supabase (Docker required)
supabase db reset                  # Drop + recreate DB from all migrations + seed
supabase migration up              # Apply pending migrations only (non-destructive)

# ── Creating New Migrations ────────────────────
supabase migration new add_user_preferences
# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_user_preferences.sql

# ── Production ─────────────────────────────────
supabase db push                   # Push pending migrations to production
supabase migration list            # Check migration status

# ── Rollback (Manual) ─────────────────────────
# Supabase CLI does NOT support automatic rollback.
# Create a new "down" migration with reverse SQL:
supabase migration new rollback_add_user_preferences
# Then write the reverse DDL manually.
```

---

## 7. Supabase Storage Buckets

### 7.1 brand-assets

```sql
-- =============================================================================
-- 50_storage_buckets.sql — Storage bucket creation and policies
-- =============================================================================

-- ── brand-assets bucket ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  TRUE,                    -- Public read (CDN served for sharing/embedding)
  10485760,                -- 10MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/zip']
);

-- Path convention: {user_id}/{brand_id}/{asset_type}/{filename}
-- Example: 550e8400.../a1b2c3d4.../logos/logo-v1-001.png
-- Example: 550e8400.../a1b2c3d4.../mockups/tshirt-mockup-001.png
-- Example: 550e8400.../a1b2c3d4.../bundles/starter-bundle.png

-- Public read: anyone can view brand assets (for sharing, embedding)
CREATE POLICY "brand_assets_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

-- Authenticated users can upload to their own folder
CREATE POLICY "brand_assets_storage_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Users can update their own files
CREATE POLICY "brand_assets_storage_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "brand_assets_storage_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );
```

### 7.2 product-images

```sql
-- ── product-images bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,                    -- Public read (catalog images)
  5242880,                 -- 5MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);

-- Path convention: {category}/{sku}.{ext}
-- Example: apparel/APR-TSHIRT-001.jpg
-- Example: accessories/ACC-MUG-001.png

-- Public read
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Admin-only upload/modify
CREATE POLICY "product_images_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
```

---

## 8. Performance Considerations

### 8.1 Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `profiles` | `idx_profiles_email` | B-tree | Email lookup at login |
| `profiles` | `idx_profiles_stripe` | B-tree (partial, non-null only) | Stripe customer lookup |
| `profiles` | `idx_profiles_role` | B-tree (partial, non-user only) | Admin user queries |
| `brands` | `idx_brands_user_status` | B-tree (composite) | Dashboard brand listing (most common query) |
| `brands` | `idx_brands_social_data` | GIN (jsonb_path_ops) | JSONB containment queries on social analysis |
| `brands` | `idx_brands_color_palette` | GIN (jsonb_path_ops) | Color search across brands |
| `brand_assets` | `idx_brand_assets_selected` | B-tree (partial, selected only) | Fetch chosen assets per brand |
| `brand_assets` | `idx_brand_assets_not_archived` | B-tree (partial, not archived) | Skip archived assets |
| `brand_assets` | `idx_brand_assets_metadata` | GIN (jsonb_path_ops) | Query by generation model/params |
| `products` | `idx_products_fts` | GIN (tsvector) | Full-text product search |
| `products` | `idx_products_name_trgm` | GIN (trigram) | Fuzzy name search |
| `products` | `idx_products_sku_trgm` | GIN (trigram) | Fuzzy SKU search |
| `generation_jobs` | `idx_gen_jobs_status` | B-tree (partial, active only) | Active job monitoring |
| `generation_jobs` | `idx_gen_jobs_result` | GIN (jsonb_path_ops) | Result metadata queries |
| `audit_log` | `idx_audit_log_metadata` | GIN (jsonb_path_ops) | Analytics queries on event metadata |
| `ghl_sync_log` | `idx_ghl_sync_retry` | B-tree (partial, retrying only) | Find jobs pending retry |

**Partial indexes** are used extensively. For example, `idx_gen_jobs_status` only covers rows where status is `queued` or `processing` -- completed and failed jobs are rarely queried by status alone.

### 8.2 JSONB Query Optimization

```sql
-- Use @> (containment) operator with jsonb_path_ops indexes.
-- This is O(log n) with GIN index vs O(n) full scan with -> / ->> operators.

-- GOOD: Uses GIN index (idx_brands_color_palette)
SELECT * FROM brands
WHERE color_palette @> '[{"hex": "#FF5733"}]';

-- GOOD: Uses GIN index (idx_audit_log_metadata)
SELECT * FROM audit_log
WHERE action = 'logo.generated'
AND metadata @> '{"model_used": "flux-2-pro"}';

-- BAD: Full table scan (no index support for ->> filtering)
SELECT * FROM audit_log
WHERE metadata->>'model_used' = 'flux-2-pro';

-- Rule: Always prefer @> containment for JSONB WHERE clauses.
-- Use -> / ->> only in SELECT lists (projection), never in WHERE clauses on large tables.
```

### 8.3 Connection Pooling (Supabase pgbouncer)

```
Supabase provides pgbouncer on port 6543 (transaction mode).

Connection strings:
  Direct (migrations, admin):  postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres
  Pooled (application):        postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres

Rules:
  1. ALL application queries use the POOLED connection (Express.js Supabase client).
  2. DIRECT connection only for migrations and long-running admin operations.
  3. Pool mode: transaction (Supabase default). Connections returned after each transaction.
  4. Max connections per server instance: 20-30 (Supabase Pro plan allows ~60 total).
  5. Set statement_timeout = 30000 (30s) on the application pool.
  6. Set idle_in_transaction_session_timeout = 60000 (60s).

DO NOT:
  - Use prepared statements with pgbouncer in transaction mode.
  - Hold transactions open across await boundaries.
  - Open more than 50 total connections (Supabase Pro plan limit).
```

### 8.4 Query Performance Guidelines

```
1. ALWAYS use .select() with explicit columns, never SELECT *.
   BAD:  supabase.from('brands').select('*')
   GOOD: supabase.from('brands').select('id, name, status, wizard_step, created_at')

2. ALWAYS use .limit() and pagination for list queries.
   supabase.from('brands').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)

3. For counts, use head: true to avoid fetching rows:
   supabase.from('brands').select('*', { count: 'exact', head: true }).eq('user_id', uid)

4. Batch inserts: use .insert([...]) for multiple rows in a single round-trip.

5. Use RPC for complex atomic operations (credit deduction, brand completion):
   supabase.rpc('deduct_credit', { p_user_id: uid, p_credit_type: 'logo', p_amount: 1 })

6. Monitor query performance via Supabase Dashboard > Database > Query Performance.
   Use EXPLAIN ANALYZE in development to verify index usage.

7. Timeouts:
   - Regular queries: 10 seconds
   - Admin/analytics queries: 30 seconds
   - Migrations: no timeout (direct connection)
```

---

## 9. File Manifest, Development Prompt & Acceptance Criteria

### 9.1 File Manifest

```
supabase/
├── config.toml                                    # Supabase project config
├── seed.sql                                       # Combined seed (optional shortcut)
├── migrations/
│   ├── 20260219000000_extensions.sql              # PostgreSQL extensions
│   ├── 20260219000001_utility_functions.sql       # handle_updated_at, handle_new_user
│   ├── 20260219000002_profiles.sql                # profiles table + indexes + trigger
│   ├── 20260219000003_brands.sql                  # brands table + indexes + trigger
│   ├── 20260219000004_products.sql                # products table + FTS + indexes + trigger
│   ├── 20260219000005_brand_assets.sql            # brand_assets table + indexes
│   ├── 20260219000006_brand_products.sql          # brand_products junction + indexes
│   ├── 20260219000007_brand_bundles.sql           # brand_bundles table + indexes + trigger
│   ├── 20260219000008_brand_bundle_items.sql      # brand_bundle_items junction + indexes
│   ├── 20260219000009_generation_credits.sql      # generation_credits table + indexes
│   ├── 20260219000010_generation_jobs.sql         # generation_jobs table + indexes
│   ├── 20260219000011_subscriptions.sql           # subscriptions table + indexes + trigger
│   ├── 20260219000012_payment_history.sql         # payment_history table + indexes
│   ├── 20260219000013_audit_log.sql               # audit_log table + indexes
│   ├── 20260219000014_admin_flags.sql             # admin_flags table + indexes + trigger
│   ├── 20260219000015_chat_messages.sql           # chat_messages table + indexes
│   ├── 20260219000016_ghl_sync_log.sql            # ghl_sync_log table + indexes
│   ├── 20260219000020_rls_policies.sql            # All RLS policies (single atomic file)
│   ├── 20260219000030_functions.sql               # Business logic functions
│   ├── 20260219000040_seed_products.sql           # 24 product catalog entries
│   ├── 20260219000041_seed_subscriptions.sql      # Subscription tier config reference
│   ├── 20260219000042_seed_admin.sql              # Admin user setup
│   └── 20260219000050_storage_buckets.sql         # Storage bucket creation + policies
```

### 9.2 Development Prompt

```
You are building the Supabase/PostgreSQL database for Brand Me Now v2.

Read the full database specification at docs/prd/07-DATABASE.md.

Create each migration file listed in the File Manifest (Section 9.1) inside
supabase/migrations/. Each file should contain the complete, runnable SQL from
the corresponding section of the spec:

1. Split the SQL from Section 2 into individual migration files per table.
2. Copy the RLS policies from Section 3 into 20260219000020_rls_policies.sql.
3. Copy the functions from Section 4 into 20260219000030_functions.sql.
4. Copy the seed data from Section 5 into the 000040-000042 files.
5. Create 20260219000050_storage_buckets.sql from Section 7.

After creating all files, run:
  supabase start
  supabase db reset

Verify:
  - All migrations apply without errors
  - All 15 tables exist with correct columns, constraints, and indexes
  - RLS is enabled on all tables
  - Seed data is present (24 products, admin user)
  - Functions are callable: SELECT public.deduct_credit(...), etc.
  - Storage buckets exist with correct policies

Environment needed:
  - Supabase CLI installed (npm install -g supabase)
  - Docker running (for local Supabase)
  - No external services required -- this is purely database setup
```

### 9.3 Acceptance Criteria

| # | Criterion | Verification Command / Method |
|---|-----------|-------------------------------|
| 1 | All 15 tables created with correct columns, types, constraints | `\dt public.*` shows 15 tables. `\d <table>` matches spec for each. |
| 2 | All foreign key relationships enforced | `INSERT INTO brands (id, user_id, ...) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', ...)` fails with FK violation. |
| 3 | All CHECK constraints work | `UPDATE brands SET status = 'invalid'` fails. `UPDATE profiles SET role = 'hacker'` fails. |
| 4 | All indexes created (50+ indexes) | `\di public.*` lists all expected indexes. Verify partial indexes with `\di+`. |
| 5 | RLS enabled on every public table | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` -- all TRUE. |
| 6 | RLS policies prevent cross-user data access | Create two users. User A inserts a brand. User B cannot SELECT that brand. |
| 7 | Admin role can read all data | User with `role = 'admin'` can SELECT from brands belonging to any user. |
| 8 | Service role bypasses RLS | Queries using `SUPABASE_SERVICE_ROLE_KEY` return all rows regardless of user. |
| 9 | `handle_updated_at` trigger works | `UPDATE profiles SET full_name = 'test' WHERE id = '...'` -- `updated_at` changes automatically. |
| 10 | `handle_new_user` trigger works | Insert into `auth.users` -- corresponding `profiles` row auto-created. |
| 11 | `validate_wizard_step` prevents step skipping | `UPDATE brands SET wizard_step = 'checkout' WHERE wizard_step = 'onboarding'` raises exception. |
| 12 | `validate_wizard_step` allows sequential advancement | `UPDATE brands SET wizard_step = 'social' WHERE wizard_step = 'onboarding'` succeeds. |
| 13 | `deduct_credit` atomically deducts | Call with sufficient credits: returns TRUE, remaining decremented. Call with 0 credits: returns FALSE. |
| 14 | `deduct_credit` handles concurrency | Two simultaneous calls for the last credit: exactly one succeeds, one fails. |
| 15 | `refill_credits` works for all 4 tiers | `SELECT public.refill_credits(uid, 'pro')` creates logo=50, mockup=100 rows. |
| 16 | `complete_brand` finalizes correctly | Brand status set to `complete`, `completed_at` populated, audit_log entry created, JSON summary returned. |
| 17 | `get_credit_summary` returns active credits | Returns only credits with `period_end > NOW()`. |
| 18 | Product catalog seeded (24 products) | `SELECT COUNT(*) FROM products` returns 24. All 5 categories represented. |
| 19 | Full-text search works on products | `SELECT * FROM products WHERE fts @@ to_tsquery('english', 'hoodie')` returns APR-HOODIE-001. |
| 20 | Trigram search works on products | `SELECT * FROM products WHERE name % 'tshrt'` returns close matches (similarity search). |
| 21 | Storage buckets created | `SELECT * FROM storage.buckets` shows `brand-assets` and `product-images`. |
| 22 | Storage policies enforce ownership | User A cannot upload to User B's folder in `brand-assets`. |
| 23 | Migrations are idempotent | `supabase db reset` runs cleanly twice in a row. |
| 24 | GIN indexes used for JSONB queries | `EXPLAIN ANALYZE SELECT * FROM brands WHERE color_palette @> '[{"hex":"#FF5733"}]'` shows Bitmap Index Scan on the GIN index. |
| 25 | Audit log is append-only for non-admins | Regular user cannot UPDATE or DELETE audit_log rows. |

---

## Appendix A: JSONB Column Schemas

For reference by frontend and backend developers. These document the expected shapes for all JSONB columns.

### brands.color_palette

```json
[
  { "hex": "#FF5733", "name": "Sunset Orange", "role": "primary" },
  { "hex": "#2C3E50", "name": "Midnight Blue", "role": "secondary" },
  { "hex": "#ECF0F1", "name": "Cloud White", "role": "background" },
  { "hex": "#1ABC9C", "name": "Turquoise", "role": "accent" }
]
```

### brands.fonts

```json
{
  "primary": "Montserrat",
  "secondary": "Open Sans",
  "body": "Inter",
  "primary_weight": "700",
  "secondary_weight": "400"
}
```

### brands.brand_values

```json
["Innovation", "Authenticity", "Community", "Quality"]
```

### brands.social_data

```json
{
  "platforms": {
    "instagram": {
      "handle": "@username",
      "followers": 15000,
      "engagement_rate": 3.2,
      "top_hashtags": ["#fitness", "#lifestyle"],
      "aesthetic": "bright, minimal, lifestyle",
      "post_frequency": "5/week"
    }
  },
  "analysis": {
    "brand_personality": "Energetic, aspirational, community-focused",
    "content_themes": ["fitness", "wellness", "lifestyle"],
    "audience_demographics": "25-34, urban, fitness enthusiasts",
    "growth_trajectory": "steady upward"
  },
  "analyzed_at": "2026-02-19T12:00:00Z"
}
```

### brand_assets.generation_params

```json
{
  "seed": 42,
  "guidance_scale": 7.5,
  "steps": 30,
  "width": 1024,
  "height": 1024,
  "scheduler": "euler_a"
}
```

### brand_assets.metadata

```json
{
  "original_width": 1024,
  "original_height": 1024,
  "generation_time_ms": 8500,
  "nsfw_score": 0.01,
  "quality_score": 0.92
}
```

### generation_jobs.result

```json
{
  "asset_ids": ["uuid-1", "uuid-2", "uuid-3", "uuid-4"],
  "urls": ["https://...", "https://...", "https://...", "https://..."],
  "model": "flux-2-pro",
  "total_cost_usd": 0.24,
  "generation_count": 4
}
```

### audit_log.metadata

```json
{
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "model_used": "claude-sonnet-4-6",
  "cost_usd": 0.05,
  "duration_ms": 3200,
  "trigger": "wizard_step_advance"
}
```

### ghl_sync_log.payload

```json
{
  "request": {
    "method": "POST",
    "url": "https://services.leadconnectorhq.com/contacts/",
    "body": { "email": "user@example.com", "firstName": "Jane" }
  },
  "response": {
    "status": 200,
    "body": { "contact": { "id": "ghl_abc123" } }
  }
}
```
