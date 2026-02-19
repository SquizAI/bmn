-- =============================================================================
-- 30_functions.sql — Business logic functions
-- =============================================================================

-- Validate wizard step transitions.
-- Prevents skipping steps. Allows same-step re-saves and forward-by-one movement.
-- Allows reset to 'onboarding' from any step.
CREATE OR REPLACE FUNCTION public.validate_wizard_step()
RETURNS TRIGGER AS $$
DECLARE
  step_order TEXT[] := ARRAY[
    'onboarding', 'social', 'identity', 'colors', 'fonts',
    'logos', 'products', 'mockups', 'bundles', 'projections',
    'checkout', 'complete'
  ];
  old_idx INT;
  new_idx INT;
BEGIN
  -- Allow reset to onboarding from any step
  IF NEW.wizard_step = 'onboarding' THEN
    RETURN NEW;
  END IF;

  -- Find position indexes
  old_idx := array_position(step_order, OLD.wizard_step);
  new_idx := array_position(step_order, NEW.wizard_step);

  -- Reject unknown step names
  IF new_idx IS NULL THEN
    RAISE EXCEPTION 'Invalid wizard step: "%". Valid steps: %', NEW.wizard_step, step_order;
  END IF;

  -- Allow forward movement by at most 1 step, or same step (re-save)
  IF old_idx IS NOT NULL AND new_idx > old_idx + 1 THEN
    RAISE EXCEPTION 'Cannot skip wizard steps. Current: %, Requested: %. Must advance one step at a time.', OLD.wizard_step, NEW.wizard_step;
  END IF;

  -- If moving to 'complete', auto-set completed_at and status
  IF NEW.wizard_step = 'complete' AND OLD.wizard_step != 'complete' THEN
    NEW.completed_at = NOW();
    NEW.status = 'complete';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER validate_brand_wizard_step
  BEFORE UPDATE OF wizard_step ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wizard_step();


-- =============================================================================
-- Atomically deduct credits. Returns TRUE if deduction succeeded, FALSE if insufficient.
-- Uses SELECT ... FOR UPDATE to prevent race conditions between concurrent requests.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_credit_id UUID;
  v_remaining INTEGER;
BEGIN
  -- Lock the active credit row for this user + type within the current period
  SELECT id, credits_remaining
  INTO v_credit_id, v_remaining
  FROM public.generation_credits
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
    AND credits_remaining >= p_amount
    AND period_end > NOW()
  ORDER BY period_end ASC
  LIMIT 1
  FOR UPDATE;

  -- No eligible credit row found
  IF v_credit_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Deduct
  UPDATE public.generation_credits
  SET
    credits_remaining = credits_remaining - p_amount,
    credits_used = credits_used + p_amount
  WHERE id = v_credit_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.deduct_credit IS 'Atomically deduct generation credits. Returns FALSE if insufficient credits. Uses row locking to prevent race conditions.';


-- =============================================================================
-- Refill credits for a user based on their subscription tier.
-- Called by the Stripe webhook handler when a subscription period renews.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refill_credits(
  p_user_id UUID,
  p_tier TEXT
)
RETURNS VOID AS $$
DECLARE
  v_logo_credits INTEGER;
  v_mockup_credits INTEGER;
  v_period_start TIMESTAMPTZ := NOW();
  v_period_end TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  -- Determine credit amounts by tier
  CASE p_tier
    WHEN 'free' THEN
      v_logo_credits := 4;
      v_mockup_credits := 4;
    WHEN 'starter' THEN
      v_logo_credits := 20;
      v_mockup_credits := 30;
    WHEN 'pro' THEN
      v_logo_credits := 50;
      v_mockup_credits := 100;
    WHEN 'agency' THEN
      v_logo_credits := 200;
      v_mockup_credits := 500;
    ELSE
      RAISE EXCEPTION 'Unknown subscription tier: "%". Valid tiers: free, starter, pro, agency.', p_tier;
  END CASE;

  -- Upsert logo credits for the new period
  INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (p_user_id, 'logo', v_logo_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT (user_id, credit_type, period_start)
  DO UPDATE SET
    credits_remaining = v_logo_credits,
    credits_used = 0,
    last_refill_at = NOW();

  -- Upsert mockup credits for the new period
  INSERT INTO public.generation_credits (user_id, credit_type, credits_remaining, period_start, period_end, last_refill_at)
  VALUES (p_user_id, 'mockup', v_mockup_credits, v_period_start, v_period_end, NOW())
  ON CONFLICT (user_id, credit_type, period_start)
  DO UPDATE SET
    credits_remaining = v_mockup_credits,
    credits_used = 0,
    last_refill_at = NOW();

  -- Update profile tier to match
  UPDATE public.profiles SET subscription_tier = p_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refill_credits IS 'Refill generation credits based on subscription tier. Called on subscription renewal via Stripe webhook.';


-- =============================================================================
-- Mark a brand as complete and perform post-completion bookkeeping.
-- Called when the user finishes the wizard checkout step.
-- Returns a JSON summary of the completed brand.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_brand(
  p_brand_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_brand RECORD;
  v_asset_count INTEGER;
  v_product_count INTEGER;
  v_bundle_count INTEGER;
  v_result JSONB;
BEGIN
  -- Verify ownership and lock row
  SELECT * INTO v_brand
  FROM public.brands
  WHERE id = p_brand_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_brand IS NULL THEN
    RAISE EXCEPTION 'Brand not found or not owned by user.';
  END IF;

  IF v_brand.status = 'complete' THEN
    RAISE EXCEPTION 'Brand is already complete.';
  END IF;

  -- Count assets
  SELECT COUNT(*) INTO v_asset_count
  FROM public.brand_assets
  WHERE brand_id = p_brand_id AND is_archived = FALSE;

  -- Count selected products
  SELECT COUNT(*) INTO v_product_count
  FROM public.brand_products
  WHERE brand_id = p_brand_id;

  -- Count bundles
  SELECT COUNT(*) INTO v_bundle_count
  FROM public.brand_bundles
  WHERE brand_id = p_brand_id;

  -- Update brand status
  UPDATE public.brands SET
    status = 'complete',
    wizard_step = 'complete',
    completed_at = NOW()
  WHERE id = p_brand_id;

  -- Create audit log entry
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_user_id,
    'brand.completed',
    'brand',
    p_brand_id,
    jsonb_build_object(
      'asset_count', v_asset_count,
      'product_count', v_product_count,
      'bundle_count', v_bundle_count,
      'brand_name', v_brand.name
    )
  );

  -- Build and return result summary
  v_result := jsonb_build_object(
    'brand_id', p_brand_id,
    'brand_name', v_brand.name,
    'status', 'complete',
    'assets', v_asset_count,
    'products', v_product_count,
    'bundles', v_bundle_count,
    'completed_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_brand IS 'Finalize a brand. Sets status to complete, writes audit log, returns summary JSON.';


-- =============================================================================
-- Returns a summary of all active credits for a user.
-- Used by the frontend credit display and the server-side credit check.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_credit_summary(p_user_id UUID)
RETURNS TABLE (
  credit_type TEXT,
  remaining INTEGER,
  used INTEGER,
  total INTEGER,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.credit_type,
    gc.credits_remaining AS remaining,
    gc.credits_used AS used,
    (gc.credits_remaining + gc.credits_used) AS total,
    gc.period_end
  FROM public.generation_credits gc
  WHERE gc.user_id = p_user_id
    AND gc.period_end > NOW()
  ORDER BY gc.credit_type, gc.period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_credit_summary IS 'Returns active credit balances for a user across all credit types.';
