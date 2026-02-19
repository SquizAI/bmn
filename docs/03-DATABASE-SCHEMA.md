# Database Schema & Data Models

**Date:** February 19, 2026

---

## Overview

- **Primary Database:** Supabase (PostgreSQL 17)
- **Query Layer:** Supabase Python Client (PostgREST-style fluent API)
- **Legacy Database:** NocoDB (being phased out)
- **No traditional ORM** (no SQLAlchemy, Prisma, or Drizzle)

---

## Entity Relationship Diagram

```
auth.users (Supabase Auth)
     │
     │ 1:1
     ▼
┌─────────────┐
│  profiles    │
│─────────────│
│ id (PK=auth)│
│ email       │
│ phone       │
│ full_name   │
│ password    │
│ tc_accepted │
│ created_at  │
│ updated_at  │
└──┬──┬──┬────┘
   │  │  │
   │  │  │  1:N
   │  │  └──────────────────────────────────┐
   │  │  1:N                                │
   │  └───────────────────┐                 │
   │  1:N                 │                 │
   ▼                      ▼                 ▼
┌─────────────┐   ┌──────────────┐  ┌──────────────┐
│   brands    │   │ user_socials │  │ ghl_contacts │
│─────────────│   │──────────────│  │──────────────│
│ id (PK)     │   │ id (PK)      │  │ id (PK)      │
│ user_id(FK) │   │ user_id (FK) │  │ user_id (FK) │
│ status      │   │ platform     │  │ ghl_contact_id│
│ name        │   │ handle       │  │ ghl_location  │
│ description │   │ profile_url  │  │ sync_data    │
│ vision      │   │ analysis_data│  │ last_synced  │
│ color_palette│  │ analyzed_at  │  │ created_at   │
│ fonts       │   │ created_at   │  │ updated_at   │
│ logo_style  │   │ updated_at   │  └──────────────┘
│ archetype   │   └──────────────┘
│ values      │
│ audience    │
│ label_design│
│ step_url    │
│ wizard_step │
│ created_at  │
│ updated_at  │
└──┬──┬──┬────┘
   │  │  │
   │  │  │  1:N
   │  │  └──────────────────────┐
   │  │  1:N                    │
   │  └───────────┐             │
   │  1:N         │             │
   ▼              ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌───────────────┐
│ brand_assets │ │brand_mockups │ │brand_products │
│──────────────│ │──────────────│ │───────────────│
│ id (PK)      │ │ id (PK)      │ │ id (PK)       │
│ brand_id(FK) │ │ brand_id(FK) │ │ brand_id (FK) │
│ asset_type   │ │ product_id   │ │ product_id(FK)│
│ file_url     │ │ mockup_url   │ │ quantity      │
│ file_name    │ │ label_url    │ │ notes         │
│ metadata     │ │ prompt_used  │ │ selected_at   │
│ is_primary   │ │ gen_params   │ └───────┬───────┘
│ created_at   │ │ variation_no │         │
│ updated_at   │ │ status       │         │
└──────────────┘ │ created_at   │         │
                 │ updated_at   │         │
                 └──────┬───────┘         │
                        │                 │
                        │  N:1            │ N:1
                        ▼                 ▼
                 ┌──────────────┐
                 │  products    │
                 │──────────────│
                 │ id (PK)      │
                 │ sku (unique) │
                 │ name         │
                 │ category     │
                 │ is_active    │
                 │ created_at   │
                 │ updated_at   │
                 └──────────────┘
```

---

## Table Details

### profiles

User accounts linked 1:1 with Supabase `auth.users`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK (= auth.users.id) | User ID from Supabase Auth |
| email | TEXT | Indexed (ilike) | User email |
| phone | TEXT | Indexed | Phone number |
| full_name | TEXT | | Display name |
| password | TEXT | | Hashed password |
| tc_accepted_at | TIMESTAMPTZ | Indexed | When T&C were accepted |
| created_at | TIMESTAMPTZ | | Account creation |
| updated_at | TIMESTAMPTZ | | Last modification |

### brands

Brand projects created by users through the wizard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Brand ID (= wizard session ID) |
| user_id | UUID | FK → profiles.id | Owner |
| status | TEXT | | "draft", "published", etc. |
| name | TEXT | | Brand name |
| description | TEXT | | Brand description |
| vision | TEXT | | Brand vision statement |
| color_palette | JSONB | | Array of `{hex, role}` objects |
| fonts | JSONB | | Typography settings |
| logo_style | TEXT | | Selected logo style |
| brand_archetype | TEXT | | Brand personality archetype |
| brand_values | JSONB | | Array of value strings |
| target_audience | TEXT | | Target audience description |
| label_design | TEXT | | Label design preferences |
| step_url | TEXT | | Resume URL for wizard |
| wizard_step | INT | | Current wizard step number |
| created_at | TIMESTAMPTZ | | Creation timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

### brand_assets

