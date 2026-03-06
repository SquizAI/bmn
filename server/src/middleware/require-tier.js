/**
 * Tier / Feature-Gate Middleware
 *
 * Factory that returns Express middleware to guard routes behind a
 * subscription tier or feature flag. Currently a pass-through stub;
 * real checks will be wired up when Stripe billing lands (Phase 4).
 *
 * @module middleware/require-tier
 */

/**
 * Middleware factory: require a specific feature flag / tier capability.
 * @param {string} feature
 * @returns {import('express').RequestHandler}
 */
export function requireFeature(feature) {
  return (req, res, next) => {
    // TODO: Check user subscription tier for feature access
    // For now, pass through — tier gating will be implemented with Stripe billing
    next();
  };
}
