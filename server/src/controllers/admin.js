// server/src/controllers/admin.js

/**
 * GET /api/v1/admin/users
 * List all users with pagination and search.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listUsers(req, res) {
  // TODO: Implement -- query profiles table with pagination
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/admin/users/:userId
 * Get detailed user info including brands and subscription.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getUser(req, res) {
  // TODO: Implement -- fetch user profile + brands + subscription
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/admin/brands
 * List all brands across all users with pagination and filters.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listAllBrands(req, res) {
  // TODO: Implement -- query all brands (admin bypasses RLS)
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/admin/products
 * Create a new product in the catalog.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createProduct(req, res) {
  // TODO: Implement -- insert product into products table
  res.status(201).json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * PATCH /api/v1/admin/products/:productId
 * Update an existing product.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function updateProduct(req, res) {
  // TODO: Implement -- update product in products table
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * DELETE /api/v1/admin/products/:productId
 * Disable a product (soft delete).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function disableProduct(req, res) {
  // TODO: Implement -- set is_active = false on product
  res.status(204).end();
}

/**
 * GET /api/v1/admin/jobs
 * Get BullMQ job queue status and counts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getJobStatus(req, res) {
  // TODO: Implement -- query BullMQ queue stats
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/admin/metrics
 * Get system metrics (costs, generation counts, user counts).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getMetrics(req, res) {
  // TODO: Implement -- aggregate metrics from generation_jobs + credit_transactions
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}
