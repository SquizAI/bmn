-- Add step_url to brands table for storing resume link to current wizard step.
-- Run this in Supabase SQL Editor or via your migration tool.
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS step_url text;

COMMENT ON COLUMN brands.step_url IS 'Full URL to resume brand builder at the last wizard step (e.g. base/?resume=TOKEN#step=N)';
