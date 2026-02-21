-- =============================================================================
-- 20260221000010_missing_tables.sql — Create 12 tables referenced in server
-- code but missing from existing migrations.
--
-- Tables:
--   1.  chat_sessions
--   2.  webhook_configs
--   3.  webhook_deliveries
--   4.  orders
--   5.  order_items
--   6.  generated_content
--   7.  brand_health_scores
--   8.  email_campaign_log
--   9.  email_preferences
--   10. brand_recommendations
--   11. api_keys
--   12. custom_product_requests
--
-- NOTE: credit_transactions and chat_messages already exist — NOT recreated.
-- =============================================================================


-- ─────────────────────────────────────────────
-- 1. chat_sessions
-- Referenced in: server/src/sockets/index.js, server/src/controllers/chat.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id         UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  title            TEXT,
  message_count    INTEGER     NOT NULL DEFAULT 0,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON public.chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_brand
  ON public.chat_sessions (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated
  ON public.chat_sessions (updated_at DESC);

CREATE TRIGGER set_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.chat_sessions IS 'Groups chat_messages into conversation sessions. One session = one chat sidebar thread.';
COMMENT ON COLUMN public.chat_sessions.title IS 'User-editable session title (rename via PATCH).';
COMMENT ON COLUMN public.chat_sessions.message_count IS 'Running message count, updated on each new message via upsert.';
COMMENT ON COLUMN public.chat_sessions.last_message_at IS 'Timestamp of the most recent message in this session.';


-- ─────────────────────────────────────────────
-- 2. webhook_configs
-- Referenced in: server/src/routes/api/v1/webhooks-user.js,
--                server/src/services/webhook-dispatcher.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  events      JSONB       NOT NULL DEFAULT '[]',
  secret      TEXT        NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_user
  ON public.webhook_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active
  ON public.webhook_configs (user_id, active) WHERE active = TRUE;

CREATE TRIGGER set_webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.webhook_configs IS 'User-defined webhook endpoint configurations. Each config has a URL, subscribed events, and HMAC secret.';
COMMENT ON COLUMN public.webhook_configs.events IS 'JSON array of subscribed event types, e.g. ["brand.created", "logo.generated"].';
COMMENT ON COLUMN public.webhook_configs.secret IS 'HMAC-SHA256 signing secret for payload verification. Auto-generated or user-provided.';


-- ─────────────────────────────────────────────
-- 3. webhook_deliveries
-- Referenced in: server/src/services/webhook-dispatcher.js,
--                server/src/routes/api/v1/webhooks-user.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID        NOT NULL REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event             TEXT        NOT NULL,
  payload           JSONB       NOT NULL DEFAULT '{}',
  status_code       INTEGER     NOT NULL DEFAULT 0,
  response_body     TEXT,
  success           BOOLEAN     NOT NULL DEFAULT FALSE,
  attempt           INTEGER     NOT NULL DEFAULT 1,
  error_message     TEXT,
  delivered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config
  ON public.webhook_deliveries (webhook_config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered
  ON public.webhook_deliveries (delivered_at DESC);

COMMENT ON TABLE  public.webhook_deliveries IS 'Immutable log of every webhook delivery attempt. Tracks status codes, retry attempts, and errors.';
COMMENT ON COLUMN public.webhook_deliveries.attempt IS '1-based retry attempt number. Max 3 attempts with exponential backoff.';
COMMENT ON COLUMN public.webhook_deliveries.status_code IS 'HTTP response status code. 0 indicates a network/timeout error.';


-- ─────────────────────────────────────────────
-- 4. orders
-- Referenced in: server/src/routes/api/v1/public-api.js,
--                server/src/routes/api/v1/analytics/customers.js,
--                server/src/routes/api/v1/analytics/sales.js,
--                server/src/routes/api/v1/dashboard/overview.js,
--                server/src/workers/analytics-worker.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_email    TEXT,
  customer_location TEXT,
  referral_source   TEXT,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
  metadata          JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_brand
  ON public.orders (brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_brand_created
  ON public.orders (brand_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON public.orders (customer_email) WHERE customer_email IS NOT NULL;

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.orders IS 'Customer orders placed for branded products. Scoped to a brand.';
COMMENT ON COLUMN public.orders.total_amount IS 'Total order value in USD.';
COMMENT ON COLUMN public.orders.customer_location IS 'Free-text customer location for geographic analytics.';
COMMENT ON COLUMN public.orders.referral_source IS 'Traffic source attribution, e.g. "instagram", "direct", "tiktok".';


-- ─────────────────────────────────────────────
-- 5. order_items
-- Referenced in: server/src/routes/api/v1/dashboard/restock-alerts.js,
--                server/src/routes/api/v1/dashboard/products.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  product_sku  TEXT,
  product_name TEXT,
  quantity     INTEGER     NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON public.order_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_sku
  ON public.order_items (product_sku) WHERE product_sku IS NOT NULL;

COMMENT ON TABLE  public.order_items IS 'Line items within an order. References products table for catalog linkage.';
COMMENT ON COLUMN public.order_items.product_sku IS 'Denormalized SKU for analytics queries without joining products.';
COMMENT ON COLUMN public.order_items.product_name IS 'Denormalized product name for analytics queries without joining products.';


-- ─────────────────────────────────────────────
-- 6. generated_content
-- Referenced in: server/src/workers/content-gen-worker.js,
--                server/src/routes/api/v1/dashboard/content.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.generated_content (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      TEXT        NOT NULL DEFAULT 'instagram',
  content_type  TEXT        NOT NULL DEFAULT 'post',
  caption       TEXT,
  content       TEXT,
  hashtags      JSONB       DEFAULT '[]',
  image_prompt  TEXT,
  tone          TEXT,
  topic         TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_content_brand
  ON public.generated_content (brand_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_user
  ON public.generated_content (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_created
  ON public.generated_content (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_content_type
  ON public.generated_content (brand_id, content_type);

COMMENT ON TABLE  public.generated_content IS 'AI-generated social media content (captions, hashtags, image prompts) for brand marketing.';
COMMENT ON COLUMN public.generated_content.platform IS 'Target social platform: instagram, tiktok, twitter, general.';
COMMENT ON COLUMN public.generated_content.content_type IS 'Content format: post, story, reel_script, announcement, promotional.';
COMMENT ON COLUMN public.generated_content.caption IS 'Generated caption text.';
COMMENT ON COLUMN public.generated_content.hashtags IS 'JSON array of recommended hashtags.';
COMMENT ON COLUMN public.generated_content.image_prompt IS 'AI image generation prompt for a matching visual.';


-- ─────────────────────────────────────────────
-- 7. brand_health_scores
-- Referenced in: server/src/workers/analytics-worker.js,
--                server/src/routes/api/v1/dashboard/health-score.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_health_scores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall       INTEGER     NOT NULL DEFAULT 0,
  overall_score INTEGER     NOT NULL DEFAULT 0,
  breakdown     JSONB       NOT NULL DEFAULT '{}',
  tips          JSONB       NOT NULL DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep overall and overall_score in sync via trigger.
-- The analytics worker writes "overall"; the health-score route reads "overall_score".
CREATE OR REPLACE FUNCTION public.sync_health_score_overall()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: sync whichever column was provided
  IF TG_OP = 'INSERT' THEN
    IF NEW.overall <> 0 AND NEW.overall_score = 0 THEN
      NEW.overall_score := NEW.overall;
    ELSIF NEW.overall_score <> 0 AND NEW.overall = 0 THEN
      NEW.overall := NEW.overall_score;
    END IF;
  -- On UPDATE: propagate whichever column changed
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.overall IS DISTINCT FROM OLD.overall THEN
      NEW.overall_score := NEW.overall;
    ELSIF NEW.overall_score IS DISTINCT FROM OLD.overall_score THEN
      NEW.overall := NEW.overall_score;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_health_score_columns
  BEFORE INSERT OR UPDATE ON public.brand_health_scores
  FOR EACH ROW EXECUTE FUNCTION public.sync_health_score_overall();

-- Unique constraint on brand_id for upsert (onConflict: 'brand_id')
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_health_scores_brand_unique
  ON public.brand_health_scores (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_health_scores_user
  ON public.brand_health_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_health_scores_calculated
  ON public.brand_health_scores (calculated_at DESC);

COMMENT ON TABLE  public.brand_health_scores IS 'Cached Brand Health Score calculated weekly by the analytics worker. One row per brand (upserted).';
COMMENT ON COLUMN public.brand_health_scores.overall IS 'Weighted composite score 0-100 across 6 dimensions.';
COMMENT ON COLUMN public.brand_health_scores.overall_score IS 'Alias for overall (used by health-score route reading score.overall_score).';
COMMENT ON COLUMN public.brand_health_scores.breakdown IS 'JSON object with per-dimension scores: salesVelocity, customerSatisfaction, socialMentions, repeatPurchaseRate, catalogBreadth, revenueGrowth.';
COMMENT ON COLUMN public.brand_health_scores.tips IS 'JSON array of actionable improvement tips with category, message, and priority.';


-- ─────────────────────────────────────────────
-- 8. email_campaign_log
-- Referenced in: server/src/workers/email-campaign-worker.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_campaign_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step        INTEGER     NOT NULL DEFAULT 0,
  template    TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_log_user
  ON public.email_campaign_log (user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_log_campaign
  ON public.email_campaign_log (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_log_sent
  ON public.email_campaign_log (sent_at DESC);

COMMENT ON TABLE  public.email_campaign_log IS 'Immutable log of email campaign steps sent to users. Tracks campaign sequences (welcome, re-engagement, promotional).';
COMMENT ON COLUMN public.email_campaign_log.campaign_id IS 'Unique campaign run identifier. Groups sequential steps of one campaign.';
COMMENT ON COLUMN public.email_campaign_log.step IS '0-based step index within the campaign sequence.';
COMMENT ON COLUMN public.email_campaign_log.template IS 'Email template name used for this step (e.g. welcome, getting-started).';


-- ─────────────────────────────────────────────
-- 9. email_preferences
-- Referenced in: server/src/workers/email-campaign-worker.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_preferences (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL DEFAULT 'marketing',
  unsubscribed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one preference row per user per category
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_preferences_user_category
  ON public.email_preferences (user_id, category);

CREATE TRIGGER set_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.email_preferences IS 'Per-user email opt-in/opt-out preferences by category (marketing, transactional, etc.).';
COMMENT ON COLUMN public.email_preferences.category IS 'Email category: marketing, transactional, product-updates.';
COMMENT ON COLUMN public.email_preferences.unsubscribed IS 'TRUE if the user has unsubscribed from this category.';


-- ─────────────────────────────────────────────
-- 10. brand_recommendations
-- Referenced in: server/src/routes/api/v1/products/recommendations.js,
--                server/src/skills/product-recommender/tools/synthesize-recommendations.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_recommendations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendations JSONB       NOT NULL DEFAULT '[]',
  bundles         JSONB       NOT NULL DEFAULT '[]',
  summary         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on brand_id for upsert (onConflict: 'brand_id')
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_recommendations_brand_unique
  ON public.brand_recommendations (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_recommendations_user
  ON public.brand_recommendations (user_id);

CREATE TRIGGER set_brand_recommendations_updated_at
  BEFORE UPDATE ON public.brand_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.brand_recommendations IS 'AI-generated product recommendations per brand. Upserted by the product-recommender skill.';
COMMENT ON COLUMN public.brand_recommendations.recommendations IS 'JSON array of ranked product recommendations with scores, revenue estimates, and reasoning.';
COMMENT ON COLUMN public.brand_recommendations.bundles IS 'JSON array of suggested product bundles with pricing.';
COMMENT ON COLUMN public.brand_recommendations.summary IS 'JSON summary object: totalRecommended, topCategory, estimatedMonthlyRevenue, creatorNiche, audienceSize.';


-- ─────────────────────────────────────────────
-- 11. api_keys
-- Referenced in: server/src/routes/api/v1/api-keys.js,
--                server/src/middleware/api-key-auth.js
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_prefix   TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL,
  scopes       JSONB       NOT NULL DEFAULT '[]',
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user
  ON public.api_keys (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash_unique
  ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active
  ON public.api_keys (user_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE  public.api_keys IS 'API keys for programmatic access (Agency tier). Only the SHA-256 hash is stored; the plain key is returned once on creation.';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 12 characters of the key (e.g. bmn_live_XXXX) for display purposes.';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hex hash of the full API key. Used for lookup on authentication.';
COMMENT ON COLUMN public.api_keys.scopes IS 'JSON array of granted scopes, e.g. ["brands:read", "brands:write", "mockups:generate"].';
COMMENT ON COLUMN public.api_keys.revoked_at IS 'Soft-delete timestamp. Non-null means the key is revoked.';


-- ─────────────────────────────────────────────
-- 12. custom_product_requests
-- Referenced in: server/src/controllers/wizard.js (submitCustomProductRequest)
-- Currently stored in wizard_state JSONB; this table provides a relational
-- record for tracking, admin review, and analytics.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_product_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT        NOT NULL,
  category    TEXT,
  price_range TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_product_requests_brand
  ON public.custom_product_requests (brand_id);
CREATE INDEX IF NOT EXISTS idx_custom_product_requests_user
  ON public.custom_product_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_custom_product_requests_status
  ON public.custom_product_requests (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_custom_product_requests_created
  ON public.custom_product_requests (created_at DESC);

CREATE TRIGGER set_custom_product_requests_updated_at
  BEFORE UPDATE ON public.custom_product_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE  public.custom_product_requests IS 'Custom product requests submitted during the wizard. Allows admin review and fulfillment tracking.';
COMMENT ON COLUMN public.custom_product_requests.description IS 'User-provided description of the custom product they want.';
COMMENT ON COLUMN public.custom_product_requests.category IS 'Product category hint (apparel, accessories, etc.).';
COMMENT ON COLUMN public.custom_product_requests.price_range IS 'User-indicated price range preference.';

-- =============================================================================
-- 13. webhook_events — Stripe webhook idempotency guard
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          TEXT PRIMARY KEY,                            -- Stripe event ID (evt_xxx)
  event_type  TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_type ON public.webhook_events (event_type);

COMMENT ON TABLE  public.webhook_events IS 'Stripe webhook idempotency guard — prevents duplicate event processing.';
COMMENT ON COLUMN public.webhook_events.id IS 'Stripe event ID used as natural primary key.';
COMMENT ON COLUMN public.webhook_events.event_type IS 'Stripe event type (e.g. invoice.paid, customer.subscription.updated).';
