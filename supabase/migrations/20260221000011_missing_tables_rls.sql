-- =============================================================================
-- 20260221000011_missing_tables_rls.sql — Row Level Security for the 12 tables
-- created in 20260221000010_missing_tables.sql
--
-- Policy patterns (matching 20260219000020_rls_policies.sql):
--   User-owned  → user_id = auth.uid() OR is_admin()
--   Brand-scoped → JOIN brands WHERE brands.user_id = auth.uid()
--   Immutable logs → SELECT own + admin, server INSERT only, no update/delete
--   Admin-managed → is_admin() for writes, owner for reads
--
-- NOTE: is_admin() helper function already exists from rls_policies migration.
-- =============================================================================


-- ─────────────────────────────────────────────
-- 1. chat_sessions (user-owned)
-- ─────────────────────────────────────────────
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_select_own"
  ON public.chat_sessions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "chat_sessions_insert_own"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_sessions_update_own"
  ON public.chat_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_sessions_delete_own"
  ON public.chat_sessions FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());


-- ─────────────────────────────────────────────
-- 2. webhook_configs (user-owned)
-- ─────────────────────────────────────────────
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_configs_select_own"
  ON public.webhook_configs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "webhook_configs_insert_own"
  ON public.webhook_configs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "webhook_configs_update_own"
  ON public.webhook_configs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "webhook_configs_delete_own"
  ON public.webhook_configs FOR DELETE
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────
-- 3. webhook_deliveries (immutable log, read via config ownership)
-- Server inserts only (via service_role key). Users can read deliveries
-- for their own webhook configs. No update or delete.
-- ─────────────────────────────────────────────
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_select_via_config"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_configs wc
      WHERE wc.id = webhook_config_id
      AND (wc.user_id = auth.uid() OR public.is_admin())
    )
  );

-- No INSERT policy for end users — server inserts via service_role key.
-- No UPDATE or DELETE policies — deliveries are immutable.


-- ─────────────────────────────────────────────
-- 4. orders (brand-scoped)
-- Users can read orders for brands they own.
-- Server manages inserts (via service_role or public storefront).
-- ─────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_via_brand"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "orders_insert_admin"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "orders_update_admin"
  ON public.orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "orders_delete_admin"
  ON public.orders FOR DELETE
  USING (public.is_admin());


-- ─────────────────────────────────────────────
-- 5. order_items (brand-scoped via orders)
-- Users can read items for orders belonging to their brands.
-- Server manages inserts.
-- ─────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select_via_order"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.brands b ON b.id = o.brand_id
      WHERE o.id = order_id
      AND (b.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "order_items_insert_admin"
  ON public.order_items FOR INSERT
  WITH CHECK (public.is_admin());

-- No UPDATE or DELETE for order items — immutable once created.


-- ─────────────────────────────────────────────
-- 6. generated_content (user-owned)
-- ─────────────────────────────────────────────
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_content_select_own"
  ON public.generated_content FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "generated_content_insert_own"
  ON public.generated_content FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "generated_content_delete_own"
  ON public.generated_content FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- No update policy — content is regenerated, not edited.


-- ─────────────────────────────────────────────
-- 7. brand_health_scores (server-managed, user reads own)
-- Analytics worker inserts/upserts via service_role.
-- Users can read scores for their own brands.
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_health_scores_select_own"
  ON public.brand_health_scores FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- No INSERT/UPDATE/DELETE for end users — server manages via service_role key.


-- ─────────────────────────────────────────────
-- 8. email_campaign_log (immutable log, server-managed)
-- Server inserts via service_role. Users can read their own.
-- No update or delete.
-- ─────────────────────────────────────────────
ALTER TABLE public.email_campaign_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_campaign_log_select_own"
  ON public.email_campaign_log FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- No INSERT/UPDATE/DELETE for end users — server manages via service_role key.


-- ─────────────────────────────────────────────
-- 9. email_preferences (user-owned)
-- Users manage their own email preferences.
-- ─────────────────────────────────────────────
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_preferences_select_own"
  ON public.email_preferences FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "email_preferences_insert_own"
  ON public.email_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "email_preferences_update_own"
  ON public.email_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete — preferences are toggled, not removed.


-- ─────────────────────────────────────────────
-- 10. brand_recommendations (server-managed, user reads own)
-- Product recommender skill upserts via service_role.
-- Users can read recommendations for their own brands.
-- ─────────────────────────────────────────────
ALTER TABLE public.brand_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_recommendations_select_own"
  ON public.brand_recommendations FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- No INSERT/UPDATE/DELETE for end users — server manages via service_role key.


-- ─────────────────────────────────────────────
-- 11. api_keys (user-owned, sensitive)
-- Users can create and view their own keys (never see full key after creation).
-- Revocation (soft delete) is an update to revoked_at.
-- ─────────────────────────────────────────────
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own"
  ON public.api_keys FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "api_keys_insert_own"
  ON public.api_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_update_own"
  ON public.api_keys FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete — keys are soft-deleted via revoked_at update.


-- ─────────────────────────────────────────────
-- 12. custom_product_requests (user-owned, admin-reviewable)
-- Users can create and read their own requests.
-- Admins can read all and update status/notes.
-- ─────────────────────────────────────────────
ALTER TABLE public.custom_product_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_product_requests_select_own"
  ON public.custom_product_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "custom_product_requests_insert_own"
  ON public.custom_product_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "custom_product_requests_update_admin"
  ON public.custom_product_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No delete — requests are tracked for fulfillment history.
