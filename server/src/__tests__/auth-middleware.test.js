// server/src/__tests__/auth-middleware.test.js
//
// Integration tests for the auth middleware chain:
//   - requireAuth
//   - requireAdmin
//   - requireSuperAdmin
//   - optionalAuth

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
// Mock Supabase BEFORE importing the module under test so the top-level
// `createClient` call inside lib/supabase.js gets intercepted.

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('../lib/supabase.js', () => {
  return {
    supabaseAdmin: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    },
    createUserClient: vi.fn(() => ({ __mock: true })),
  };
});

// Silence pino during tests
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import the code under test
const { requireAuth, requireAdmin, requireSuperAdmin, optionalAuth } = await import(
  '../middleware/auth.js'
);

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a minimal Express-like request object */
function mockReq(overrides = {}) {
  return {
    headers: {},
    ip: '127.0.0.1',
    id: 'test-req-1',
    user: null,
    profile: null,
    token: null,
    supabase: null,
    ...overrides,
  };
}

/** Build a minimal Express-like response object with spies */
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

const fakeUser = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'test@brand.me',
  role: 'authenticated',
};

const fakeProfile = {
  id: fakeUser.id,
  full_name: 'Test User',
  role: 'user',
  subscription_tier: 'pro',
  onboarding_done: true,
};

/** Set up the Supabase mock chain for profile lookup */
function setupProfileChain(profileData, profileError = null) {
  mockSingle.mockResolvedValue({ data: profileData, error: profileError });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Missing / malformed Authorization header ──────────────────

  it('should reject with 401 when no Authorization header is present', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json).toEqual({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when Authorization header has no Bearer prefix', async () => {
    const req = mockReq({ headers: { authorization: 'Token abc123' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when Bearer token is empty string', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer ' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when token is the literal string "undefined"', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer undefined' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when token is the literal string "null"', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer null' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Invalid / expired JWT ─────────────────────────────────────

  it('should reject with 401 when Supabase returns an auth error (expired JWT)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });

    const req = mockReq({ headers: { authorization: 'Bearer expired.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('expired.jwt.token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json).toEqual({
      success: false,
      error: 'Invalid or expired token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject with 401 when Supabase returns user as null without error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = mockReq({ headers: { authorization: 'Bearer orphan.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('User not found for token');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Profile not found ─────────────────────────────────────────

  it('should reject when user exists but profile lookup fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    setupProfileChain(null, { message: 'Row not found' });

    const req = mockReq({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('User profile not found');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Successful authentication ─────────────────────────────────

  it('should attach user, profile, token, and supabase client on valid JWT', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    setupProfileChain(fakeProfile);

    const req = mockReq({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(fakeUser);
    expect(req.profile).toEqual(fakeProfile);
    expect(req.token).toBe('valid.jwt.token');
    expect(req.supabase).toBeDefined();
    // Ensure response was NOT called (middleware passed through)
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Unexpected errors ─────────────────────────────────────────

  it('should return 401 with generic message on unexpected errors', async () => {
    mockGetUser.mockRejectedValue(new Error('Network failure'));

    const req = mockReq({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('Authentication failed');
    expect(next).not.toHaveBeenCalled();
  });
});

// ── requireAdmin ────────────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject with 401 when req.profile is not set', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject with 403 when user role is "user"', async () => {
    const req = mockReq({ profile: { ...fakeProfile, role: 'user' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.error).toBe('Admin access required');
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow through when role is "admin"', async () => {
    const req = mockReq({ profile: { ...fakeProfile, role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow through when role is "super_admin"', async () => {
    const req = mockReq({ profile: { ...fakeProfile, role: 'super_admin' } });
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── requireSuperAdmin ───────────────────────────────────────────────

describe('requireSuperAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject with 401 when req.profile is not set', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject with 403 when role is "admin" (not super)', async () => {
    const req = mockReq({ profile: { ...fakeProfile, role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.error).toBe('Super admin access required');
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow through when role is "super_admin"', async () => {
    const req = mockReq({ profile: { ...fakeProfile, role: 'super_admin' } });
    const res = mockRes();
    const next = vi.fn();

    await requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── optionalAuth ────────────────────────────────────────────────────

describe('optionalAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set all auth props to null when no token and still call next()', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeNull();
    expect(req.profile).toBeNull();
    expect(req.token).toBeNull();
    expect(req.supabase).toBeNull();
  });

  it('should attach user when a valid token is present', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    setupProfileChain(fakeProfile);

    const req = mockReq({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(fakeUser);
    expect(req.profile).toEqual(fakeProfile);
  });

  it('should set auth props to null on invalid token and still call next()', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const req = mockReq({ headers: { authorization: 'Bearer bad.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeNull();
    expect(req.profile).toBeNull();
    // Response should NOT have been sent — optionalAuth never blocks
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should gracefully handle unexpected errors and still call next()', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase down'));

    const req = mockReq({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeNull();
    expect(req.profile).toBeNull();
  });
});
