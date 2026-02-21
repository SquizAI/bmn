-- =============================================================================
-- 20260220000020_packaging_templates.sql
-- Create the packaging_templates table for admin-managed packaging/bottle
-- templates with branding zone definitions for AI-driven logo placement.
-- =============================================================================

CREATE TABLE public.packaging_templates (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT          UNIQUE NOT NULL,
  name                TEXT          NOT NULL,
  category            TEXT          NOT NULL,
  description         TEXT          DEFAULT '',
  template_image_url  TEXT          NOT NULL,
  template_width_px   INTEGER       NOT NULL DEFAULT 1024,
  template_height_px  INTEGER       NOT NULL DEFAULT 1024,
  branding_zones      JSONB         NOT NULL DEFAULT '[]',
  print_specs         JSONB         DEFAULT '{}',
  ai_prompt_template  TEXT          DEFAULT '',
  reference_images    JSONB         DEFAULT '[]',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_packaging_templates_category ON public.packaging_templates (category) WHERE is_active = TRUE;
CREATE INDEX idx_packaging_templates_slug ON public.packaging_templates (slug);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_packaging_templates_updated_at
  BEFORE UPDATE ON public.packaging_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.packaging_templates IS 'Admin-managed packaging/bottle templates with branding zone definitions for logo placement.';
COMMENT ON COLUMN public.packaging_templates.branding_zones IS 'JSON array of zone objects defining where brand elements (logo, text, colors) go on the packaging.';
COMMENT ON COLUMN public.packaging_templates.print_specs IS 'Print specifications: DPI, bleed, safe area, color space, dimensions.';
COMMENT ON COLUMN public.packaging_templates.ai_prompt_template IS 'Prompt template with {{placeholders}} for AI mockup generation.';
COMMENT ON COLUMN public.packaging_templates.reference_images IS 'JSON array of reference image URLs for AI style guidance.';

-- RLS: anyone can read active templates, admin-only write
ALTER TABLE public.packaging_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packaging_templates_public_read"
  ON public.packaging_templates FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "packaging_templates_insert_admin"
  ON public.packaging_templates FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "packaging_templates_update_admin"
  ON public.packaging_templates FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "packaging_templates_delete_admin"
  ON public.packaging_templates FOR DELETE
  USING (public.is_admin());

-- Service role bypass (for seed scripts and server-side operations)
CREATE POLICY "packaging_templates_service_role"
  ON public.packaging_templates
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
