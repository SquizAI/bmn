-- =============================================================================
-- 16_ghl_sync_log.sql
-- =============================================================================

CREATE TABLE public.ghl_sync_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ghl_contact_id    TEXT,
  -- GoHighLevel contact ID
  direction         TEXT        NOT NULL
                                CHECK (direction IN ('outbound', 'inbound')),
  -- outbound = BMN -> GHL, inbound = GHL -> BMN (webhook)
  event_type        TEXT        NOT NULL,
  -- e.g. 'contact.created', 'contact.updated', 'brand.completed', 'tag.added'
  payload           JSONB       NOT NULL DEFAULT '{}',
  -- Full request/response payload for debugging
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  error             TEXT,
  error_code        TEXT,
  retry_count       SMALLINT    NOT NULL DEFAULT 0,
  next_retry_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ghl_sync_user         ON public.ghl_sync_log (user_id)    WHERE user_id IS NOT NULL;
CREATE INDEX idx_ghl_sync_contact      ON public.ghl_sync_log (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;
CREATE INDEX idx_ghl_sync_status       ON public.ghl_sync_log (status)     WHERE status IN ('pending', 'failed', 'retrying');
CREATE INDEX idx_ghl_sync_event        ON public.ghl_sync_log (event_type);
CREATE INDEX idx_ghl_sync_created      ON public.ghl_sync_log (created_at DESC);
CREATE INDEX idx_ghl_sync_retry        ON public.ghl_sync_log (next_retry_at)
             WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE  public.ghl_sync_log IS 'GoHighLevel CRM sync event log. Tracks every sync attempt with full payload.';
COMMENT ON COLUMN public.ghl_sync_log.direction IS 'outbound = BMN to GHL, inbound = GHL webhook to BMN.';
COMMENT ON COLUMN public.ghl_sync_log.payload IS 'Full request/response for debugging failed syncs.';
