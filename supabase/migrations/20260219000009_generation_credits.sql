-- =============================================================================
-- 09_generation_credits.sql
-- =============================================================================

CREATE TABLE public.generation_credits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type       TEXT        NOT NULL
                                CHECK (credit_type IN ('logo', 'mockup', 'video', 'bundle', 'analysis')),
  credits_remaining INTEGER     NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_used      INTEGER     NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  period_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  last_refill_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_credit_type_period UNIQUE (user_id, credit_type, period_start)
);

-- Indexes
CREATE INDEX idx_gen_credits_user      ON public.generation_credits (user_id);
CREATE INDEX idx_gen_credits_active    ON public.generation_credits (user_id, credit_type)
             WHERE credits_remaining > 0;
CREATE INDEX idx_gen_credits_period    ON public.generation_credits (period_end);

COMMENT ON TABLE  public.generation_credits IS 'Per-user credit tracking. Separate rows per credit type per billing period.';
COMMENT ON COLUMN public.generation_credits.period_end IS 'Credits expire at period end. Unused credits do not roll over.';
