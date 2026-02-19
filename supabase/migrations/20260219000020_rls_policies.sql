-- =============================================================================
-- 20_rls_policies.sql — Row Level Security for ALL tables
-- =============================================================================

-- ── Helper Functions ──────────────────────────────────────────────────────

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's ID (convenience wrapper)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_super_admin"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );


-- ─────────────────────────────────────────────
-- brands
-- ─────────────────────────────────────────────
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_own"
  ON public.brands FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "brands_insert_own"
  ON public.brands FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_update_own"
  ON public.brands FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brands_delete_own"
  ON public.brands FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());


-- ─────────────────────────────────────────────
-- brand_assets
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_assets_select_own"
  ON public.brand_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_assets_insert_own"
  ON public.brand_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_update_own"
  ON public.brand_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_delete_own"
  ON public.brand_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assets.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );


-- ─────────────────────────────────────────────
-- brand_products
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_products_select_own"
  ON public.brand_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_products_insert_own"
  ON public.brand_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_products_update_own"
  ON public.brand_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_products_delete_own"
  ON public.brand_products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_products.brand_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- brand_bundles
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_bundles_select_own"
  ON public.brand_bundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_bundles_insert_own"
  ON public.brand_bundles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundles_update_own"
  ON public.brand_bundles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundles_delete_own"
  ON public.brand_bundles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_bundles.brand_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- brand_bundle_items
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_bundle_items_select_own"
  ON public.brand_bundle_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "brand_bundle_items_insert_own"
  ON public.brand_bundle_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundle_items_update_own"
  ON public.brand_bundle_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_bundle_items_delete_own"
  ON public.brand_bundle_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      JOIN public.brands b ON b.id = bb.brand_id
      WHERE bb.id = brand_bundle_items.bundle_id AND b.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- products (public read for authenticated users, admin write)
-- ─────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_active"
  ON public.products FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- generation_credits
-- ─────────────────────────────────────────────
ALTER TABLE public.generation_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_credits_select_own"
  ON public.generation_credits FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Credits are created/updated by server (service_role bypasses RLS).
-- Admin can manually add credits via dashboard.
CREATE POLICY "gen_credits_insert_admin"
  ON public.generation_credits FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "gen_credits_update_admin"
  ON public.generation_credits FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "gen_credits_delete_admin"
  ON public.generation_credits FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- generation_jobs
-- ─────────────────────────────────────────────
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_jobs_select_own"
  ON public.generation_jobs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "gen_jobs_insert_own"
  ON public.generation_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "gen_jobs_update_own"
  ON public.generation_jobs FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

-- Users cannot delete jobs (immutable history)
CREATE POLICY "gen_jobs_delete_admin"
  ON public.generation_jobs FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- subscriptions
-- ─────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Subscriptions are managed exclusively by Stripe webhooks (service_role).
CREATE POLICY "subscriptions_insert_admin"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "subscriptions_update_admin"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "subscriptions_delete_admin"
  ON public.subscriptions FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- payment_history
-- ─────────────────────────────────────────────
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_history_select_own"
  ON public.payment_history FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Payments created by Stripe webhooks (service_role).
CREATE POLICY "payment_history_insert_admin"
  ON public.payment_history FOR INSERT
  WITH CHECK (public.is_admin());

-- Payment records are immutable.
CREATE POLICY "payment_history_update_admin"
  ON public.payment_history FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "payment_history_delete_admin"
  ON public.payment_history FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- audit_log (append-only, read by owner + admin)
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_own"
  ON public.audit_log FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Entries created by server (service_role).
CREATE POLICY "audit_log_insert_admin"
  ON public.audit_log FOR INSERT
  WITH CHECK (public.is_admin());

-- IMMUTABLE: No update policy = no updates permitted via RLS.
-- IMMUTABLE: No delete policy = no deletes permitted via RLS.


-- ─────────────────────────────────────────────
-- admin_flags (admin-only table)
-- ─────────────────────────────────────────────
ALTER TABLE public.admin_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_flags_select_admin"
  ON public.admin_flags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admin_flags_insert_admin"
  ON public.admin_flags FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_flags_update_admin"
  ON public.admin_flags FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "admin_flags_delete_admin"
  ON public.admin_flags FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- chat_messages
-- ─────────────────────────────────────────────
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own"
  ON public.chat_messages FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "chat_messages_insert_own"
  ON public.chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Chat messages are immutable (no update policy).
-- Users cannot delete chat history; admin can for moderation.
CREATE POLICY "chat_messages_delete_admin"
  ON public.chat_messages FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- ghl_sync_log (admin + service only)
-- ─────────────────────────────────────────────
ALTER TABLE public.ghl_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ghl_sync_select_admin"
  ON public.ghl_sync_log FOR SELECT
  USING (public.is_admin());

-- Sync logs created by server (service_role).
CREATE POLICY "ghl_sync_insert_admin"
  ON public.ghl_sync_log FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "ghl_sync_update_admin"
  ON public.ghl_sync_log FOR UPDATE
  USING (public.is_admin());

-- Sync logs are append-only. No deletes.
