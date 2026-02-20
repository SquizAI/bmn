// server/src/__tests__/dashboard-routes.test.js
//
// Tests for the Stripe webhook handler controller.
// Since there are no dashboard routes yet, we test the webhook controller
// which handles Stripe events (the primary server route besides wizard).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      upsert: mockUpsert,
      update: mockUpdate,
      insert: mockInsert,
    }),
    rpc: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/stripe.js', () => ({
  constructWebhookEvent: vi.fn(),
  getStripe: vi.fn().mockReturnValue({
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        items: { data: [{ price: { id: 'price_test_123' } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        status: 'active',
        metadata: {},
      }),
    },
  }),
}));

vi.mock('../services/credits.js', () => ({
  allocateCredits: vi.fn().mockResolvedValue(undefined),
  refillCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/tiers.js', () => ({
  getTierByPriceId: vi.fn().mockReturnValue({ name: 'pro' }),
  getTierConfig: vi.fn().mockReturnValue({
    displayName: 'Pro',
    price: 79,
  }),
}));

vi.mock('../queues/dispatch.js', () => ({
  dispatchJob: vi.fn().mockResolvedValue({ jobId: 'job-1', queueName: 'crm-sync' }),
}));

// Now import
const { handleStripeWebhook, handleGHLWebhook } = await import('../controllers/webhooks.js');
const { constructWebhookEvent } = await import('../services/stripe.js');

// ── Helpers ──────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    headers: {},
    body: Buffer.from('{}'),
    app: { locals: { io: null } },
    id: 'req-1',
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res._json = body;
      return res;
    },
  };
  vi.spyOn(res, 'status');
  vi.spyOn(res, 'json');
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('handleStripeWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('should return 400 when stripe-signature header is missing', async () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();

    await handleStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error).toBe('Missing Stripe signature');
  });

  it('should return 400 when signature verification fails', async () => {
    constructWebhookEvent.mockImplementation(() => {
      throw new Error('Webhook signature verification failed');
    });

    const req = mockReq({
      headers: { 'stripe-signature': 'invalid-sig' },
    });
    const res = mockRes();

    await handleStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error).toBe('Webhook signature verification failed');
  });

  it('should return { received: true } for unhandled event types', async () => {
    constructWebhookEvent.mockReturnValue({
      id: 'evt_test_1',
      type: 'payment_method.attached',
      data: { object: {} },
    });

    const req = mockReq({
      headers: { 'stripe-signature': 'valid-sig' },
    });
    const res = mockRes();

    await handleStripeWebhook(req, res);

    expect(res._json).toEqual({ received: true });
  });

  it('should skip duplicate events (idempotency check)', async () => {
    constructWebhookEvent.mockReturnValue({
      id: 'evt_already_processed',
      type: 'checkout.session.completed',
      data: { object: { metadata: {} } },
    });

    // Simulate the event already being processed
    mockSingle.mockResolvedValueOnce({ data: { id: 'evt_already_processed' } });

    const req = mockReq({
      headers: { 'stripe-signature': 'valid-sig' },
    });
    const res = mockRes();

    await handleStripeWebhook(req, res);

    expect(res._json).toEqual({ received: true });
  });

  it('should process checkout.session.completed and return 200', async () => {
    constructWebhookEvent.mockReturnValue({
      id: 'evt_new_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {
            supabase_user_id: 'user-123',
            tier: 'pro',
          },
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
        },
      },
    });

    // Event not yet processed
    mockSingle.mockResolvedValueOnce({ data: null });

    const req = mockReq({
      headers: { 'stripe-signature': 'valid-sig' },
    });
    const res = mockRes();

    await handleStripeWebhook(req, res);

    expect(res._json).toEqual({ received: true });
  });
});

describe('handleGHLWebhook', () => {
  it('should return { received: true }', async () => {
    const req = mockReq({ id: 'ghl-req-1' });
    const res = mockRes();

    await handleGHLWebhook(req, res);

    expect(res._json).toEqual({ received: true });
  });
});
