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
