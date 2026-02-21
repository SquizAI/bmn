-- =============================================================================
-- 20260220000010_multi_tenant_orgs.sql — Multi-Tenant Organization Hierarchy
-- =============================================================================
-- Adds organizations, org membership, invites, brand assignments,
-- org-aware RLS, and hybrid credit deduction.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- organizations
-- ─────────────────────────────────────────────
CREATE TABLE public.organizations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  slug              TEXT        UNIQUE NOT NULL,
  owner_id          UUID        NOT NULL REFERENCES public.profiles(id),
  logo_url          TEXT,
  billing_email     TEXT,
  stripe_customer_id TEXT       UNIQUE,
  subscription_tier TEXT        NOT NULL DEFAULT 'free'
                                CHECK (subscription_tier IN ('free', 'starter', 'pro', 'agency')),
  settings          JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_owner    ON public.organizations (owner_id);
CREATE INDEX idx_organizations_slug     ON public.organizations (slug);
CREATE INDEX idx_organizations_stripe   ON public.organizations (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_organizations_tier     ON public.organizations (subscription_tier);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.organizations IS 'Top-level tenant. Every user belongs to exactly one org.';
COMMENT ON COLUMN public.organizations.slug IS 'URL-safe unique identifier for the org.';
COMMENT ON COLUMN public.organizations.settings IS 'Org-level feature flags and preferences.';


-- ─────────────────────────────────────────────
-- organization_members
-- ─────────────────────────────────────────────
CREATE TABLE public.organization_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  invited_by  UUID        REFERENCES public.profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_org     ON public.organization_members (org_id);
CREATE INDEX idx_org_members_user    ON public.organization_members (user_id);
CREATE INDEX idx_org_members_role    ON public.organization_members (org_id, role);

COMMENT ON TABLE  public.organization_members IS 'Org membership. Roles: owner, admin, manager, member.';
COMMENT ON COLUMN public.organization_members.role IS 'owner > admin > manager > member.';


-- ─────────────────────────────────────────────
-- organization_invites
-- ─────────────────────────────────────────────
CREATE TABLE public.organization_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'manager', 'member')),
  invited_by  UUID        NOT NULL REFERENCES public.profiles(id),
  token       TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

CREATE INDEX idx_org_invites_org     ON public.organization_invites (org_id);
CREATE INDEX idx_org_invites_email   ON public.organization_invites (email);
CREATE INDEX idx_org_invites_token   ON public.organization_invites (token);
CREATE INDEX idx_org_invites_pending ON public.organization_invites (org_id)
             WHERE accepted_at IS NULL;

COMMENT ON TABLE  public.organization_invites IS 'Pending org invitations. Expire after token TTL.';
COMMENT ON COLUMN public.organization_invites.token IS 'HMAC-signed invite token.';


-- ─────────────────────────────────────────────
-- brand_assignments (which members can access which brands)
-- ─────────────────────────────────────────────
CREATE TABLE public.brand_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('editor', 'viewer')),
  assigned_by UUID        REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, user_id)
);

CREATE INDEX idx_brand_assignments_brand ON public.brand_assignments (brand_id);
CREATE INDEX idx_brand_assignments_user  ON public.brand_assignments (user_id);

COMMENT ON TABLE  public.brand_assignments IS 'Per-brand access control for managers/members.';
COMMENT ON COLUMN public.brand_assignments.role IS 'editor can modify brand data; viewer is read-only.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add org_id to brands
ALTER TABLE public.brands ADD COLUMN org_id UUID REFERENCES public.organizations(id);
CREATE INDEX idx_brands_org_id ON public.brands (org_id);

-- Add org_id to generation_credits for org-level credit pools
ALTER TABLE public.generation_credits ADD COLUMN org_id UUID REFERENCES public.organizations(id);
CREATE INDEX idx_gen_credits_org ON public.generation_credits (org_id) WHERE org_id IS NOT NULL;

-- Allow user_id to be NULL (org pool credits have no individual user)
ALTER TABLE public.generation_credits ALTER COLUMN user_id DROP NOT NULL;

-- At least one of user_id or org_id must be set
ALTER TABLE public.generation_credits ADD CONSTRAINT credits_owner_check
  CHECK (user_id IS NOT NULL OR org_id IS NOT NULL);

