// server/src/controllers/brands.js

/**
 * GET /api/v1/brands
 * List all brands for the authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listBrands(req, res) {
  // TODO: Implement via brand service -- query user's brands from Supabase
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/brands
 * Create a new brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createBrand(req, res) {
  // TODO: Implement via brand service -- insert brand into Supabase
  res.status(201).json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/brands/:brandId
 * Get a single brand by ID (scoped to authenticated user).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getBrand(req, res) {
  // TODO: Implement via brand service -- fetch brand by ID + user_id
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * PATCH /api/v1/brands/:brandId
 * Update a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function updateBrand(req, res) {
  // TODO: Implement via brand service -- update brand in Supabase
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * DELETE /api/v1/brands/:brandId
 * Delete a brand and all its assets.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function deleteBrand(req, res) {
  // TODO: Implement via brand service -- soft delete brand + cascade assets
  res.status(204).end();
}

/**
 * GET /api/v1/brands/:brandId/assets
 * List all assets for a brand (logos, mockups, bundles).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listBrandAssets(req, res) {
  // TODO: Implement via brand service -- query logos, mockups, bundles for brand
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/brands/:brandId/generate/logos
 * Queue logo generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function generateLogos(req, res) {
  // TODO: Implement -- check credits, queue BullMQ job, return jobId
  res.status(202).json({
    success: true,
    data: { message: 'Not implemented yet' },
  });
}

/**
 * POST /api/v1/brands/:brandId/generate/mockups
 * Queue mockup generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function generateMockups(req, res) {
  // TODO: Implement -- check credits, queue BullMQ job, return jobId
  res.status(202).json({
    success: true,
    data: { message: 'Not implemented yet' },
  });
}
