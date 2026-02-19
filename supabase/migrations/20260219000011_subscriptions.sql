-- =============================================================================
-- 11_subscriptions.sql
-- =============================================================================

CREATE TABLE public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT        UNIQUE NOT NULL,
  stripe_price_id         TEXT        NOT NULL,
  tier                    TEXT        NOT NULL
                                      CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing', 'paused', 'incomplete')),
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  trial_start             TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  metadata                JSONB       DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user    ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe  ON public.subscriptions (stripe_subscription_id);
CREATE INDEX idx_subscriptions_status  ON public.subscriptions (status) WHERE status = 'active';
CREATE INDEX idx_subscriptions_period  ON public.subscriptions (current_period_end);

-- Trigger: auto-update updated_at
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records. One active subscription per user.';
