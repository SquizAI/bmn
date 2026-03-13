/**
 * Tier / Feature-Gate Middleware
 *
 * Factory that returns Express middleware to guard routes behind a
 * subscription tier or feature flag.
 *
 * @module middleware/require-tier
 */

/**
 * Tier hierarchy -- higher index = more privileged.
 * @type {readonly string[]}
 */
const TIER_HIERARCHY = /** @type {const} */ (['free', 'starter', 'pro', 'agency']);

/**
 * Map each feature to the minimum tier required to access it.
 * @type {Record<string, string>}
 */
const TIER_FEATURES = {
  'custom-domain':       'pro',
  'white-label':         'agency',
  'api-access':          'pro',
  'video-generation':    'pro',
  'advanced-analytics':  'starter',
  'priority-support':    'pro',
  'bulk-export':         'starter',
  'team-members':        'agency',
};

/**
 * Return the numeric rank for a tier string.
 * Unknown tiers are treated as rank 0 (free).
 *
 * @param {string} tier
 * @returns {number}
 */
function tierRank(tier) {
  const idx = TIER_HIERARCHY.indexOf(tier);
  return idx === -1 ? 0 : idx;
}

/**
 * Middleware factory: require a specific feature flag / tier capability.
 *
 * Reads `req.profile.subscription_tier` (set by the auth middleware) and
 * compares it against the minimum tier for the requested feature.
 * Admin and super_admin roles bypass all tier checks.
 *
 * @param {string} feature
 * @returns {import('express').RequestHandler}
 */
export function requireFeature(feature) {
  return (req, res, next) => {
    const profile = req.profile;

    // If there is no profile on the request the auth middleware hasn't run
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Admin / super_admin bypass all tier gates
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      return next();
    }

    const requiredTier = TIER_FEATURES[feature];

    // If the feature isn't in the map, allow access (un-gated feature)
    if (!requiredTier) {
      return next();
    }

    const userTier = profile.subscription_tier || 'free';
    const userRank = tierRank(userTier);
    const requiredRank = tierRank(requiredTier);

    if (userRank >= requiredRank) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Upgrade to ${requiredTier} plan to access this feature`,
    });
  };
}
