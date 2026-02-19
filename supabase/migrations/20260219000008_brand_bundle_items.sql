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
