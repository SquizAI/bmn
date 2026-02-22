import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const supabaseChain = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
};

for (const fn of Object.values(supabaseChain)) {
  fn.mockReturnValue(supabaseChain);
}

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => supabaseChain),
    rpc: mockRpc,
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../config/tiers.js', () => ({
  getTierConfig: vi.fn().mockImplementation((tier) => {
    const configs = {
      free: {
        logoCredits: 4,
        mockupCredits: 4,
        overageEnabled: false,
        creditsRefillMonthly: false,
      },
      starter: {
        logoCredits: 20,
        mockupCredits: 30,
        overageEnabled: false,
        creditsRefillMonthly: true,
      },
      pro: {
        logoCredits: 50,
        mockupCredits: 100,
        overageEnabled: true,
        creditsRefillMonthly: true,
      },
    };
    return configs[tier] || configs.free;
  }),
}));

vi.mock('../utils/errors.js', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

describe('Credits Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(supabaseChain)) {
      fn.mockReturnValue(supabaseChain);
    }
  });

  describe('allocateCredits', () => {
    it('should allocate credits via RPC and log success', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      const { allocateCredits } = await import('../services/credits.js');
      await allocateCredits('user-123', 'starter');

      expect(mockRpc).toHaveBeenCalledWith('refill_credits', {
        p_user_id: 'user-123',
        p_tier: 'starter',
      });
    });

    it('should throw AppError when RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({ error: { message: 'RPC failed' } });

      const { allocateCredits } = await import('../services/credits.js');
      await expect(allocateCredits('user-123', 'starter')).rejects.toThrow('Credit allocation failed');
    });
  });

  describe('checkCredits', () => {
    it('should return allowed:true when user has sufficient credits', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { credit_type: 'logo', remaining: 10, used: 2, total: 12 },
        ],
        error: null,
      });

      const { checkCredits } = await import('../services/credits.js');
      const result = await checkCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          allowed: true,
          remaining: 10,
          needsUpgrade: false,
        })
      );
    });

    it('should return allowed:false when insufficient credits on free tier', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { credit_type: 'logo', remaining: 0, used: 4, total: 4 },
        ],
        error: null,
      });

      // Profile query for tier check
      mockSingle.mockResolvedValueOnce({
        data: { subscription_tier: 'free' },
        error: null,
      });

      const { checkCredits } = await import('../services/credits.js');
      const result = await checkCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
          remaining: 0,
          needsUpgrade: true,
        })
      );
    });

    it('should return allowed:true with overageAllowed for pro tier', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { credit_type: 'logo', remaining: 0, used: 50, total: 50 },
        ],
        error: null,
      });

      // Profile query for tier check
      mockSingle.mockResolvedValueOnce({
        data: { subscription_tier: 'pro' },
        error: null,
      });

      const { checkCredits } = await import('../services/credits.js');
      const result = await checkCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          allowed: true,
          overageAllowed: true,
          needsUpgrade: false,
        })
      );
    });

    it('should return allowed:false when RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const { checkCredits } = await import('../services/credits.js');
      const result = await checkCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
          remaining: 0,
          needsUpgrade: true,
        })
      );
    });

    it('should return allowed:false when no credit record found for type', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { credit_type: 'mockup', remaining: 10, used: 0, total: 10 },
        ],
        error: null,
      });

      const { checkCredits } = await import('../services/credits.js');
      const result = await checkCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
          remaining: 0,
          needsUpgrade: true,
        })
      );
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits and return remaining balance', async () => {
      // First RPC: deduct_credit returns true
      mockRpc.mockResolvedValueOnce({ data: true, error: null });
      // Second RPC: get_credit_summary for remaining balance
      mockRpc.mockResolvedValueOnce({
        data: [{ credit_type: 'logo', remaining: 9 }],
        error: null,
      });

      const { deductCredits } = await import('../services/credits.js');
      const result = await deductCredits('user-123', 'logo', 1, 'Logo generation', 'brand-123');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          remaining: 9,
        })
      );
    });

    it('should return success:false when deduction fails (insufficient credits)', async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const { deductCredits } = await import('../services/credits.js');
      const result = await deductCredits('user-123', 'logo', 1);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          remaining: 0,
        })
      );
    });

    it('should throw AppError when RPC errors', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB crash' } });

      const { deductCredits } = await import('../services/credits.js');
      await expect(deductCredits('user-123', 'logo', 1)).rejects.toThrow('Credit deduction failed');
    });
  });

  describe('refundCredits', () => {
    it('should refund credits via RPC', async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true, balance_after: 5 }, error: null });

      const { refundCredits } = await import('../services/credits.js');
      await refundCredits('user-123', 'logo', 1, 'Failed job refund');

      expect(mockRpc).toHaveBeenCalledWith('refund_credit', {
        p_user_id: 'user-123',
        p_credit_type: 'logo',
        p_amount: 1,
      });
    });

    it('should throw AppError when refund RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Refund failed' } });

      const { refundCredits } = await import('../services/credits.js');
      await expect(refundCredits('user-123', 'logo', 1)).rejects.toThrow('Credit refund failed');
    });
  });

  describe('refillCredits', () => {
    it('should refill credits for monthly tiers', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      const { refillCredits } = await import('../services/credits.js');
      await refillCredits('user-123', 'starter');

      expect(mockRpc).toHaveBeenCalledWith('refill_credits', {
        p_user_id: 'user-123',
        p_tier: 'starter',
      });
    });

    it('should skip refill for free tier (no monthly refill)', async () => {
      const { refillCredits } = await import('../services/credits.js');
      await refillCredits('user-123', 'free');

      // Should not call rpc because free tier has creditsRefillMonthly: false
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('getCreditBalance', () => {
    it('should return structured credit balances', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { credit_type: 'logo', remaining: 3, used: 1, total: 4, period_end: '2026-03-01' },
          { credit_type: 'mockup', remaining: 2, used: 2, total: 4, period_end: '2026-03-01' },
          { credit_type: 'video', remaining: 0, used: 0, total: 0, period_end: '2026-03-01' },
        ],
        error: null,
      });

      const { getCreditBalance } = await import('../services/credits.js');
      const result = await getCreditBalance('user-123');

      expect(result).toEqual(
        expect.objectContaining({
          logo: { remaining: 3, used: 1, total: 4 },
          mockup: { remaining: 2, used: 2, total: 4 },
          video: { remaining: 0, used: 0, total: 0 },
          periodEnd: '2026-03-01',
        })
      );
    });

    it('should return empty balances on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const { getCreditBalance } = await import('../services/credits.js');
      const result = await getCreditBalance('user-123');

      expect(result).toEqual(
        expect.objectContaining({
          logo: { remaining: 0, used: 0, total: 0 },
          mockup: { remaining: 0, used: 0, total: 0 },
          video: { remaining: 0, used: 0, total: 0 },
          periodEnd: null,
        })
      );
    });
  });
});