-- Update unique constraint to include org_id for org pool credits
-- The old constraint is (user_id, credit_type, period_start) — this still works for individual credits
-- Add a new one for org pool credits
CREATE UNIQUE INDEX uq_org_credit_type_period
  ON public.generation_credits (org_id, credit_type, period_start)
  WHERE org_id IS NOT NULL AND user_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: BACKFILL — Auto-create personal orgs for existing users
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create a personal org for every existing profile that doesn't have one
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
BEGIN
  FOR r IN
    SELECT id, email, full_name, subscription_tier
    FROM public.profiles
    WHERE org_id IS NULL
  LOOP
    v_org_id := gen_random_uuid();

    INSERT INTO public.organizations (id, name, slug, owner_id, subscription_tier)
    VALUES (
      v_org_id,
      COALESCE(NULLIF(r.full_name, ''), split_part(r.email, '@', 1)) || '''s Workspace',
      'personal-' || r.id::text,
      r.id,
      r.subscription_tier
    );

    -- Set org_id on profile
    UPDATE public.profiles SET org_id = v_org_id WHERE id = r.id;

    -- Create owner membership
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (v_org_id, r.id, 'owner');
  END LOOP;
END;
$$;

-- Set org_id on existing brands to match their owner's org
UPDATE public.brands b
SET org_id = p.org_id
FROM public.profiles p
WHERE p.id = b.user_id AND b.org_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: UPDATE handle_new_user() — Auto-create org on signup
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  -- Create personal organization
  INSERT INTO public.organizations (name, slug, owner_id, subscription_tier)
  VALUES (
    v_name || '''s Workspace',
    'personal-' || NEW.id::text,
    NEW.id,
    'free'
  )
  RETURNING id INTO v_org_id;

  -- Create profile with org_id
  INSERT INTO public.profiles (id, email, full_name, avatar_url, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_org_id
  );

  -- Add owner membership
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: NEW RLS HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Get the current user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a member of a given org
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user has a specific org role or higher
CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id UUID, p_min_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  role_order TEXT[] := ARRAY['member', 'manager', 'admin', 'owner'];
  v_user_role TEXT;
  v_min_idx INT;
  v_user_idx INT;
BEGIN
  -- Platform admins always pass
  IF public.is_admin() THEN RETURN TRUE; END IF;

  SELECT om.role INTO v_user_role
  FROM public.organization_members om
  WHERE om.org_id = p_org_id AND om.user_id = auth.uid();

  IF v_user_role IS NULL THEN RETURN FALSE; END IF;

  v_min_idx := array_position(role_order, p_min_role);
  v_user_idx := array_position(role_order, v_user_role);

  RETURN v_user_idx >= v_min_idx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can access a brand (owner, org admin, or assigned)
CREATE OR REPLACE FUNCTION public.can_access_brand(p_brand_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id
    AND (
      b.user_id = auth.uid()
      OR public.has_org_role(b.org_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.brand_assignments ba
        WHERE ba.brand_id = p_brand_id AND ba.user_id = auth.uid()
      )
      OR public.is_admin()
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user can edit a brand (owner, org admin, or assigned editor)
CREATE OR REPLACE FUNCTION public.can_edit_brand(p_brand_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id
    AND (
      b.user_id = auth.uid()
      OR public.has_org_role(b.org_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.brand_assignments ba
        WHERE ba.brand_id = p_brand_id
          AND ba.user_id = auth.uid()
          AND ba.role = 'editor'
      )
      OR public.is_admin()
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: REPLACE RLS POLICIES (org-aware)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── organizations ──────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_own"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id) OR public.is_admin());

CREATE POLICY "orgs_insert_authenticated"
  ON public.organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "orgs_update_owner"
  ON public.organizations FOR UPDATE
  USING (public.has_org_role(id, 'owner'));

CREATE POLICY "orgs_delete_superadmin"
  ON public.organizations FOR DELETE
  USING (public.is_admin());


-- ─── organization_members ───────────────────────────────────────────────────
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_admin());

CREATE POLICY "org_members_insert_admin"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.has_org_role(org_id, 'admin'));

CREATE POLICY "org_members_update_owner"
  ON public.organization_members FOR UPDATE
  USING (public.has_org_role(org_id, 'owner'));

CREATE POLICY "org_members_delete_owner"
  ON public.organization_members FOR DELETE
  USING (public.has_org_role(org_id, 'owner') OR public.is_admin());


-- ─── organization_invites ───────────────────────────────────────────────────
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_invites_select"
  ON public.organization_invites FOR SELECT
  USING (public.has_org_role(org_id, 'admin') OR public.is_admin());

CREATE POLICY "org_invites_insert_admin"
  ON public.organization_invites FOR INSERT
  WITH CHECK (public.has_org_role(org_id, 'admin'));

CREATE POLICY "org_invites_update_admin"
  ON public.organization_invites FOR UPDATE
  USING (public.has_org_role(org_id, 'admin'));

CREATE POLICY "org_invites_delete_admin"
  ON public.organization_invites FOR DELETE
  USING (public.has_org_role(org_id, 'admin') OR public.is_admin());


-- ─── brand_assignments ──────────────────────────────────────────────────────
ALTER TABLE public.brand_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_assign_select"
  ON public.brand_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assignments.brand_id
      AND public.has_org_role(b.org_id, 'admin')
    )
    OR public.is_admin()
  );

