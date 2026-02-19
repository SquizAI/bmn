-- =============================================================================
-- 02_profiles.sql
-- =============================================================================

CREATE TABLE public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  phone             TEXT,
  full_name         TEXT        NOT NULL DEFAULT '',
  avatar_url        TEXT        DEFAULT '',
  role              TEXT        NOT NULL DEFAULT 'user'
                                CHECK (role IN ('user', 'admin', 'super_admin')),
  tc_accepted_at    TIMESTAMPTZ,
  stripe_customer_id TEXT       UNIQUE,
  subscription_tier TEXT        NOT NULL DEFAULT 'free'
                                CHECK (subscription_tier IN ('free', 'starter', 'pro', 'agency')),
  org_id            UUID,       -- Future: multi-tenant organization
  onboarding_done   BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata          JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email       ON public.profiles (email);
CREATE INDEX idx_profiles_phone       ON public.profiles (phone)    WHERE phone IS NOT NULL;
CREATE INDEX idx_profiles_role        ON public.profiles (role)     WHERE role != 'user';
CREATE INDEX idx_profiles_stripe      ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_profiles_org         ON public.profiles (org_id)   WHERE org_id IS NOT NULL;
CREATE INDEX idx_profiles_tier        ON public.profiles (subscription_tier);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.profiles IS 'Extends auth.users with application-specific profile data.';
COMMENT ON COLUMN public.profiles.role IS 'user | admin | super_admin';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'free | starter | pro | agency';
COMMENT ON COLUMN public.profiles.org_id IS 'Future: multi-tenant org FK. Not used at launch.';
