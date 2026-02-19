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
