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
