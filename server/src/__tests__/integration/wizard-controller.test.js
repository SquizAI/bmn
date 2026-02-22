import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin before importing controller
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockRpc = vi.fn();

const supabaseChain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
  order: mockOrder,
  range: mockRange,
  // Terminal-safe: when the chain is awaited as a terminal result,
  // these properties ensure proper destructuring
  data: null,
  error: null,
  count: 0,
};

// Each method returns the chain for fluent calls
for (const [key, fn] of Object.entries(supabaseChain)) {
  if (typeof fn === 'function') fn.mockReturnValue(supabaseChain);
}

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => supabaseChain),
    rpc: mockRpc,
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

vi.mock('../../agents/session-manager.js', () => ({
  sessionManager: {
    get: vi.fn().mockResolvedValue(null),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/hmac-tokens.js', () => ({
  signResumeToken: vi.fn().mockReturnValue('mock-resume-token'),
  verifyResumeToken: vi.fn().mockReturnValue({ brandId: 'b1', userId: 'user-uuid-123' }),
}));

vi.mock('../../skills/_shared/model-router.js', () => ({
  routeModel: vi.fn().mockResolvedValue({ text: '{"taglines": []}', model: 'mock-model' }),
}));

vi.mock('../../skills/brand-generator/prompts.js', () => ({
  SYSTEM_PROMPT: 'mock-system-prompt',
  buildDirectionsTaskPrompt: vi.fn().mockReturnValue('mock-prompt'),
  CONTEXT_ANALYSIS_SYSTEM: 'mock-context-system',
  buildContextAnalysisPrompt: vi.fn().mockReturnValue('mock-context-prompt'),
  DIRECTION_GENERATION_SYSTEM: 'mock-direction-system',
  buildDirectionPrompt: vi.fn().mockReturnValue('mock-direction-prompt'),
  buildDirectionsBCPrompt: vi.fn().mockReturnValue('mock-bc-prompt'),
  VALIDATION_SYSTEM: 'mock-validation-system',
  buildValidationPrompt: vi.fn().mockReturnValue('mock-validation-prompt'),
}));

vi.mock('../../skills/name-generator/prompts.js', () => ({
  SYSTEM_PROMPT: 'mock-name-system-prompt',
}));

vi.mock('../../services/competitor.js', () => ({
  analyzeCompetitors: vi.fn(),
}));

vi.mock('../../services/website-scraper.js', () => ({
  scrapeWebsite: vi.fn(),
}));

vi.mock('../../services/pdf-generator.js', () => ({
  generateDossierPdf: vi.fn().mockReturnValue(Buffer.from('<html>dossier</html>')),
}));

vi.mock('apify-client', () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: vi.fn().mockReturnValue({
      call: vi.fn().mockResolvedValue({ defaultDatasetId: 'ds-mock' }),
    }),
    dataset: vi.fn().mockReturnValue({
      listItems: vi.fn().mockResolvedValue({ items: [] }),
    }),
  })),
}));

vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    scrapeUrl: vi.fn().mockResolvedValue({ success: false }),
  })),
}));

vi.mock('../../config/index.js', () => ({
  config: {
    APIFY_API_TOKEN: null,
    FIRECRAWL_API_KEY: null,
  },
}));

vi.mock('../../queues/index.js', () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'job-mock-123' }),
  }),
}));

function resetChain() {
  for (const [key, fn] of Object.entries(supabaseChain)) {
    if (typeof fn === 'function') fn.mockReturnValue(supabaseChain);
  }
}

