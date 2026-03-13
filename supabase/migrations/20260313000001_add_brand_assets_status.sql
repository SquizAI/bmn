-- Add status column to brand_assets for tracking approval workflow
ALTER TABLE public.brand_assets
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'generated'
  CHECK (status IN ('generated', 'approved', 'rejected'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_brand_assets_status ON public.brand_assets (brand_id, status);

COMMENT ON COLUMN public.brand_assets.status IS 'Approval workflow status: generated (pending review), approved, rejected';
