import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin before importing controller
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIn = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

const supabaseChain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  neq: mockNeq,
  in: mockIn,
  single: mockSingle,
  order: mockOrder,
  range: mockRange,
};

// Each method returns the chain for fluent calls
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

describe('Brands API Integration', () => {
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
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();

    // Reset chain
    for (const fn of Object.values(supabaseChain)) {
      fn.mockReturnValue(supabaseChain);
    }
  });

  describe('GET /brands (listBrands)', () => {
    it('should return paginated brand list for user', async () => {
      const mockBrands = [
        { id: 'b1', name: 'Brand One', status: 'draft', created_at: '2026-01-01', wizard_state: {} },
        { id: 'b2', name: 'Brand Two', status: 'complete', created_at: '2026-02-01', wizard_state: {} },
      ];

      // Query 1 terminal: .range() resolves with brands
      mockRange.mockResolvedValueOnce({
        data: mockBrands,
        count: 2,
        error: null,
      });

      // order() is called twice: once in query 1 (needs to return chain), once in query 2 (terminal)
      mockOrder
        .mockReturnValueOnce(supabaseChain)
        .mockResolvedValueOnce({ data: [], error: null });

      const { listBrands } = await import('../../controllers/brands.js');
      await listBrands(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 2,
          }),
        })
      );
    });
  });

  describe('GET /brands/:brandId (getBrand)', () => {
    it('should return a single brand by ID', async () => {
      const mockBrand = {
        id: 'b1',
        name: 'Test Brand',
        status: 'draft',
        wizard_state: {},
      };

      req.params.brandId = 'b1';
      mockSingle.mockResolvedValueOnce({ data: mockBrand, error: null });

      const { getBrand } = await import('../../controllers/brands.js');
      await getBrand(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'b1' }),
        })
      );
    });

    it('should return 404 for non-existent brand', async () => {
      req.params.brandId = 'non-existent';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getBrand } = await import('../../controllers/brands.js');
      await getBrand(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /brands (createBrand)', () => {
    it('should create a new brand and return 201', async () => {
      const newBrand = { id: 'b-new', name: 'New Brand', status: 'draft' };

      req.body = { name: 'New Brand' };
      req.profile = { org_id: 'org-uuid-123' };
      mockSingle.mockResolvedValueOnce({ data: newBrand, error: null });

      const { createBrand } = await import('../../controllers/brands.js');
      await createBrand(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ name: 'New Brand' }),
        })
      );
    });
  });

  describe('PATCH /brands/:brandId (updateBrand)', () => {
    it('should update brand fields', async () => {
      const updatedBrand = { id: 'b1', name: 'Updated Brand', status: 'draft' };

      req.params.brandId = 'b1';
      req.body = { name: 'Updated Brand' };
      // single() is called twice: ownership check, then actual update
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'b1' }, error: null })
        .mockResolvedValueOnce({ data: updatedBrand, error: null });

      const { updateBrand } = await import('../../controllers/brands.js');
      await updateBrand(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ name: 'Updated Brand' }),
        })
      );
    });
  });
});
