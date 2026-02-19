// server/src/controllers/products.js

/**
 * GET /api/v1/products
 * List the product catalog with optional category filter and search.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listProducts(req, res) {
  // TODO: Implement -- query products from Supabase with pagination + filters
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/products/:productId
 * Get a single product by ID.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getProduct(req, res) {
  // TODO: Implement -- fetch product by ID from Supabase
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/products/categories
 * List all distinct product categories.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listCategories(req, res) {
  // TODO: Implement -- query distinct categories from products table
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}
