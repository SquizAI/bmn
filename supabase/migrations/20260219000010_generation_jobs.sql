-- =============================================================================
-- 10_generation_jobs.sql
-- =============================================================================

CREATE TABLE public.generation_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_type          TEXT        NOT NULL
                                CHECK (job_type IN ('logo', 'mockup', 'bundle', 'analysis', 'video', 'social_asset', 'label')),
  status            TEXT        NOT NULL DEFAULT 'queued'
                                CHECK (status IN ('queued', 'processing', 'complete', 'failed', 'cancelled')),
  progress          SMALLINT    NOT NULL DEFAULT 0
                                CHECK (progress >= 0 AND progress <= 100),
  result            JSONB       DEFAULT '{}',
  -- Structured result data (asset URLs, metadata, model output)
  error             TEXT,
  error_code        TEXT,
  retry_count       SMALLINT    NOT NULL DEFAULT 0,
  max_retries       SMALLINT    NOT NULL DEFAULT 3,
  bullmq_job_id     TEXT,
  -- BullMQ reference for job control (cancel, retry, inspect)
  model_used        TEXT,
  -- Which AI model actually executed (for cost tracking)
  cost_usd          NUMERIC(8,4) DEFAULT 0.0000,
  -- Actual cost of this generation (from model billing)
  duration_ms       INTEGER,
  -- Wall-clock execution time
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_gen_jobs_brand        ON public.generation_jobs (brand_id)    WHERE brand_id IS NOT NULL;
CREATE INDEX idx_gen_jobs_user         ON public.generation_jobs (user_id);
CREATE INDEX idx_gen_jobs_status       ON public.generation_jobs (status)      WHERE status IN ('queued', 'processing');
CREATE INDEX idx_gen_jobs_user_type    ON public.generation_jobs (user_id, job_type);
CREATE INDEX idx_gen_jobs_bullmq       ON public.generation_jobs (bullmq_job_id) WHERE bullmq_job_id IS NOT NULL;
CREATE INDEX idx_gen_jobs_created      ON public.generation_jobs (created_at DESC);
CREATE INDEX idx_gen_jobs_result       ON public.generation_jobs USING GIN (result jsonb_path_ops);

COMMENT ON TABLE  public.generation_jobs IS 'Tracks all async AI generation jobs. Linked to BullMQ for queue management.';
COMMENT ON COLUMN public.generation_jobs.bullmq_job_id IS 'Reference to the BullMQ job for cancel/retry/inspect operations.';
COMMENT ON COLUMN public.generation_jobs.cost_usd IS 'Actual cost of this generation from model provider billing.';
