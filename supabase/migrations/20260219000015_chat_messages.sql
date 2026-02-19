-- =============================================================================
-- 15_chat_messages.sql
-- =============================================================================

CREATE TABLE public.chat_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id          UUID        REFERENCES public.brands(id) ON DELETE SET NULL,
  -- Optional: context-aware chat scoped to a brand
  session_id        TEXT        NOT NULL,
  -- Groups messages into a conversation session
  role              TEXT        NOT NULL
                                CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT        NOT NULL,
  model_used        TEXT,
  -- e.g. 'claude-haiku-4-5', 'gemini-3.0-flash'
  tokens_used       INTEGER     DEFAULT 0,
  cost_usd          NUMERIC(8,6) DEFAULT 0.000000,
  metadata          JSONB       DEFAULT '{}',
  -- Extra data: tool calls, citations, suggested actions
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_user     ON public.chat_messages (user_id);
CREATE INDEX idx_chat_messages_session  ON public.chat_messages (session_id, created_at);
CREATE INDEX idx_chat_messages_brand    ON public.chat_messages (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_chat_messages_created  ON public.chat_messages (created_at DESC);

COMMENT ON TABLE  public.chat_messages IS 'AI chatbot conversation history. One session = one conversation thread.';
COMMENT ON COLUMN public.chat_messages.session_id IS 'Groups messages into a conversation. New session per chat window open.';
