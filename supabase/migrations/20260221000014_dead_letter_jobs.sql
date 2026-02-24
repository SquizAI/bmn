-- =============================================================================
-- 20260221000014_dead_letter_jobs.sql
--
-- Dead-letter queue table. Stores permanently failed BullMQ jobs for admin
-- inspection, retry, and resolution. Written by the dead-letter worker
-- (server/src/workers/dead-letter.js) via supabaseAdmin (service_role).
-- =============================================================================

CREATE TABLE public.dead_letter_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue    TEXT        NOT NULL,
  original_job_id   TEXT        NOT NULL,
  original_job_name TEXT,
  original_data     JSONB       NOT NULL DEFAULT '{}',
  error_message     TEXT        NOT NULL,
  error_stack       TEXT,
  attempts_made     INTEGER     NOT NULL DEFAULT 0,
  max_attempts      INTEGER     NOT NULL DEFAULT 0,
  first_attempt_at  TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_id          UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                                CHECK (status IN ('pending_review', 'acknowledged', 'retried', 'resolved')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_dead_letter_status
  ON public.dead_letter_jobs (status);

CREATE INDEX idx_dead_letter_queue
  ON public.dead_letter_jobs (original_queue);

CREATE INDEX idx_dead_letter_user
  ON public.dead_letter_jobs (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_dead_letter_failed_at
  ON public.dead_letter_jobs (failed_at DESC);

-- ── Trigger: auto-update updated_at ─────────────────────────────────────────

CREATE TRIGGER set_dead_letter_jobs_updated_at
  BEFORE UPDATE ON public.dead_letter_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS: admin-only access ──────────────────────────────────────────────────
-- The dead-letter worker writes via supabaseAdmin (service_role) which bypasses
-- RLS. These policies govern access through the Supabase client (anon/user JWTs).

ALTER TABLE public.dead_letter_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dead_letter_jobs_select_admin"
  ON public.dead_letter_jobs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "dead_letter_jobs_insert_admin"
  ON public.dead_letter_jobs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "dead_letter_jobs_update_admin"
  ON public.dead_letter_jobs FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "dead_letter_jobs_delete_admin"
  ON public.dead_letter_jobs FOR DELETE
  USING (public.is_admin());

-- ── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.dead_letter_jobs IS 'Permanently failed BullMQ jobs for admin inspection and retry. Written by the dead-letter worker.';
COMMENT ON COLUMN public.dead_letter_jobs.original_queue IS 'BullMQ queue name the job originally ran on (e.g. logo-generation, mockup-generation).';
COMMENT ON COLUMN public.dead_letter_jobs.original_job_id IS 'BullMQ job ID from the original queue.';
COMMENT ON COLUMN public.dead_letter_jobs.original_data IS 'Full job payload (data) from the original BullMQ job.';
COMMENT ON COLUMN public.dead_letter_jobs.status IS 'Workflow status: pending_review -> acknowledged -> retried/resolved.';
