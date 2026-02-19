// server/src/sockets/index.js

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import Redis from 'ioredis';

// NOTE: @socket.io/redis-adapter may need to be installed:
// npm install @socket.io/redis-adapter

/**
 * Reusable Socket.io JWT authentication middleware.
 * Verifies Supabase JWT and attaches user to socket.data.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Invalid or expired token'));
    }

    socket.data.user = user;
    next();
  } catch (err) {
    logger.error({ err: err.message, socketId: socket.id }, 'Socket.io auth error');
    next(new Error('Authentication failed'));
  }
}

/**
 * Admin-only auth middleware. Requires admin role in app_metadata.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
async function adminAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Invalid token'));
    }

    if (user.app_metadata?.role !== 'admin') {
      return next(new Error('Admin access required'));
    }

    socket.data.user = user;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
}

/**
 * Simple per-socket rate limiter.
 * Tracks event counts per socket and disconnects if exceeded.
 *
 * @param {import('socket.io').Socket} socket
 * @param {number} maxEventsPerSecond
 */
function attachRateLimiter(socket, maxEventsPerSecond = 30) {
  let eventCount = 0;
  let lastReset = Date.now();

  const originalEmit = socket.onevent?.bind(socket);
  if (!originalEmit) return;

  socket.onevent = function (packet) {
    const now = Date.now();
    if (now - lastReset > 1000) {
      eventCount = 0;
      lastReset = now;
    }

    eventCount++;
    if (eventCount > maxEventsPerSecond) {
      logger.warn({
        socketId: socket.id,
        userId: socket.data.user?.id,
        eventCount,
      }, 'Socket rate limit exceeded, disconnecting');
      socket.disconnect(true);
      return;
    }

    originalEmit.call(this, packet);
  };
}

/** Connection counter for monitoring */
const connectionCounts = {
  default: 0,
  wizard: 0,
  dashboard: 0,
  admin: 0,
};

/**
 * Create and configure the Socket.io server.
 *
 * - Attaches to the raw HTTP server (shared with Express)
 * - Redis adapter for multi-process support
 * - JWT authentication on handshake
 * - Namespace registration for wizard, dashboard, admin
 * - Per-socket rate limiting
 * - Connection counting
 * - CORS configuration from env
 *
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // -- Redis Adapter for multi-process support --
  try {
    const pubClient = redis;
    const subClient = new Redis({
      host: redis.options.host,
      port: redis.options.port,
      password: redis.options.password,
      db: redis.options.db,
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });

    subClient.on('error', (err) => {
      logger.error({ err }, 'Socket.io Redis subscriber error');
    });

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter attached');
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to attach Socket.io Redis adapter, falling back to in-memory');
  }

  // ==========================================================================
  // Default namespace
  // ==========================================================================
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    connectionCounts.default++;

    logger.info({
      socketId: socket.id,
      userId,
      connections: connectionCounts,
    }, 'Socket connected');

    if (userId) {
      socket.join(`user:${userId}`);
    }

    attachRateLimiter(socket);

    socket.on('disconnect', (reason) => {
      connectionCounts.default--;
      logger.info({
        socketId: socket.id,
        userId,
        reason,
        connections: connectionCounts,
      }, 'Socket disconnected');
    });
  });

  // ==========================================================================
  // Wizard namespace (generation progress)
  // ==========================================================================
  const wizardNs = io.of('/wizard');
  wizardNs.use(socketAuthMiddleware);

  wizardNs.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    connectionCounts.wizard++;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    attachRateLimiter(socket);

    // Join a brand room for brand-specific events
    socket.on('join:brand', (brandId) => {
      if (typeof brandId === 'string' && brandId.length > 0) {
        socket.join(`brand:${brandId}`);
        logger.debug({ socketId: socket.id, userId, brandId }, 'Joined brand room');
      }
    });

    socket.on('leave:brand', (brandId) => {
      if (typeof brandId === 'string' && brandId.length > 0) {
        socket.leave(`brand:${brandId}`);
        logger.debug({ socketId: socket.id, userId, brandId }, 'Left brand room');
      }
    });

    // Join a job room for job-specific progress tracking
    socket.on('join:job', (jobId) => {
      if (typeof jobId === 'string' && jobId.length > 0) {
        socket.join(`job:${jobId}`);
        logger.debug({ socketId: socket.id, userId, jobId }, 'Joined job room');
      }
    });

    socket.on('leave:job', (jobId) => {
      if (typeof jobId === 'string' && jobId.length > 0) {
        socket.leave(`job:${jobId}`);
        logger.debug({ socketId: socket.id, userId, jobId }, 'Left job room');
      }
    });

    socket.on('disconnect', () => {
      connectionCounts.wizard--;
    });
  });

  // ==========================================================================
  // Dashboard namespace (brand updates)
  // ==========================================================================
  const dashboardNs = io.of('/dashboard');
  dashboardNs.use(socketAuthMiddleware);

  dashboardNs.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    connectionCounts.dashboard++;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    attachRateLimiter(socket);

    // Join a brand room for brand-specific dashboard updates
    socket.on('join:brand', (brandId) => {
      if (typeof brandId === 'string' && brandId.length > 0) {
        socket.join(`brand:${brandId}`);
      }
    });

    socket.on('leave:brand', (brandId) => {
      if (typeof brandId === 'string' && brandId.length > 0) {
        socket.leave(`brand:${brandId}`);
      }
    });

    socket.on('disconnect', () => {
      connectionCounts.dashboard--;
    });
  });

  // ==========================================================================
  // Admin namespace (system events)
  // ==========================================================================
  const adminNs = io.of('/admin');
  adminNs.use(adminAuthMiddleware);

  adminNs.on('connection', (socket) => {
    connectionCounts.admin++;
    socket.join('admin');

    attachRateLimiter(socket);

    // Emit current connection stats to admin
    socket.emit('job:stats', {
      connections: { ...connectionCounts },
      timestamp: Date.now(),
    });

    socket.on('disconnect', () => {
      connectionCounts.admin--;
    });
  });

  // Periodically emit stats to admin namespace (every 30 seconds)
  setInterval(() => {
    if (connectionCounts.admin > 0) {
      adminNs.to('admin').emit('job:stats', {
        connections: { ...connectionCounts },
        timestamp: Date.now(),
      });
    }
  }, 30_000);

  logger.info('Socket.io server initialized with Redis adapter, rate limiting, and job room support');

  return io;
}
