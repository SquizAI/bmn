-- =============================================================================
-- 20260221000001_fix_handle_new_user_fk_order.sql
-- =============================================================================
-- Fix: handle_new_user() was inserting into organizations BEFORE profiles,
-- but organizations.owner_id references profiles(id). This caused a FK
-- violation on every new signup (both email/password and Google OAuth).
--
-- Solution: Create profile first (without org_id), then create org, then
-- update profile with org_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  -- Step 1: Create profile FIRST (without org_id) so the FK target exists
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );

  -- Step 2: Create personal organization (owner_id FK to profiles now satisfied)
  INSERT INTO public.organizations (name, slug, owner_id, subscription_tier)
  VALUES (
    v_name || '''s Workspace',
    'personal-' || NEW.id::text,
    NEW.id,
    'free'
  )
  RETURNING id INTO v_org_id;

  -- Step 3: Link profile to organization
  UPDATE public.profiles SET org_id = v_org_id WHERE id = NEW.id;

  -- Step 4: Add owner membership
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
