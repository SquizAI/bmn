// server/src/lib/redis.js

import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Shared Redis client.
 *
 * Used by:
 * - BullMQ (job queue)
 * - express-rate-limit (distributed rate limiting)
 * - Cache layer (API responses, AI results)
 * - Socket.io adapter (multi-instance pub/sub)
 *
 * Reconnects automatically on connection loss.
 */
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error({ msg: 'Redis connection failed after 10 retries' });
      return null;
    }
    return Math.min(times * 200, 5000);
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info({ msg: 'Redis connected' });
});

redis.on('error', (err) => {
  logger.error({ msg: 'Redis error', error: err.message });
});

redis.on('close', () => {
  logger.warn({ msg: 'Redis connection closed' });
});
