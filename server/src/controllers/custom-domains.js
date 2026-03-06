/**
 * Custom Domains & White-Label Controller (Agency Tier)
 *
 * Placeholder endpoints for custom domain management and white-label
 * configuration. All handlers return 501 until the feature is implemented.
 *
 * @module controllers/custom-domains
 */

/**
 * Add a custom domain to the user's storefront.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function addDomain(req, res, _next) {
  return res.status(501).json({ success: false, error: 'Custom domains are coming soon' });
}

/**
 * Get the current custom domain configuration.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function getDomain(req, res, _next) {
  return res.status(501).json({ success: false, error: 'Custom domains are coming soon' });
}

/**
 * Remove a custom domain from the user's storefront.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function removeDomain(req, res, _next) {
  return res.status(501).json({ success: false, error: 'Custom domains are coming soon' });
}

/**
 * Verify DNS configuration for a custom domain.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function verifyDomain(req, res, _next) {
  return res.status(501).json({ success: false, error: 'Custom domains are coming soon' });
}

/**
 * Get white-label settings for the user's storefront.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function getWhiteLabel(req, res, _next) {
  return res.status(501).json({ success: false, error: 'White-label configuration is coming soon' });
}

/**
 * Update white-label settings for the user's storefront.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export async function updateWhiteLabel(req, res, _next) {
  return res.status(501).json({ success: false, error: 'White-label configuration is coming soon' });
}
