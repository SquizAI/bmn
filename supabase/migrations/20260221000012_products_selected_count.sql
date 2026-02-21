-- =============================================================================
-- 20260221000012_products_selected_count.sql
-- Add selected_count column to products table for social proof tracking.
-- Also creates an RPC function to atomically increment the counter.
-- =============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selected_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_product_selected_count(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET selected_count = selected_count + 1
  WHERE id = p_product_id;
END;
$$;

COMMENT ON COLUMN public.products.selected_count IS 'Number of times users have selected this product during the wizard. Used for social proof and popularity ranking.';
COMMENT ON FUNCTION public.increment_product_selected_count(UUID) IS 'Atomically increments the selected_count for a product. Called during the product-selection wizard step.';
