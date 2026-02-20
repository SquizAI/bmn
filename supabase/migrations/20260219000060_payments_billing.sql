-- =============================================================================
-- 60_payments_billing.sql — Payments & Billing System Tables
-- Phase 4a: Stripe webhooks idempotency + credit transaction audit log
-- =============================================================================

-- ─── webhook_events (idempotency guard for Stripe webhooks) ─────────────────
-- Stores processed Stripe event IDs. Checked before processing to prevent
-- duplicate handling when Stripe retries webhook delivery (up to 3 days).

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id              TEXT        PRIMARY KEY,   -- Stripe event ID (evt_xxx)
  event_type      TEXT        NOT NULL,      -- e.g. 'checkout.session.completed'
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB       DEFAULT '{}'
);

-- Index for cleanup of old webhook events (retention: 30 days)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON public.webhook_events (processed_at);

COMMENT ON TABLE public.webhook_events IS 'Idempotency table for Stripe webhook events. Prevents duplicate processing on retries.';


-- ─── credit_transactions (immutable audit log of every credit change) ───────
-- Records every credit allocation, deduction, refund, and refill.
-- Immutable: no updates or deletes allowed via RLS.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type         TEXT        NOT NULL
                                  CHECK (credit_type IN ('logo', 'mockup', 'video', 'bundle', 'analysis')),
  amount              INTEGER     NOT NULL,   -- Positive for credit, negative for debit
  direction           TEXT        NOT NULL
                                  CHECK (direction IN ('debit', 'credit', 'refund', 'refill', 'allocate', 'overage')),
  reason              TEXT,                    -- Human-readable reason
  brand_id            UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  generation_job_id   UUID,                    -- FK to generation_jobs if applicable
  stripe_invoice_id   TEXT,                    -- Stripe invoice that triggered refill
  balance_after       INTEGER,                 -- Credits remaining after this transaction
  metadata            JSONB       DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_tx_user
  ON public.credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_type
  ON public.credit_transactions (user_id, credit_type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created
  ON public.credit_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_brand
  ON public.credit_transactions (brand_id)
  WHERE brand_id IS NOT NULL;

COMMENT ON TABLE  public.credit_transactions IS 'Immutable audit log of all credit changes (allocations, deductions, refunds, refills).';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Positive for credits added, negative for credits consumed.';
COMMENT ON COLUMN public.credit_transactions.direction IS 'debit = consumed, credit = manually added, refund = failed job, refill = monthly renewal, allocate = initial setup, overage = exceeded limit.';


-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- webhook_events: No RLS needed -- only accessed by service_role (server).
-- We enable RLS but create no user-facing policies. Admin-only via service_role.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- credit_transactions: Users can read their own, server writes via service_role.
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_tx_select_own"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Inserts handled by service_role (bypasses RLS). Admin can also insert.
CREATE POLICY "credit_tx_insert_admin"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (public.is_admin());

-- credit_transactions are immutable: no update or delete policies.


-- ─── Refund Credit Function ─────────────────────────────────────────────────
-- Atomically refunds credits back to a user (e.g., after failed generation).

CREATE OR REPLACE FUNCTION public.refund_credit(
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit_id UUID;
  v_remaining INTEGER;
  v_new_remaining INTEGER;
BEGIN
  -- Lock the active credit row for this user + type
  SELECT id, credits_remaining
  INTO v_credit_id, v_remaining
  FROM public.generation_credits
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
    AND period_end > NOW()
  ORDER BY period_end ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active credit record found'
    );
  END IF;

  v_new_remaining := v_remaining + p_amount;

  -- Add credits back
  UPDATE public.generation_credits
  SET
    credits_remaining = v_new_remaining,
    credits_used = GREATEST(0, credits_used - p_amount)
  WHERE id = v_credit_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_remaining
  );
END;
$$;

COMMENT ON FUNCTION public.refund_credit IS 'Atomically refund generation credits after a failed job. Returns new balance.';


-- ─── Cleanup old webhook events (called by cleanup job) ─────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_webhook_events(
  p_older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.webhook_events
  WHERE processed_at < NOW() - (p_older_than_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_webhook_events IS 'Remove processed webhook events older than N days. Called by periodic cleanup job.';
