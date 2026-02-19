// server/src/routes/health.js

import { Router } from 'express';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { Queue } from 'bullmq';
import { config } from '../config/index.js';

export const healthRoute = Router();

/**
 * GET /health
 *
 * Comprehensive health check endpoint.
 *
 * Checks:
 * 1. Express server is running (implicit)
 * 2. Redis is connected (PING)
 * 3. Supabase is accessible (lightweight query)
 * 4. BullMQ queues are accessible (queue connection check)
 *
 * Returns 200 if healthy, 503 if unhealthy.
 */
healthRoute.get('/', async (_req, res) => {
  const startTime = Date.now();
  const checks = {};
  let overallStatus = 'healthy';

  // Check 1: Express (implicit -- always up if we reach here)
  checks.express = {
    status: 'up',
    responseTime: 0,
  };

  // Check 2: Redis
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.redis = {
      status: pong === 'PONG' ? 'up' : 'down',
      responseTime: Date.now() - redisStart,
    };
  } catch (err) {
    checks.redis = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'degraded';
  }

  // Check 3: Supabase
  try {
    const supaStart = Date.now();
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    checks.supabase = {
      status: error ? 'down' : 'up',
      responseTime: Date.now() - supaStart,
      ...(error && { error: error.message }),
    };

    if (error) overallStatus = 'degraded';
  } catch (err) {
    checks.supabase = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'unhealthy';
  }

  // Check 4: BullMQ Queues
  try {
    const bullStart = Date.now();
    const testQueue = new Queue('health-check', {
      connection: { url: config.REDIS_URL },
    });

    await testQueue.getJobCounts();
    await testQueue.close();

    checks.bullmq = {
      status: 'up',
      responseTime: Date.now() - bullStart,
    };
  } catch (err) {
    checks.bullmq = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '2.0.0',
    environment: config.NODE_ENV,
    checks,
    totalResponseTime: Date.now() - startTime,
  };

  if (overallStatus !== 'healthy') {
    logger.warn({
      msg: 'Health check degraded',
      status: overallStatus,
      checks,
    });
  }

  res.status(statusCode).json(response);
});
