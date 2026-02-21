-- =============================================================================
-- 20260221000002_product_tiers.sql
-- Product tier system: quality/price tiers with subscription gating.
-- Tiers control which products are visible to which subscription levels.
-- =============================================================================

-- ── product_tiers table ─────────────────────────────────────────────────────

CREATE TABLE public.product_tiers (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT          UNIQUE NOT NULL,
  name                  TEXT          NOT NULL,
  display_name          TEXT          NOT NULL,
  description           TEXT          DEFAULT '',
  sort_order            INTEGER       NOT NULL DEFAULT 0,
  min_subscription_tier TEXT          NOT NULL DEFAULT 'free'
                                      CHECK (min_subscription_tier IN ('free', 'starter', 'pro', 'agency')),
  margin_multiplier     NUMERIC(4,2)  NOT NULL DEFAULT 1.00
                                      CHECK (margin_multiplier > 0),
  badge_color           TEXT          NOT NULL DEFAULT '#6B7280',
  badge_label           TEXT          NOT NULL DEFAULT '',
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_tiers_active     ON public.product_tiers (is_active, sort_order);
CREATE INDEX idx_product_tiers_slug       ON public.product_tiers (slug) WHERE is_active = TRUE;

-- Trigger: auto-update updated_at
CREATE TRIGGER set_product_tiers_updated_at
  BEFORE UPDATE ON public.product_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS policies
ALTER TABLE public.product_tiers ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see active tiers
CREATE POLICY "Anyone can view active product tiers"
  ON public.product_tiers
  FOR SELECT
  USING (is_active = TRUE);

-- Admin write: service_role can do everything
CREATE POLICY "Service role full access to product tiers"
  ON public.product_tiers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE  public.product_tiers IS 'Admin-managed product quality/price tiers with subscription gating.';
COMMENT ON COLUMN public.product_tiers.min_subscription_tier IS 'Minimum subscription tier required to access products in this tier.';
COMMENT ON COLUMN public.product_tiers.margin_multiplier IS 'Pricing multiplier applied to base cost for this tier level.';

-- ── Add tier_id FK to products ──────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.product_tiers(id) ON DELETE SET NULL;

CREATE INDEX idx_products_tier ON public.products (tier_id) WHERE is_active = TRUE;

-- ── Seed 3 default product tiers ────────────────────────────────────────────

INSERT INTO public.product_tiers (slug, name, display_name, description, sort_order, min_subscription_tier, margin_multiplier, badge_color, badge_label)
VALUES
  (
    'essentials',
    'Essentials',
    'Essentials Collection',
    'Core health and wellness products. High-quality vitamins, minerals, and foundational supplements accessible to all users.',
    1,
    'free',
    1.00,
    '#10B981',
    'Essentials'
  ),
  (
    'premium',
    'Premium',
    'Premium Formulations',
    'Advanced formulations with patented ingredients, higher potencies, and specialty blends for targeted health goals.',
    2,
    'starter',
    1.25,
    '#8B5CF6',
    'Premium'
  ),
  (
    'elite',
    'Elite',
    'Elite / Clinical Grade',
    'Clinical-grade compounds, peptides, and pharmaceutical-quality products. The highest tier of health optimization.',
    3,
    'pro',
    1.50,
    '#F59E0B',
    'Elite'
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Assign existing supplements to essentials tier ──────────────────────────

UPDATE public.products
SET tier_id = (SELECT id FROM public.product_tiers WHERE slug = 'essentials')
WHERE sku LIKE 'BMN-%'
  AND tier_id IS NULL;

-- =============================================================================
-- Summary:
--   - Created product_tiers table with 3 tiers (essentials, premium, elite)
--   - Added tier_id FK on products table
--   - Assigned all 12 existing BMN supplements to essentials tier
--   - RLS: public read for active tiers, service_role full access
-- =============================================================================
