// server/src/index.js

// Sentry MUST be initialized before everything else
import { initSentry, Sentry } from './lib/sentry.js';
initSentry();

import http from 'node:http';
import { createApp } from './app.js';
import { createSocketServer } from './sockets/index.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { initQueues, shutdownQueues } from './queues/index.js';
import { initWorkers, shutdownWorkers } from './workers/index.js';
import { initializeSkillRegistry } from './skills/_shared/tool-registry.js';

/**
 * Boot the server.
 * Order matters:
 * 1. Config is already validated on import (crashes if invalid)
 * 2. Sentry is already initialized on import
 * 3. Create Express app with full middleware chain
 * 4. Create HTTP server (shared between Express and Socket.io)
 * 5. Attach Socket.io to the HTTP server
 * 6. Initialize BullMQ queues
 * 7. Start BullMQ workers
 * 8. Listen on configured port
 */
async function main() {
  // Step 1: Create Express application
  const app = createApp();

  // Step 2: Create raw HTTP server (shared with Socket.io)
  const server = http.createServer(app);

  // Step 3: Attach Socket.io to the HTTP server
  const io = createSocketServer(server);

  // Make io accessible to route handlers via app.locals
  app.locals.io = io;

  // Step 4: Initialize skill registry (discover subagent modules)
  await initializeSkillRegistry();

  // Step 5: Initialize BullMQ queues (must be before workers)
  initQueues();

  // Step 6: Start BullMQ workers (logo gen, mockup gen, CRM sync, etc.)
  initWorkers(io);

  // Step 7: Start listening
  server.listen(config.PORT, () => {
    logger.info({
      msg: 'Server started',
      port: config.PORT,
      env: config.NODE_ENV,
      pid: process.pid,
    });
  });

  // Step 8: Register graceful shutdown
  registerShutdownHandlers(server, io);
}

/**
 * Graceful shutdown handler.
 * Closes connections in reverse order of creation:
 * 1. Stop accepting new connections
 * 2. Close Socket.io connections
 * 3. Close Redis connection
 * 4. Flush Sentry events
 * 5. Exit
 *
 * @param {http.Server} server
 * @param {import('socket.io').Server} io
 */
function registerShutdownHandlers(server, io) {
  /** @type {boolean} */
  let isShuttingDown = false;

  /**
   * @param {string} signal
   */
  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ msg: 'Shutdown initiated', signal });

    // Give in-flight requests 10 seconds to complete
    const forceTimeout = setTimeout(() => {
      logger.error({ msg: 'Forced shutdown after timeout' });
      process.exit(1);
    }, 10_000);

    try {
      // 1. Stop accepting new HTTP connections
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info({ msg: 'HTTP server closed' });

      // 2. Shut down BullMQ workers (wait for active jobs)
      await shutdownWorkers();
      logger.info({ msg: 'BullMQ workers shut down' });

      // 3. Shut down BullMQ queues
      await shutdownQueues();
      logger.info({ msg: 'BullMQ queues shut down' });

      // 4. Disconnect all Socket.io clients
      io.disconnectSockets(true);
      logger.info({ msg: 'Socket.io connections closed' });

      // 5. Close Redis connection
      await redis.quit();
      logger.info({ msg: 'Redis connection closed' });

      // 6. Flush Sentry events (2-second timeout)
      await Sentry.close(2000);
      logger.info({ msg: 'Sentry flushed' });

      clearTimeout(forceTimeout);
      logger.info({ msg: 'Graceful shutdown complete' });
      process.exit(0);
    } catch (err) {
      logger.error({ msg: 'Shutdown error', error: err.message });
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Process-level error handlers -- catch anything that slips through
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled promise rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal({
    msg: 'Uncaught exception -- shutting down',
    error: error.message,
    stack: error.stack,
  });
  Sentry.captureException(error);

  // Uncaught exceptions leave the process in an undefined state.
  // Flush Sentry and exit.
  Sentry.close(2000).finally(() => process.exit(1));
});

// Boot
main().catch((err) => {
  logger.fatal({ msg: 'Failed to start server', error: err.message, stack: err.stack });
  process.exit(1);
});