describe('Wizard Controller Integration', () => {
  /** @type {import('express').Request} */
  let req;
  /** @type {import('express').Response} */
  let res;
  /** @type {import('express').NextFunction} */
  let next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: 'user-uuid-123' },
      profile: { org_id: 'org-uuid-123' },
      params: {},
      query: {},
      body: {},
      app: { locals: { io: null } },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
    resetChain();
  });

  describe('POST /wizard/start (startWizard)', () => {
    it('should create a new draft brand and return 201', async () => {
      const mockBrand = {
        id: 'brand-new-123',
        name: 'My New Brand',
        status: 'draft',
        wizard_step: 'social',
        wizard_state: {},
      };

      req.body = { brand_name: 'My New Brand' };
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { startWizard } = await import('../../controllers/wizard.js');
      await startWizard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            brandId: 'brand-new-123',
            wizardStep: 'social',
          }),
        })
      );
    });

    it('should use "Untitled Brand" when no brand_name provided', async () => {
      const mockBrand = {
        id: 'brand-new-456',
        name: 'Untitled Brand',
        status: 'draft',
        wizard_step: 'social',
        wizard_state: {},
      };

      req.body = {};
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { startWizard } = await import('../../controllers/wizard.js');
      await startWizard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 on database error', async () => {
      req.body = { brand_name: 'Fail Brand' };
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB insert failed' } });

      const { startWizard } = await import('../../controllers/wizard.js');
      await startWizard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  describe('GET /wizard/:brandId/state (getWizardState)', () => {
    it('should return wizard state for an owned brand', async () => {
      const mockBrand = {
        id: 'b1',
        name: 'Test Brand',
        status: 'draft',
        wizard_step: 'identity',
        wizard_state: { 'social-analysis': { handle: 'test' } },
        agent_session_id: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      };

      req.params.brandId = 'b1';
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { getWizardState } = await import('../../controllers/wizard.js');
      await getWizardState(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            brandId: 'b1',
            wizardStep: 'identity',
            hasActiveSession: false,
          }),
        })
      );
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'non-existent';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getWizardState } = await import('../../controllers/wizard.js');
      await getWizardState(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PATCH /wizard/:brandId/step (saveStepData)', () => {
    it('should return 404 if brand not owned by user', async () => {
      req.params.brandId = 'b1';
      req.body = { step: 'brand-name', data: {} };
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { saveStepData } = await import('../../controllers/wizard.js');
      await saveStepData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should save step data and return success', async () => {
      const mockBrand = {
        id: 'b1',
        wizard_state: { 'social-analysis': { done: true } },
      };

      req.params.brandId = 'b1';
      // Use a step that does NOT map to a DB step to avoid advanceToStep complexity
      req.body = {
        step: 'some-custom-data',
        data: { selectedName: 'TestBrand' },
      };

      // Ownership check: single() resolves with brand
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });
      // The update chain .update().eq() resolves to chain obj (which has error: null)

      const { saveStepData } = await import('../../controllers/wizard.js');
      await saveStepData(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            brandId: 'b1',
            saved: true,
          }),
        })
      );
    });
  });

  describe('POST /wizard/:brandId/resume-token (generateResumeToken)', () => {
    it('should generate and return an HMAC resume token', async () => {
      req.params.brandId = 'b1';
      mockSingle.mockResolvedValueOnce({
        data: { id: 'b1', wizard_step: 'identity' },
        error: null,
      });

      const { generateResumeToken } = await import('../../controllers/wizard.js');
      await generateResumeToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'mock-resume-token',
          }),
        })
      );
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'bad-id';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { generateResumeToken } = await import('../../controllers/wizard.js');
      await generateResumeToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /wizard/resume (resumeWizard)', () => {
    it('should resume wizard session from valid token', async () => {
      req.body = { token: 'valid-token' };

      const mockBrand = {
        id: 'b1',
        name: 'My Brand',
        status: 'draft',
        wizard_step: 'logos',
        wizard_state: {},
        agent_session_id: null,
      };

      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { resumeWizard } = await import('../../controllers/wizard.js');
      await resumeWizard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            brandId: 'b1',
            wizardStep: 'logos',
          }),
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      req.user = null;
      req.body = { token: 'some-token' };

      const { resumeWizard } = await import('../../controllers/wizard.js');
      await resumeWizard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('POST /wizard/:brandId/analyze-social (analyzeSocial)', () => {
    it('should return cached dossier when handles match', async () => {
      req.params.brandId = 'b1';
      req.body = { instagram: 'testcreator' };

      const mockBrand = {
        id: 'b1',
        name: 'Test Brand',
        wizard_state: {
          'social-analysis': {
            profile: { handle: 'testcreator' },
            socialHandles: { instagram: 'testcreator' },
          },
        },
      };

      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { analyzeSocial } = await import('../../controllers/wizard.js');
      await analyzeSocial(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            cached: true,
            brandId: 'b1',
          }),
        })
      );
    });

    it('should return 400 when no social handles provided', async () => {
      req.params.brandId = 'b1';
      req.body = {};

      const mockBrand = { id: 'b1', name: 'Test Brand', wizard_state: {} };
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { analyzeSocial } = await import('../../controllers/wizard.js');
      await analyzeSocial(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'bad';
      req.body = { instagram: 'test' };
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { analyzeSocial } = await import('../../controllers/wizard.js');
      await analyzeSocial(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should dispatch BullMQ job for new analysis', async () => {
      req.params.brandId = 'b1';
      req.body = { instagram: 'newcreator' };

      const mockBrand = { id: 'b1', name: 'Test Brand', wizard_state: {} };
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { analyzeSocial } = await import('../../controllers/wizard.js');
      await analyzeSocial(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobId: 'job-mock-123',
            status: 'processing',
          }),
        })
      );
    });
  });

  describe('POST /wizard/:brandId/generate-taglines (generateTaglines)', () => {
    it('should return cached taglines when they exist', async () => {
      req.params.brandId = 'b1';

      const mockBrand = {
        id: 'b1',
        name: 'Test Brand',
        wizard_state: {
          taglines: ['Tag one', 'Tag two', 'Tag three'],
        },
      };

      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { generateTaglines } = await import('../../controllers/wizard.js');
      await generateTaglines(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            taglines: ['Tag one', 'Tag two', 'Tag three'],
            cached: true,
          }),
        })
      );
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'bad';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { generateTaglines } = await import('../../controllers/wizard.js');
      await generateTaglines(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /wizard/:brandId/dossier-pdf (getDossierPdf)', () => {
    it('should return HTML dossier when social analysis exists', async () => {
      req.params.brandId = 'b1';

      const mockBrand = {
        id: 'b1',
        wizard_state: {
          'social-analysis': {
            profile: { handle: 'testcreator' },
            niche: { primaryNiche: { name: 'Fitness' } },
          },
        },
      };

      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { getDossierPdf } = await import('../../controllers/wizard.js');
      await getDossierPdf(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'text/html; charset=utf-8',
        })
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 400 when social analysis not completed', async () => {
      req.params.brandId = 'b1';

      const mockBrand = { id: 'b1', wizard_state: {} };
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { getDossierPdf } = await import('../../controllers/wizard.js');
      await getDossierPdf(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /wizard/:brandId/complete (completeWizard)', () => {
    it('should mark wizard as complete', async () => {
      req.params.brandId = 'b1';

      const mockBrand = {
        id: 'b1',
        name: 'Complete Brand',
        wizard_step: 'projections',
        wizard_state: {},
      };

      // Q1 ownership: .select.eq.eq.single -> single resolves
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });
      // Q2 advanceToStep fetch: .select.eq.single -> single resolves
      mockSingle.mockResolvedValueOnce({ data: { wizard_step: 'projections' }, error: null });
      // Q3-Q4 advanceToStep updates (.update.eq) use default chain return
      // which has { error: null } thanks to the chain's error property.

      const { completeWizard } = await import('../../controllers/wizard.js');
      await completeWizard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            brandId: 'b1',
            status: 'complete',
          }),
        })
      );
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'bad';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });

      const { completeWizard } = await import('../../controllers/wizard.js');
      await completeWizard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
