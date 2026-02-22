import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin before importing controller
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const supabaseChain = {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  single: mockSingle,
  order: mockOrder,
  limit: mockLimit,
};

for (const fn of Object.values(supabaseChain)) {
  fn.mockReturnValue(supabaseChain);
}

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => supabaseChain),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock stripe service
vi.mock('../../services/stripe.js', () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}));

// Mock credits service
vi.mock('../../services/credits.js', () => ({
  getCreditBalance: vi.fn(),
}));

// Mock tiers config
vi.mock('../../config/tiers.js', () => ({
  getTierConfig: vi.fn().mockReturnValue({
    displayName: 'Free Trial',
    features: ['basic_wizard', 'logo_generation'],
    brandLimit: 1,
  }),
  getTierByPriceId: vi.fn(),
}));

describe('Payments Controller Integration', () => {
  /** @type {import('express').Request} */
  let req;
  /** @type {import('express').Response} */
  let res;
  /** @type {import('express').NextFunction} */
  let next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: 'user-uuid-123', email: 'test@example.com' },
      profile: { subscription_tier: 'free', stripe_customer_id: null },
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();

    for (const fn of Object.values(supabaseChain)) {
      fn.mockReturnValue(supabaseChain);
    }
  });

  describe('POST /billing/checkout-session (createCheckoutSession)', () => {
    it('should create a checkout session and return URL', async () => {
      const { createCheckoutSession: mockStripeCreate } = await import('../../services/stripe.js');
      mockStripeCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session-123',
        sessionId: 'cs_test_123',
      });

      req.body = {
        tier: 'starter',
        successUrl: 'https://app.brandmenow.com/success',
        cancelUrl: 'https://app.brandmenow.com/cancel',
      };

      const { createCheckoutSession } = await import('../../controllers/payments.js');
      await createCheckoutSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            url: 'https://checkout.stripe.com/session-123',
            sessionId: 'cs_test_123',
          }),
        })
      );
    });

    it('should call next with error when stripe fails', async () => {
      const { createCheckoutSession: mockStripeCreate } = await import('../../services/stripe.js');
      mockStripeCreate.mockRejectedValueOnce(new Error('Stripe API error'));

      req.body = {
        tier: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const { createCheckoutSession } = await import('../../controllers/payments.js');
      await createCheckoutSession(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('POST /billing/portal-session (createPortalSession)', () => {
    it('should create a portal session for existing customer', async () => {
      req.profile.stripe_customer_id = 'cus_test_123';
      req.body = { returnUrl: 'https://app.brandmenow.com/dashboard' };

      const { createPortalSession: mockStripePortal } = await import('../../services/stripe.js');
      mockStripePortal.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal-123',
      });

      const { createPortalSession } = await import('../../controllers/payments.js');
      await createPortalSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            url: 'https://billing.stripe.com/portal-123',
          }),
        })
      );
    });

    it('should return 400 when no stripe customer ID exists', async () => {
      req.profile.stripe_customer_id = null;
      req.body = { returnUrl: 'https://example.com' };

      const { createPortalSession } = await import('../../controllers/payments.js');
      await createPortalSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('No billing account'),
        })
      );
    });
  });

  describe('GET /billing/subscription (getSubscription)', () => {
    it('should return subscription details for free tier user', async () => {
      const { getCreditBalance } = await import('../../services/credits.js');
      getCreditBalance.mockResolvedValueOnce({
        logo: { remaining: 4, used: 0, total: 4 },
        mockup: { remaining: 4, used: 0, total: 4 },
        video: { remaining: 0, used: 0, total: 0 },
        periodEnd: null,
      });

      // subscription query returns null (free user)
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const { getSubscription } = await import('../../controllers/payments.js');
      await getSubscription(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tier: 'free',
            tierDisplayName: 'Free Trial',
            status: 'active',
            credits: expect.objectContaining({
              logo: expect.objectContaining({ remaining: 4 }),
            }),
          }),
        })
      );
    });

    it('should return subscription details for paying user', async () => {
      req.profile.subscription_tier = 'pro';
      req.profile.stripe_customer_id = 'cus_123';

      const { getCreditBalance } = await import('../../services/credits.js');
      getCreditBalance.mockResolvedValueOnce({
        logo: { remaining: 45, used: 5, total: 50 },
        mockup: { remaining: 90, used: 10, total: 100 },
        video: { remaining: 10, used: 0, total: 10 },
        periodEnd: '2026-03-15T00:00:00Z',
      });

      // subscription query returns active subscription
      mockSingle.mockResolvedValueOnce({
        data: {
          status: 'active',
          current_period_start: '2026-02-15T00:00:00Z',
          current_period_end: '2026-03-15T00:00:00Z',
          cancel_at_period_end: false,
          stripe_subscription_id: 'sub_test_123',
        },
        error: null,
      });

      const { getSubscription } = await import('../../controllers/payments.js');
      await getSubscription(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tier: 'pro',
            status: 'active',
            stripeSubscriptionId: 'sub_test_123',
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });
  });

  describe('GET /billing/credits (getCredits)', () => {
    it('should return credit balances', async () => {
      const { getCreditBalance } = await import('../../services/credits.js');
      getCreditBalance.mockResolvedValueOnce({
        logo: { remaining: 3, used: 1, total: 4 },
        mockup: { remaining: 2, used: 2, total: 4 },
        video: { remaining: 0, used: 0, total: 0 },
        periodEnd: '2026-03-01T00:00:00Z',
      });

      const { getCredits } = await import('../../controllers/payments.js');
      await getCredits(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            logo: expect.objectContaining({ remaining: 3 }),
            mockup: expect.objectContaining({ remaining: 2 }),
            periodEnd: '2026-03-01T00:00:00Z',
          }),
        })
      );
    });

    it('should call next on error', async () => {
      const { getCreditBalance } = await import('../../services/credits.js');
      getCreditBalance.mockRejectedValueOnce(new Error('DB error'));

      const { getCredits } = await import('../../controllers/payments.js');
      await getCredits(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
