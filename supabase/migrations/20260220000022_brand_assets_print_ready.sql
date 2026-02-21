-- =============================================================================
-- 20260220000022_brand_assets_print_ready.sql
-- Expand brand_assets.asset_type CHECK constraint to include 'print_ready'
-- for print-resolution assets generated from packaging templates.
-- =============================================================================

-- Drop the existing constraint and recreate with the new type included
ALTER TABLE public.brand_assets
  DROP CONSTRAINT IF EXISTS brand_assets_asset_type_check;

ALTER TABLE public.brand_assets
  ADD CONSTRAINT brand_assets_asset_type_check
  CHECK (asset_type IN ('logo', 'mockup', 'bundle_image', 'social_asset', 'label', 'brand_guide', 'print_ready'));
