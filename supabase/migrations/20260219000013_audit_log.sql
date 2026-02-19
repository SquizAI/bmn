-- =============================================================================
-- 13_audit_log.sql
-- =============================================================================

CREATE TABLE public.audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- NULL for system-initiated events
  action            TEXT        NOT NULL,
  -- Structured action name: 'brand.created', 'logo.generated', 'user.login', 'admin.flag_content'
  resource_type     TEXT,
  -- Table name: 'brand', 'brand_asset', 'product', 'subscription', etc.
  resource_id       UUID,
  -- PK of the affected row
  old_data          JSONB,
  -- Previous state (for updates)
  new_data          JSONB,
  -- New state (for creates/updates)
  metadata          JSONB       DEFAULT '{}',
  -- Extra context: ip, user_agent, cost_usd, model_used, duration_ms, etc.
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user        ON public.audit_log (user_id)       WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action      ON public.audit_log (action);
CREATE INDEX idx_audit_log_resource    ON public.audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_created     ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_metadata    ON public.audit_log USING GIN (metadata jsonb_path_ops);

-- Future: Partition by month for performance when table exceeds 1M rows
-- CREATE TABLE public.audit_log (...) PARTITION BY RANGE (created_at);

COMMENT ON TABLE  public.audit_log IS 'Immutable append-only log of all system events. 1-year retention policy.';
COMMENT ON COLUMN public.audit_log.action IS 'Structured action: resource.verb (e.g. brand.created, logo.generated, user.login).';
COMMENT ON COLUMN public.audit_log.old_data IS 'Previous row state for UPDATE operations. NULL for INSERT/DELETE.';