CREATE POLICY "brand_assign_insert_admin"
  ON public.brand_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assignments.brand_id
      AND public.has_org_role(b.org_id, 'admin')
    )
  );

CREATE POLICY "brand_assign_update_admin"
  ON public.brand_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assignments.brand_id
      AND public.has_org_role(b.org_id, 'admin')
    )
  );

CREATE POLICY "brand_assign_delete_admin"
  ON public.brand_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_assignments.brand_id
      AND public.has_org_role(b.org_id, 'admin')
    )
    OR public.is_admin()
  );


-- ─── brands (replace existing policies) ─────────────────────────────────────
DROP POLICY IF EXISTS "brands_select_own" ON public.brands;
DROP POLICY IF EXISTS "brands_insert_own" ON public.brands;
DROP POLICY IF EXISTS "brands_update_own" ON public.brands;
DROP POLICY IF EXISTS "brands_delete_own" ON public.brands;

CREATE POLICY "brands_select"
  ON public.brands FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_org_role(org_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.brand_assignments ba
      WHERE ba.brand_id = id AND ba.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "brands_insert"
  ON public.brands FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = public.get_user_org_id()
  );

CREATE POLICY "brands_update"
  ON public.brands FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.has_org_role(org_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.brand_assignments ba
      WHERE ba.brand_id = id AND ba.user_id = auth.uid() AND ba.role = 'editor'
    )
  );

CREATE POLICY "brands_delete"
  ON public.brands FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_org_role(org_id, 'owner')
    OR public.is_admin()
  );


-- ─── brand_assets (replace existing) ────────────────────────────────────────
DROP POLICY IF EXISTS "brand_assets_select_own" ON public.brand_assets;
DROP POLICY IF EXISTS "brand_assets_insert_own" ON public.brand_assets;
DROP POLICY IF EXISTS "brand_assets_update_own" ON public.brand_assets;
DROP POLICY IF EXISTS "brand_assets_delete_own" ON public.brand_assets;

CREATE POLICY "brand_assets_select"
  ON public.brand_assets FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "brand_assets_insert"
  ON public.brand_assets FOR INSERT
  WITH CHECK (public.can_edit_brand(brand_id));

CREATE POLICY "brand_assets_update"
  ON public.brand_assets FOR UPDATE
  USING (public.can_edit_brand(brand_id));

CREATE POLICY "brand_assets_delete"
  ON public.brand_assets FOR DELETE
  USING (public.can_edit_brand(brand_id) OR public.is_admin());


-- ─── brand_products (replace existing) ──────────────────────────────────────
DROP POLICY IF EXISTS "brand_products_select_own" ON public.brand_products;
DROP POLICY IF EXISTS "brand_products_insert_own" ON public.brand_products;
DROP POLICY IF EXISTS "brand_products_update_own" ON public.brand_products;
DROP POLICY IF EXISTS "brand_products_delete_own" ON public.brand_products;

CREATE POLICY "brand_products_select"
  ON public.brand_products FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "brand_products_insert"
  ON public.brand_products FOR INSERT
  WITH CHECK (public.can_edit_brand(brand_id));

CREATE POLICY "brand_products_update"
  ON public.brand_products FOR UPDATE
  USING (public.can_edit_brand(brand_id));

CREATE POLICY "brand_products_delete"
  ON public.brand_products FOR DELETE
  USING (public.can_edit_brand(brand_id));