Files associated with brands (logos, guides).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Asset ID |
| brand_id | UUID | FK → brands.id | Parent brand |
| asset_type | TEXT | | "logo", "mockup", "brand_guide" |
| file_url | TEXT | | Public URL (Supabase Storage) |
| file_name | TEXT | | Original filename |
| metadata | JSONB | | MIME type, size, dimensions |
| is_primary | BOOLEAN | | Primary asset of this type |
| created_at | TIMESTAMPTZ | | Upload timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

### brand_mockups

AI-generated product mockups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Mockup ID |
| brand_id | UUID | FK → brands.id | Parent brand |
| product_id | UUID | FK → products.id, nullable | Product shown |
| mockup_url | TEXT | | Generated mockup image URL |
| label_url | TEXT | | Generated label image URL |
| prompt_used | TEXT | | AI generation prompt |
| generation_params | JSONB | | Full generation parameters |
| variation_number | INT | | Variation index |
| status | TEXT | | "generated", "approved", "rejected" |
| created_at | TIMESTAMPTZ | | Generation timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

### products

Product catalog for mockup generation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Product ID |
| sku | TEXT | Unique index | Stock keeping unit |
| name | TEXT | | Product name |
| category | TEXT | Indexed | Product category |
| is_active | BOOLEAN | Indexed | Available for selection |
| created_at | TIMESTAMPTZ | | Creation timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

### brand_products

Junction table linking brands to selected products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Record ID |
| brand_id | UUID | FK → brands.id | Brand |
| product_id | UUID | FK → products.id | Product |
| quantity | INT | | Selected quantity |
| notes | TEXT | | Notes about selection |
| selected_at | TIMESTAMPTZ | | Selection timestamp |

**Unique constraint:** `(brand_id, product_id)`

### user_socials

Social media accounts and analysis results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Record ID |
| user_id | UUID | FK → profiles.id | Owner |
| platform | TEXT | | "instagram", "tiktok", "twitter" |
| handle | TEXT | Indexed with user_id | Social handle |
| profile_url | TEXT | | Full profile URL |
| analysis_data | JSONB | | AI analysis results |
| analyzed_at | TIMESTAMPTZ | | Last analysis |
| created_at | TIMESTAMPTZ | | Creation timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

### ghl_contacts

GoHighLevel CRM contact sync tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Record ID |
| user_id | UUID | FK → profiles.id | Linked user |
| ghl_contact_id | TEXT | Unique index | GHL contact ID |
| ghl_location_id | TEXT | | GHL location |
| sync_data | JSONB | | Sync metadata |
| last_synced_at | TIMESTAMPTZ | | Last sync timestamp |
| created_at | TIMESTAMPTZ | | Creation timestamp |
| updated_at | TIMESTAMPTZ | | Last modification |

---

## Storage Buckets

| Bucket | Purpose | Path Pattern |
|--------|---------|-------------|
| brand-logos | Logo images | `{user_id}/{brand_id}/logos/{filename}` |
| brand-mockups | Product mockups | `{user_id}/{brand_id}/mockups/{filename}` |
| product-images | Catalog photos | Product reference images |
| product-masks | Generation masks | Mask images for AI mockup generation |

---

## Migrations

| Migration | Date | Changes |
|-----------|------|---------|
| `20260203000000_add_tc_accepted_at.sql` | Feb 3, 2026 | Added `tc_accepted_at` to profiles, created index |

**Note:** Schema is primarily managed through Supabase dashboard + migration files. No automated migration pipeline beyond Supabase CLI.

---

## Legacy: NocoDB

**Status: DEPRECATED - Being phased out**

| Table | Purpose | Migration Status |
|-------|---------|-----------------|
| Wizard Data V2 | Brand wizard form data | Partially migrated to Supabase `brands` |
| wizard_database | Original wizard storage | Superseded by V2, then Supabase |

**Client:** `/shared/services/nocodb_client.py` (1,195 lines)

**Issues:**
- Dual-write: some operations write to both NocoDB and Supabase
- Inconsistent data: NocoDB and Supabase can drift
- 1,195-line client for a system being replaced
- In-memory cache for record IDs (not scalable)

---

## Data Flow: Brand Creation Lifecycle

```
1. User signs up
   → auth.users created (Supabase Auth)
   → profiles row created
   → ghl_contacts row created (GHL sync)

2. Social analysis
   → user_socials row created/updated
   → analysis_data populated with AI results

3. Brand identity
   → brands row created (id = session_id)
   → vision, colors, fonts, archetype populated

4. Logo generation
   → Fal.ai generates images
   → brand_assets rows created (type: "logo")
   → Files uploaded to brand-logos bucket

5. Product selection
   → brand_products junction rows created
   → Links brand to product catalog entries

6. Mockup generation
   → Fal.ai generates product mockups
   → brand_mockups rows created
   → Files uploaded to brand-mockups bucket

7. Approval & submission
   → brand_mockups.status → "approved"
   → brands.status updated
   → GHL contact updated with final assets
```
