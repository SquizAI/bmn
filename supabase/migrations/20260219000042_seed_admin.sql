-- =============================================================================
-- 42_seed_admin.sql — Initial admin user setup
-- =============================================================================

-- IMPORTANT: The admin user must first be created through Supabase Auth.
-- The handle_new_user trigger will auto-create the profiles row.
--
-- Step 1: Create user via Supabase CLI:
--   supabase auth admin create-user --email admin@brandmenow.com --password <secure-password>
--
-- Step 2: Run this SQL to promote to super_admin:

UPDATE public.profiles
SET
  role = 'super_admin',
  full_name = 'BMN Admin',
  subscription_tier = 'agency',
  onboarding_done = TRUE
WHERE email = 'admin@brandmenow.com';

-- Step 3: Seed admin credits (effectively unlimited)
INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end)
SELECT
  p.id,
  ct.credit_type,
  99999,
  NOW(),
  NOW() + INTERVAL '10 years'
FROM public.profiles p
CROSS JOIN (VALUES ('logo'), ('mockup'), ('video'), ('bundle'), ('analysis')) AS ct(credit_type)
WHERE p.email = 'admin@brandmenow.com';