-- ─── brand_bundles (replace existing) ───────────────────────────────────────
DROP POLICY IF EXISTS "brand_bundles_select_own" ON public.brand_bundles;
DROP POLICY IF EXISTS "brand_bundles_insert_own" ON public.brand_bundles;
DROP POLICY IF EXISTS "brand_bundles_update_own" ON public.brand_bundles;
DROP POLICY IF EXISTS "brand_bundles_delete_own" ON public.brand_bundles;

CREATE POLICY "brand_bundles_select"
  ON public.brand_bundles FOR SELECT
  USING (public.can_access_brand(brand_id));

CREATE POLICY "brand_bundles_insert"
  ON public.brand_bundles FOR INSERT
  WITH CHECK (public.can_edit_brand(brand_id));

CREATE POLICY "brand_bundles_update"
  ON public.brand_bundles FOR UPDATE
  USING (public.can_edit_brand(brand_id));

CREATE POLICY "brand_bundles_delete"
  ON public.brand_bundles FOR DELETE
  USING (public.can_edit_brand(brand_id));


-- ─── brand_bundle_items (replace existing) ──────────────────────────────────
DROP POLICY IF EXISTS "brand_bundle_items_select_own" ON public.brand_bundle_items;
DROP POLICY IF EXISTS "brand_bundle_items_insert_own" ON public.brand_bundle_items;
DROP POLICY IF EXISTS "brand_bundle_items_update_own" ON public.brand_bundle_items;
DROP POLICY IF EXISTS "brand_bundle_items_delete_own" ON public.brand_bundle_items;

CREATE POLICY "brand_bundle_items_select"
  ON public.brand_bundle_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      WHERE bb.id = brand_bundle_items.bundle_id
      AND public.can_access_brand(bb.brand_id)
    )
  );

CREATE POLICY "brand_bundle_items_insert"
  ON public.brand_bundle_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      WHERE bb.id = brand_bundle_items.bundle_id
      AND public.can_edit_brand(bb.brand_id)
    )
  );

CREATE POLICY "brand_bundle_items_update"
  ON public.brand_bundle_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      WHERE bb.id = brand_bundle_items.bundle_id
      AND public.can_edit_brand(bb.brand_id)
    )
  );

CREATE POLICY "brand_bundle_items_delete"
  ON public.brand_bundle_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_bundles bb
      WHERE bb.id = brand_bundle_items.bundle_id
      AND public.can_edit_brand(bb.brand_id)
    )
  );


-- ─── generation_credits (update for org pool) ──────────────────────────────
DROP POLICY IF EXISTS "gen_credits_select_own" ON public.generation_credits;
DROP POLICY IF EXISTS "gen_credits_insert_admin" ON public.generation_credits;
DROP POLICY IF EXISTS "gen_credits_update_admin" ON public.generation_credits;
DROP POLICY IF EXISTS "gen_credits_delete_admin" ON public.generation_credits;

CREATE POLICY "gen_credits_select"
  ON public.generation_credits FOR SELECT
  USING (
    user_id = auth.uid()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR public.is_admin()
  );

CREATE POLICY "gen_credits_insert_admin"
  ON public.generation_credits FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "gen_credits_update_admin"
  ON public.generation_credits FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "gen_credits_delete_admin"
  ON public.generation_credits FOR DELETE
  USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 7: HYBRID CREDIT DEDUCTION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: deduct from a specific pool (org or individual)
