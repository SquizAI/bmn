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
const mockIlike = vi.fn();
const mockOr = vi.fn();
const mockNot = vi.fn();
const mockLimit = vi.fn();

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
  ilike: mockIlike,
  or: mockOr,
  not: mockNot,
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

describe('Admin Controller Integration', () => {
  /** @type {import('express').Request} */
  let req;
  /** @type {import('express').Response} */
  let res;
  /** @type {import('express').NextFunction} */
  let next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: 'admin-uuid-123', role: 'admin' },
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    next = vi.fn();

    for (const fn of Object.values(supabaseChain)) {
      fn.mockReturnValue(supabaseChain);
    }
  });

  describe('GET /admin/users (listUsers)', () => {
    it('should return paginated user list', async () => {
      const mockUsers = [
        { id: 'u1', email: 'alice@example.com', full_name: 'Alice', created_at: '2026-01-01' },
        { id: 'u2', email: 'bob@example.com', full_name: 'Bob', created_at: '2026-01-02' },
      ];

      mockRange.mockResolvedValueOnce({
        data: mockUsers,
        count: 2,
        error: null,
      });

      const { listUsers } = await import('../../controllers/admin.js');
      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: mockUsers,
            total: 2,
            page: 1,
            limit: 20,
          }),
        })
      );
    });

    it('should apply search filter when provided', async () => {
      req.query.search = 'alice';

      mockRange.mockResolvedValueOnce({
        data: [{ id: 'u1', email: 'alice@example.com' }],
        count: 1,
        error: null,
      });

      const { listUsers } = await import('../../controllers/admin.js');
      await listUsers(req, res, next);

      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('alice'));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should respect page and limit params', async () => {
      req.query.page = '2';
      req.query.limit = '10';

      mockRange.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      const { listUsers } = await import('../../controllers/admin.js');
      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            page: 2,
            limit: 10,
          }),
        })
      );
    });
  });

  describe('GET /admin/users/:userId (getUser)', () => {
    it('should return user profile with brand count', async () => {
      req.params.userId = 'u1';

      // First call: profile fetch
      mockSingle.mockResolvedValueOnce({
        data: { id: 'u1', email: 'alice@example.com', full_name: 'Alice' },
        error: null,
      });

      // Second call: brand count (head: true returns count only)
      // The neq chain ends with select (which resolves with count)
      mockNeq.mockResolvedValueOnce({ count: 5, error: null });

      const { getUser } = await import('../../controllers/admin.js');
      await getUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'u1',
            email: 'alice@example.com',
            brand_count: 5,
          }),
        })
      );
    });

    it('should return 404 for non-existent user', async () => {
      req.params.userId = 'non-existent';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getUser } = await import('../../controllers/admin.js');
      await getUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found',
        })
      );
    });
  });

  describe('GET /admin/brands (listAllBrands)', () => {
    it('should return all brands with pagination', async () => {
      const mockBrands = [
        { id: 'b1', name: 'Brand One', status: 'draft' },
        { id: 'b2', name: 'Brand Two', status: 'complete' },
      ];

      mockRange.mockResolvedValueOnce({
        data: mockBrands,
        count: 2,
        error: null,
      });

      const { listAllBrands } = await import('../../controllers/admin.js');
      await listAllBrands(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: mockBrands,
            total: 2,
          }),
        })
      );
    });

    it('should filter by status when provided', async () => {
      req.query.status = 'complete';

      mockRange.mockResolvedValueOnce({
        data: [{ id: 'b2', name: 'Brand Two', status: 'complete' }],
        count: 1,
        error: null,
      });

      const { listAllBrands } = await import('../../controllers/admin.js');
      await listAllBrands(req, res, next);

      expect(mockEq).toHaveBeenCalledWith('status', 'complete');
    });

    it('should filter by search when provided', async () => {
      req.query.search = 'Brand';

      mockRange.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      const { listAllBrands } = await import('../../controllers/admin.js');
      await listAllBrands(req, res, next);

      expect(mockIlike).toHaveBeenCalledWith('name', '%Brand%');
    });
  });

  describe('POST /admin/products (createProduct)', () => {
    it('should create a new product and return 201', async () => {
      const newProduct = {
        id: 'p-new',
        name: 'Premium Hoodie',
        category: 'apparel',
        base_price: 25,
        is_active: true,
      };

      req.body = {
        name: 'Premium Hoodie',
        category: 'apparel',
        base_price: 25,
      };

      mockSingle.mockResolvedValueOnce({ data: newProduct, error: null });

      const { createProduct } = await import('../../controllers/admin.js');
      await createProduct(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Premium Hoodie',
          }),
        })
      );
    });

    it('should call next on database error', async () => {
      req.body = { name: 'Fail Product', category: 'apparel' };
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      const { createProduct } = await import('../../controllers/admin.js');
      await createProduct(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('PATCH /admin/products/:productId (updateProduct)', () => {
    it('should update product and return updated data', async () => {
      req.params.productId = 'p1';
      req.body = { name: 'Updated Hoodie' };

      // Verify product exists
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'p1' }, error: null })
        // Update returns updated data
        .mockResolvedValueOnce({ data: { id: 'p1', name: 'Updated Hoodie' }, error: null });

      const { updateProduct } = await import('../../controllers/admin.js');
      await updateProduct(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Updated Hoodie',
          }),
        })
      );
    });

    it('should return 404 for non-existent product', async () => {
      req.params.productId = 'non-existent';
      req.body = { name: 'Updated' };
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { updateProduct } = await import('../../controllers/admin.js');
      await updateProduct(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /admin/products/:productId (disableProduct)', () => {
    it('should soft-delete product and return 204', async () => {
      req.params.productId = 'p1';
      mockEq.mockResolvedValueOnce({ error: null });

      const { disableProduct } = await import('../../controllers/admin.js');
      await disableProduct(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('POST /admin/templates (createTemplate)', () => {
    it('should create a packaging template and return 201', async () => {
      const newTemplate = {
        id: 't-new',
        slug: 'premium-box',
        name: 'Premium Box',
        category: 'box',
        is_active: true,
      };

      req.body = {
        slug: 'premium-box',
        name: 'Premium Box',
        category: 'box',
        template_image_url: 'https://cdn.example.com/box.png',
      };

      mockSingle.mockResolvedValueOnce({ data: newTemplate, error: null });

      const { createTemplate } = await import('../../controllers/admin.js');
      await createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            slug: 'premium-box',
          }),
        })
      );
    });

    it('should return 409 on duplicate slug', async () => {
      req.body = {
        slug: 'existing-slug',
        name: 'Duplicate',
        category: 'box',
      };

      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      const { createTemplate } = await import('../../controllers/admin.js');
      await createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('GET /admin/templates/:templateId (getTemplateAdmin)', () => {
    it('should return a single template', async () => {
      req.params.templateId = 't1';
      mockSingle.mockResolvedValueOnce({
        data: { id: 't1', slug: 'premium-box', name: 'Premium Box' },
        error: null,
      });

      const { getTemplateAdmin } = await import('../../controllers/admin.js');
      await getTemplateAdmin(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ slug: 'premium-box' }),
        })
      );
    });

    it('should return 404 for non-existent template', async () => {
      req.params.templateId = 'non-existent';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getTemplateAdmin } = await import('../../controllers/admin.js');
      await getTemplateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /admin/templates/:templateId (deleteTemplate)', () => {
    it('should soft-delete template and return 204', async () => {
      req.params.templateId = 't1';
      mockEq.mockResolvedValueOnce({ error: null });

      const { deleteTemplate } = await import('../../controllers/admin.js');
      await deleteTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('POST /admin/product-tiers (createProductTier)', () => {
    it('should create a product tier and return 201', async () => {
      const newTier = {
        id: 'tier-new',
        slug: 'premium',
        name: 'premium',
        display_name: 'Premium',
        is_active: true,
      };

      req.body = {
        slug: 'premium',
        name: 'premium',
        display_name: 'Premium',
        sort_order: 2,
      };

      mockSingle.mockResolvedValueOnce({ data: newTier, error: null });

      const { createProductTier } = await import('../../controllers/admin.js');
      await createProductTier(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            slug: 'premium',
          }),
        })
      );
    });

    it('should return 409 on duplicate slug', async () => {
      req.body = { slug: 'existing', name: 'existing', display_name: 'Existing' };

      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      const { createProductTier } = await import('../../controllers/admin.js');
      await createProductTier(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('GET /admin/product-tiers/:tierId (getProductTier)', () => {
    it('should return a tier with its products', async () => {
      req.params.tierId = 'tier1';

      // First call: fetch tier
      mockSingle.mockResolvedValueOnce({
        data: { id: 'tier1', slug: 'essential', display_name: 'Essential' },
        error: null,
      });

      // Second call: fetch products in tier
      mockOrder.mockResolvedValueOnce({
        data: [
          { id: 'p1', name: 'Hoodie', sku: 'SKU-001' },
          { id: 'p2', name: 'Mug', sku: 'SKU-002' },
        ],
        error: null,
      });

      const { getProductTier } = await import('../../controllers/admin.js');
      await getProductTier(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            slug: 'essential',
            products: expect.arrayContaining([
              expect.objectContaining({ name: 'Hoodie' }),
            ]),
          }),
        })
      );
    });

    it('should return 404 for non-existent tier', async () => {
      req.params.tierId = 'bad';
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const { getProductTier } = await import('../../controllers/admin.js');
      await getProductTier(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PATCH /admin/product-tiers/:tierId/assign (assignProductsToTier)', () => {
    it('should return 404 for non-existent tier', async () => {
      req.params.tierId = 'bad';
      req.body = { product_ids: ['p1'] };
      // tier lookup returns null
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const { assignProductsToTier } = await import('../../controllers/admin.js');
      await assignProductsToTier(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /admin/product-tiers/:tierId (deleteProductTier)', () => {
    it('should soft-delete tier and return 204', async () => {
      req.params.tierId = 'tier1';
      mockEq.mockResolvedValueOnce({ error: null });

      const { deleteProductTier } = await import('../../controllers/admin.js');
      await deleteProductTier(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
