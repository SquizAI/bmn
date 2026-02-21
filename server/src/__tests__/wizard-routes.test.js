// server/src/__tests__/wizard-routes.test.js
//
// Unit tests for the wizard controller handlers.
// We mock Supabase, logger, and AI model router, then test the controller
// functions with mock req/res objects.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (...args) => mockFrom(...args),
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

vi.mock('../agents/session-manager.js', () => ({
  sessionManager: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../lib/hmac-tokens.js', () => ({
  verifyResumeToken: vi.fn(),
}));

vi.mock('../skills/_shared/model-router.js', () => ({
  routeModel: vi.fn(),
}));

vi.mock('../skills/brand-generator/prompts.js', () => ({
  SYSTEM_PROMPT: 'mock-brand-gen-prompt',
  buildDirectionsTaskPrompt: vi.fn().mockReturnValue('mock-directions-prompt'),
}));

vi.mock('../skills/name-generator/prompts.js', () => ({
  SYSTEM_PROMPT: 'mock-name-gen-prompt',
}));

vi.mock('../services/competitor.js', () => ({
  analyzeCompetitors: vi.fn(),
}));

vi.mock('../services/website-scraper.js', () => ({
  scrapeWebsite: vi.fn(),
}));

vi.mock('../services/pdf-generator.js', () => ({
  generateDossierPdf: vi.fn(),
}));

// Now import the code under test
const {
  startWizard,
  getWizardState,
  saveStepData,
} = await import('../controllers/wizard.js');

// ── Helpers ──────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    user: { id: 'user-abc-123' },
    profile: { org_id: 'org-abc-123' },
    params: {},
    body: {},
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
    set: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  vi.spyOn(res, 'status');
  vi.spyOn(res, 'json');
  return res;
}

function setupChain(data, error = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockSelect.mockReturnValue({ eq: (...args) => { mockEq(...args); return { eq: (...args2) => { mockEq(...args2); return { single: mockSingle }; }, single: mockSingle }; } });
  mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
  mockUpdate.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: (...args) => { mockUpdate(...args); return { eq: vi.fn().mockResolvedValue({ error: null }) }; },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('startWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new brand and return 201 with brand data', async () => {
    const brandData = {
      id: 'brand-new-1',
      wizard_step: 'social',
      wizard_state: {},
    };
    setupChain(brandData);

    const req = mockReq({ body: { brand_name: 'Test Brand' } });
    const res = mockRes();
    const next = vi.fn();

    await startWizard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res._json.success).toBe(true);
    expect(res._json.data.brandId).toBe('brand-new-1');
    expect(res._json.data.wizardStep).toBe('social');
  });

  it('should default brand name to "Untitled Brand" when not provided', async () => {
    const brandData = { id: 'brand-2', wizard_step: 'social', wizard_state: {} };
    setupChain(brandData);

    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = vi.fn();

    await startWizard(req, res, next);

    expect(mockFrom).toHaveBeenCalledWith('brands');
    expect(res._json.success).toBe(true);
  });

  it('should return 500 when Supabase insert fails', async () => {
    setupChain(null, { message: 'Insert failed' });

    const req = mockReq({ body: { brand_name: 'Fail Brand' } });
    const res = mockRes();
    const next = vi.fn();

    await startWizard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.success).toBe(false);
    expect(res._json.error).toBe('Failed to create brand');
  });

  it('should call next on unexpected errors', async () => {
    mockFrom.mockImplementation(() => { throw new Error('Unexpected'); });

    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = vi.fn();

    await startWizard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('getWizardState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return brand wizard state', async () => {
    const brandData = {
      id: 'brand-1',
      name: 'My Brand',
      status: 'draft',
      wizard_step: 'social',
      wizard_state: { social: { instagram: 'test' } },
      agent_session_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    setupChain(brandData);

    const req = mockReq({ params: { brandId: 'brand-1' } });
    const res = mockRes();
    const next = vi.fn();

    await getWizardState(req, res, next);

    expect(res._json.success).toBe(true);
    expect(res._json.data.brandId).toBe('brand-1');
    expect(res._json.data.name).toBe('My Brand');
    expect(res._json.data.wizardStep).toBe('social');
    expect(res._json.data.hasActiveSession).toBe(false);
  });

  it('should return 404 when brand is not found', async () => {
    setupChain(null, { message: 'Not found' });

    const req = mockReq({ params: { brandId: 'nonexistent' } });
    const res = mockRes();
    const next = vi.fn();

    await getWizardState(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._json.success).toBe(false);
    expect(res._json.error).toBe('Brand not found');
  });
});

describe('saveStepData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge step data and return success', async () => {
    const brandData = {
      id: 'brand-1',
      wizard_state: { previousStep: { some: 'data' } },
    };
    setupChain(brandData);

    const req = mockReq({
      params: { brandId: 'brand-1' },
      body: { step: 2, data: { colors: ['#FF0000'] } },
    });
    const res = mockRes();
    const next = vi.fn();

    await saveStepData(req, res, next);

    expect(res._json.success).toBe(true);
    expect(res._json.data.brandId).toBe('brand-1');
    expect(res._json.data.saved).toBe(true);
  });

  it('should return 404 when brand does not exist', async () => {
    setupChain(null, { message: 'Not found' });

    const req = mockReq({
      params: { brandId: 'nonexistent' },
      body: { step: 1, data: {} },
    });
    const res = mockRes();
    const next = vi.fn();

    await saveStepData(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._json.error).toBe('Brand not found');
  });
});