CREATE OR REPLACE FUNCTION public.deduct_credit_from_pool(
  p_org_id UUID,
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_credit_id UUID;
BEGIN
  -- Lock the active credit row for this pool
  SELECT id INTO v_credit_id
  FROM public.generation_credits
  WHERE
    CASE
      WHEN p_org_id IS NOT NULL THEN org_id = p_org_id AND user_id IS NULL
      ELSE user_id = p_user_id AND org_id IS NULL
    END
    AND credit_type = p_credit_type
    AND credits_remaining >= p_amount
    AND period_end > NOW()
  ORDER BY period_end ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.generation_credits
  SET
    credits_remaining = credits_remaining - p_amount,
    credits_used = credits_used + p_amount
  WHERE id = v_credit_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated deduct_credit: tries org pool first, then individual
CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
  v_deducted BOOLEAN := FALSE;
BEGIN
  -- Get user's org
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = p_user_id;

  -- Try org pool first
  IF v_org_id IS NOT NULL THEN
    v_deducted := public.deduct_credit_from_pool(v_org_id, NULL, p_credit_type, p_amount);
  END IF;

  -- Fallback to individual credits
  IF NOT v_deducted THEN
    v_deducted := public.deduct_credit_from_pool(NULL, p_user_id, p_credit_type, p_amount);
  END IF;

  RETURN v_deducted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old get_credit_summary because return type changed (added pool_type column)
DROP FUNCTION IF EXISTS public.get_credit_summary(UUID);

CREATE FUNCTION public.get_credit_summary(p_user_id UUID)
RETURNS TABLE (
  credit_type TEXT,
  remaining INTEGER,
  used INTEGER,
  total INTEGER,
  period_end TIMESTAMPTZ,
  pool_type TEXT
) AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = p_user_id;

  RETURN QUERY
  -- Individual credits
  SELECT
    gc.credit_type,
    gc.credits_remaining AS remaining,
    gc.credits_used AS used,
    (gc.credits_remaining + gc.credits_used) AS total,
    gc.period_end,
    'individual'::TEXT AS pool_type
  FROM public.generation_credits gc
  WHERE gc.user_id = p_user_id
    AND gc.org_id IS NULL
    AND gc.period_end > NOW()
  UNION ALL
  -- Org pool credits
  SELECT
    gc.credit_type,
    gc.credits_remaining AS remaining,
    gc.credits_used AS used,
    (gc.credits_remaining + gc.credits_used) AS total,
    gc.period_end,
    'organization'::TEXT AS pool_type
  FROM public.generation_credits gc
  WHERE gc.org_id = v_org_id
    AND gc.user_id IS NULL
    AND gc.period_end > NOW()
  ORDER BY credit_type, pool_type, period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop old refill_credits because signature changed (added p_org_id parameter)
DROP FUNCTION IF EXISTS public.refill_credits(UUID, TEXT);

CREATE FUNCTION public.refill_credits(
  p_user_id UUID,
  p_tier TEXT,
  p_org_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_logo_credits INTEGER;
  v_mockup_credits INTEGER;
  v_period_start TIMESTAMPTZ := NOW();
  v_period_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  v_target_user UUID;
  v_target_org UUID;
BEGIN
  CASE p_tier
    WHEN 'free' THEN
      v_logo_credits := 4;
      v_mockup_credits := 4;
    WHEN 'starter' THEN
      v_logo_credits := 20;
      v_mockup_credits := 30;
    WHEN 'pro' THEN
      v_logo_credits := 50;
      v_mockup_credits := 100;
    WHEN 'agency' THEN
      v_logo_credits := 200;
      v_mockup_credits := 500;
    ELSE
      RAISE EXCEPTION 'Unknown subscription tier: "%". Valid tiers: free, starter, pro, agency.', p_tier;
  END CASE;

  -- Determine target: org pool or individual
  IF p_org_id IS NOT NULL THEN
    v_target_user := NULL;
    v_target_org := p_org_id;
  ELSE
    v_target_user := p_user_id;
    v_target_org := NULL;
  END IF;

  -- Upsert logo credits
  INSERT INTO public.generation_credits (user_id, org_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (v_target_user, v_target_org, 'logo', v_logo_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT ON CONSTRAINT uq_user_credit_type_period
  DO UPDATE SET
    credits_remaining = v_logo_credits,
    credits_used = 0,
    last_refill_at = NOW()
  WHERE public.generation_credits.user_id IS NOT NULL;

  -- Upsert mockup credits
  INSERT INTO public.generation_credits (user_id, org_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (v_target_user, v_target_org, 'mockup', v_mockup_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT ON CONSTRAINT uq_user_credit_type_period
  DO UPDATE SET
    credits_remaining = v_mockup_credits,
    credits_used = 0,
    last_refill_at = NOW()
  WHERE public.generation_credits.user_id IS NOT NULL;

  -- Update tier on profile or org
  IF p_org_id IS NOT NULL THEN
    UPDATE public.organizations SET subscription_tier = p_tier WHERE id = p_org_id;
  ELSE
    UPDATE public.profiles SET subscription_tier = p_tier WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.deduct_credit IS 'Hybrid credit deduction: tries org pool first, then individual credits.';
COMMENT ON FUNCTION public.deduct_credit_from_pool IS 'Deduct credits from a specific pool (org or individual).';
COMMENT ON FUNCTION public.get_credit_summary IS 'Returns active credit balances (individual + org pool) for a user.';
COMMENT ON FUNCTION public.refill_credits IS 'Refill credits for user or org based on tier. Called on subscription renewal.';
