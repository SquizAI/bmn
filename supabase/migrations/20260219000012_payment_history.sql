-- =============================================================================
-- 12_payment_history.sql
-- =============================================================================

CREATE TABLE public.payment_history (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_id   TEXT          UNIQUE NOT NULL,
  stripe_invoice_id   TEXT,
  subscription_id     UUID          REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency            TEXT          NOT NULL DEFAULT 'usd' CHECK (char_length(currency) = 3),
  status              TEXT          NOT NULL
                                    CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded', 'disputed')),
  description         TEXT          DEFAULT '',
  payment_method_type TEXT,
  -- e.g. 'card', 'bank_transfer'
  receipt_url         TEXT,
  metadata            JSONB         DEFAULT '{}',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_history_user   ON public.payment_history (user_id);
CREATE INDEX idx_payment_history_stripe ON public.payment_history (stripe_payment_id);
CREATE INDEX idx_payment_history_sub    ON public.payment_history (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_payment_history_status ON public.payment_history (status);
CREATE INDEX idx_payment_history_date   ON public.payment_history (created_at DESC);

COMMENT ON TABLE public.payment_history IS 'Stripe payment and invoice records for billing history display.';
