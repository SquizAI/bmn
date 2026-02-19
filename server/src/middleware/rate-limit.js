// server/src/middleware/rate-limit.js

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import { RateLimitError } from '../utils/errors.js';

/**
 * Tier-based rate limits per 15-minute window.
 * Used by the general API limiter when useTierLimits is enabled.
 */
const TIER_LIMITS = {
  free: 100,
  starter: 300,
  pro: 1000,
  agency: 3000,
};

/**
 * Create a Redis-backed rate limit store.
 * Uses the shared Redis connection for distributed rate limiting
 * across multiple server instances (K8s pods).
 *
 * @param {string} [prefix='bmn:rl:']
 * @returns {RedisStore}
 */
function createRedisStore(prefix = 'bmn:rl:') {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix,
  });
}

/**
 * Factory to create a rate limiter with configurable options.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Default max requests per window
 * @param {string} [options.message='Too many requests. Please slow down.']
 * @param {string} [options.prefix='bmn:rl:'] - Redis key prefix
 * @param {boolean} [options.useTierLimits=false] - Use subscription tier-based limits
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 * @param {(req: import('express').Request) => boolean} [options.skip]
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createLimiter({
  windowMs,
  max,
  message = 'Too many requests. Please slow down.',
  prefix = 'bmn:rl:',
  useTierLimits = false,
  keyGenerator,
  skip,
}) {
  return rateLimit({
    store: config.isDev ? undefined : createRedisStore(prefix),
    windowMs,
    max: useTierLimits
      ? (req) => {
          // super_admin bypasses rate limits
          if (req.profile?.role === 'super_admin') {
            return 0; // 0 = unlimited
          }
          const tier = req.profile?.subscription_tier || 'free';
          return TIER_LIMITS[tier] || TIER_LIMITS.free;
        }
      : max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.user?.id || req.ip),
    handler: (_req, _res, next) => {
      next(new RateLimitError(message));
    },
    skip: skip || (() => false),
  });
}

/**
 * General API rate limiter.
 * Uses subscription tier-based limits per 15-minute window.
 * Super admins bypass rate limiting entirely.
 */
export const generalLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: TIER_LIMITS.free,
  useTierLimits: true,
  prefix: 'bmn:rl:general:',
  message: 'Too many requests. Please slow down.',
  skip: (req) => req.path === '/health',
});

/**
 * AI generation rate limiter.
 * 5 requests per minute per user -- AI generation is expensive.
 */
export const generationLimiter = createLimiter({
  windowMs: 60_000,
  max: 5,
  prefix: 'bmn:rl:gen:',
  message: 'Generation rate limit exceeded. Please wait before generating again.',
});

/**
 * Auth endpoint rate limiter.
 * 10 attempts per 15 minutes per IP -- prevents brute force.
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  prefix: 'bmn:rl:auth:',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => req.ip,
});

/**
 * Webhook rate limiter.
 * 200 requests per minute per IP -- Stripe/GHL may burst.
 */
export const webhookLimiter = createLimiter({
  windowMs: 60_000,
  max: 200,
  prefix: 'bmn:rl:webhook:',
  message: 'Webhook rate limit exceeded.',
  keyGenerator: (req) => req.ip,
});
