-- =============================================================================
-- Add wizard_state and agent_session_id columns to brands table
-- These are required by the wizard controller for step-by-step data persistence
-- =============================================================================

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS wizard_state JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agent_session_id TEXT;

COMMENT ON COLUMN public.brands.wizard_state IS 'JSONB object storing per-step wizard data. Keys are step names.';
COMMENT ON COLUMN public.brands.agent_session_id IS 'Active Anthropic Agent SDK session ID for wizard resume.';
