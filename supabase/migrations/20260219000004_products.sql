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
