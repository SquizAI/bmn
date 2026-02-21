-- =============================================================================
-- 20260221000013_chat_messages_add_columns.sql
--
-- Adds message_type column to chat_messages. The socket handler writes this
-- field on every INSERT but the original schema omitted it.
--
-- page_context is stored inside the existing metadata JSONB column instead of
-- a dedicated column, so no additional column is needed for that.
-- =============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'
    CHECK (message_type IN ('text', 'tool_use', 'tool_result', 'system', 'error'));

COMMENT ON COLUMN public.chat_messages.message_type
  IS 'Message type: text (default), tool_use, tool_result, system, or error.';
