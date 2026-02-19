-- =============================================================================
-- 50_storage_buckets.sql — Storage bucket creation and policies
-- =============================================================================

-- ── brand-assets bucket ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  TRUE,                    -- Public read (CDN served for sharing/embedding)
  10485760,                -- 10MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/zip']
);

-- Path convention: {user_id}/{brand_id}/{asset_type}/{filename}
-- Example: 550e8400.../a1b2c3d4.../logos/logo-v1-001.png
-- Example: 550e8400.../a1b2c3d4.../mockups/tshirt-mockup-001.png
-- Example: 550e8400.../a1b2c3d4.../bundles/starter-bundle.png

-- Public read: anyone can view brand assets (for sharing, embedding)
CREATE POLICY "brand_assets_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

-- Authenticated users can upload to their own folder
CREATE POLICY "brand_assets_storage_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Users can update their own files
CREATE POLICY "brand_assets_storage_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "brand_assets_storage_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-assets'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );


-- ── product-images bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,                    -- Public read (catalog images)
  5242880,                 -- 5MB max file size
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);

-- Path convention: {category}/{sku}.{ext}
-- Example: apparel/APR-TSHIRT-001.jpg
-- Example: accessories/ACC-MUG-001.png

-- Public read
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Admin-only upload/modify
CREATE POLICY "product_images_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
