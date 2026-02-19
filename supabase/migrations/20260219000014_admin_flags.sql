-- =============================================================================
-- 14_admin_flags.sql
-- =============================================================================

CREATE TABLE public.admin_flags (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Admin user who flagged the content
  resource_type     TEXT        NOT NULL
                                CHECK (resource_type IN ('brand_asset', 'brand', 'chat_message')),
  resource_id       UUID        NOT NULL,
  reason            TEXT        NOT NULL
                                CHECK (reason IN ('nsfw', 'copyright', 'quality', 'spam', 'other')),
  severity          TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes             TEXT        DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  resolved_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_flags_status    ON public.admin_flags (status) WHERE status IN ('open', 'reviewed');
CREATE INDEX idx_admin_flags_resource  ON public.admin_flags (resource_type, resource_id);
CREATE INDEX idx_admin_flags_flagged   ON public.admin_flags (flagged_by);
CREATE INDEX idx_admin_flags_severity  ON public.admin_flags (severity, status);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_admin_flags_updated_at
  BEFORE UPDATE ON public.admin_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.admin_flags IS 'Content moderation flags on AI-generated assets. Admins review flagged content.';
