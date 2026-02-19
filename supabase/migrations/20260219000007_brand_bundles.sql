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
