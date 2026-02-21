-- =============================================================================
-- 20260220000021_products_template_fk.sql
-- Add template_id FK to products table linking to packaging_templates,
-- and add subcategory column for finer product classification.
-- =============================================================================

-- Add template_id FK to products (links product to its packaging template)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.packaging_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_template ON public.products (template_id) WHERE template_id IS NOT NULL;

-- Add subcategory column for finer classification (e.g., 'mens_health', 'womens_health')
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

COMMENT ON COLUMN public.products.template_id IS 'FK to packaging_templates. Defines which packaging template is used for AI mockup generation.';
COMMENT ON COLUMN public.products.subcategory IS 'Finer product classification within category (e.g., general_health, mens_health, womens_health).';
