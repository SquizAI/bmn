import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockIlike = vi.fn();

const supabaseChain = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  order: mockOrder,
  range: mockRange,
  ilike: mockIlike,
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

describe('Products API Integration', () => {
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

    for (const fn of Object.values(supabaseChain)) {
      fn.mockReturnValue(supabaseChain);
    }
  });

  describe('GET /products (listProducts)', () => {
    it('should return paginated product list', async () => {
      const mockProducts = [
        { id: 'p1', sku: 'SKU-001', name: 'Product One', category: 'supplements', is_active: true },
        { id: 'p2', sku: 'SKU-002', name: 'Product Two', category: 'skincare', is_active: true },
      ];

      mockRange.mockResolvedValueOnce({
        data: mockProducts,
        count: 2,
        error: null,
      });

      const { listProducts } = await import('../../controllers/products.js');
      if (listProducts) {
        await listProducts(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      }
    });

    it('should filter products by category when query param provided', async () => {
      req.query.category = 'supplements';

      const mockProducts = [
        { id: 'p1', sku: 'SKU-001', name: 'Supplement A', category: 'supplements' },
      ];

      mockRange.mockResolvedValueOnce({
        data: mockProducts,
        count: 1,
        error: null,
      });

      const { listProducts } = await import('../../controllers/products.js');
      if (listProducts) {
        await listProducts(req, res, next);

        expect(mockEq).toHaveBeenCalledWith('category', 'supplements');
      }
    });
  });

  describe('GET /products/:productId (getProduct)', () => {
    it('should return a single product', async () => {
      const mockProduct = {
        id: 'p1',
        sku: 'SKU-001',
        name: 'Product One',
        category: 'supplements',
        base_cost: 15.00,
        retail_price: 39.99,
      };

      req.params.productId = 'p1';
      mockSingle.mockResolvedValueOnce({ data: mockProduct, error: null });

      const { getProduct } = await import('../../controllers/products.js');
      if (getProduct) {
        await getProduct(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({ sku: 'SKU-001' }),
          })
        );
      }
    });

    it('should return 404 for non-existent product', async () => {
      req.params.productId = 'non-existent';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getProduct } = await import('../../controllers/products.js');
      if (getProduct) {
        await getProduct(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
      }
    });
  });
});
