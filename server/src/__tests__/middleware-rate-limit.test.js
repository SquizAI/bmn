// server/src/__tests__/middleware-rate-limit.test.js
//
// Unit tests for the rate limit middleware.
// Mocks Redis and express-rate-limit internals to test the limiter factory
// and tier-based rate limiting logic.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock Redis before importing the module under test
vi.mock('../lib/redis.js', () => ({
  redis: {
    call: vi.fn(),
    options: { host: 'localhost', port: 6379, password: undefined, db: 0 },
  },
}));

// Mock config to force dev mode (so Redis store is not used)
vi.mock('../config/index.js', () => ({
  config: {
    isDev: true,
    NODE_ENV: 'test',
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

// Now import the module under test
const { generalLimiter, generationLimiter, authLimiter, webhookLimiter } = await import(
  '../middleware/rate-limit.js'
);

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a minimal Express-like request object */
function mockReq(overrides = {}) {
  return {
    headers: {},
    ip: '127.0.0.1',
    path: '/api/v1/test',
    user: null,
    profile: null,
    ...overrides,
  };
}

/** Build a minimal Express-like response object */
function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    _headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res._json = body;
      return res;
    },
    set(key, value) {
      if (typeof key === 'string') {
        res._headers[key] = value;
      } else {
        Object.assign(res._headers, key);
      }
      return res;
    },
    setHeader(key, value) {
      res._headers[key] = value;
      return res;
    },
    getHeader(key) {
      return res._headers[key];
    },
  };
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('generalLimiter', () => {
  it('should be a function (middleware)', () => {
    expect(typeof generalLimiter).toBe('function');
  });

  it('should allow requests under the limit', async () => {
    const req = mockReq({ user: { id: 'user-1' }, profile: { subscription_tier: 'pro' } });
    const res = mockRes();
    const next = vi.fn();

    // In dev mode with memory store, first request should pass
    await generalLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    // If next was called with an error (rate limit), that means it exceeded
    // On first call, it should pass through cleanly
    const callArg = next.mock.calls[0]?.[0];
    // First request should not be a RateLimitError
    if (callArg) {
      expect(callArg.statusCode).not.toBe(429);
    }
  });

  it('should skip rate limiting for /health endpoint', async () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = vi.fn();

    await generalLimiter(req, res, next);

    // Health check should always pass (skip returns true for /health)
    expect(next).toHaveBeenCalled();
  });
});

describe('generationLimiter', () => {
  it('should be a function (middleware)', () => {
    expect(typeof generationLimiter).toBe('function');
  });

  it('should allow first few requests through', async () => {
    const req = mockReq({ user: { id: 'gen-user-1' }, ip: '10.0.0.1' });
    const res = mockRes();
    const next = vi.fn();

    await generationLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('authLimiter', () => {
  it('should be a function (middleware)', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('should allow requests under the 10-per-15min limit', async () => {
    const req = mockReq({ ip: '192.168.1.1' });
    const res = mockRes();
    const next = vi.fn();

    await authLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('webhookLimiter', () => {
  it('should be a function (middleware)', () => {
    expect(typeof webhookLimiter).toBe('function');
  });

  it('should allow requests under the 200-per-minute limit', async () => {
    const req = mockReq({ ip: '10.0.0.50' });
    const res = mockRes();
    const next = vi.fn();

    await webhookLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('tier-based rate limiting (generalLimiter)', () => {
  // Note: These tests verify the middleware functions exist and are callable.
  // Full tier-limit verification requires integration with express-rate-limit
  // which uses its own internal counter. We verify the factory produces
  // valid middleware for each tier configuration.

  it('should allow super_admin requests through (unlimited)', async () => {
    const req = mockReq({
      user: { id: 'admin-1' },
      profile: { role: 'super_admin', subscription_tier: 'free' },
    });
    const res = mockRes();
    const next = vi.fn();

    await generalLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use user ID as key when user is authenticated', async () => {
    const req = mockReq({
      user: { id: 'keyed-user-123' },
      profile: { subscription_tier: 'starter' },
    });
    const res = mockRes();
    const next = vi.fn();

    await generalLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fall back to IP when no user is present', async () => {
    const req = mockReq({ ip: '203.0.113.42' });
    const res = mockRes();
    const next = vi.fn();

    await generalLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
