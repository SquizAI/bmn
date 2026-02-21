// server/src/sockets/index.js

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import Redis from 'ioredis';
import { runChatAgent } from '../agents/chat/index.js';

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
  chat: 0,
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

  // ==========================================================================
  // Chat namespace (agentic sidebar chat)
  // ==========================================================================
  const chatNs = io.of('/chat');
  chatNs.use(socketAuthMiddleware);

  chatNs.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    connectionCounts.chat++;

    if (userId) {
      socket.join(`chat:${userId}`);
    }

    attachRateLimiter(socket);

    // Active agent abort controllers per session (for cancellation)
    const activeAgents = new Map();

    // ---- chat:send — Main message handler ----
    socket.on('chat:send', async (payload) => {
      const { content, sessionId, brandId, pageContext } = payload || {};

      if (!content || !sessionId || !userId) {
        socket.emit('chat:error', { sessionId, error: 'Missing content or sessionId', code: 'INVALID_PAYLOAD' });
        return;
      }

      try {
        // 1. Fetch user profile + org role
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, role, org_id, subscription_tier')
          .eq('id', userId)
          .single();

        if (!profile) {
          socket.emit('chat:error', { sessionId, error: 'Profile not found', code: 'AUTH_ERROR' });
          return;
        }

        let orgRole = null;
        if (profile.org_id) {
          const { data: membership } = await supabaseAdmin
            .from('organization_members')
            .select('role')
            .eq('org_id', profile.org_id)
            .eq('user_id', userId)
            .single();
          orgRole = membership?.role || null;
        }

        // 2. Load brand context if provided
        let activeBrand = null;
        if (brandId) {
          const { data: brand } = await supabaseAdmin
            .from('brands')
            .select('id, name, status, wizard_step, wizard_state')
            .eq('id', brandId)
            .single();
          activeBrand = brand;
        }

        // 3. Load recent history for context (last 20 messages)
        const { data: historyRows } = await supabaseAdmin
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(20);

        // 4. Save user message to DB
        await supabaseAdmin.from('chat_messages').insert({
          brand_id: brandId || null,
          session_id: sessionId,
          role: 'user',
          content,
          message_type: 'text',
          page_context: pageContext ? JSON.stringify(pageContext) : null,
        });

        // Update session metadata
        await supabaseAdmin
          .from('chat_sessions')
          .upsert({
            id: sessionId,
            user_id: userId,
            brand_id: brandId || null,
            message_count: (historyRows?.length || 0) + 1,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        // 5. Emit message-start
        const messageId = crypto.randomUUID();
        socket.emit('chat:message-start', { messageId, sessionId });

        // 6. Run the chat agent and stream results
        let fullContent = '';
        let tokensUsed = 0;

        const abortController = new AbortController();
        activeAgents.set(sessionId, abortController);

        try {
          const agentStream = runChatAgent({
            userId,
            sessionId,
            message: content,
            profile,
            orgRole,
            activeBrand,
            pageContext: pageContext?.route || '',
            history: historyRows || [],
            io,
          });

          for await (const msg of agentStream) {
            if (abortController.signal.aborted) break;

            if (msg.type === 'assistant' && msg.message?.content) {
              // Text content from the assistant
              for (const block of msg.message.content) {
                if (block.type === 'text') {
                  socket.emit('chat:message-delta', { messageId, delta: block.text });
                  fullContent += block.text;
                }
              }
            } else if (msg.type === 'result' && msg.subtype === 'success') {
              tokensUsed = msg.total_usage?.output_tokens || 0;

              // Check if any tools modified brand data
              if (activeBrand?.id) {
                socket.emit('chat:brand-updated', {
                  brandId: activeBrand.id,
                  fields: ['wizard_state', 'name', 'brand_products'],
                });
              }
            }
          }
        } finally {
          activeAgents.delete(sessionId);
        }

        // 7. Emit message-end
        socket.emit('chat:message-end', {
          messageId,
          content: fullContent,
          model: 'claude-sonnet-4-6',
          tokensUsed,
        });

        // 8. Save assistant response to DB
        if (fullContent) {
          await supabaseAdmin.from('chat_messages').insert({
            brand_id: brandId || null,
            session_id: sessionId,
            role: 'assistant',
            content: fullContent,
            message_type: 'text',
            model_used: 'claude-sonnet-4-6',
            tokens_used: tokensUsed,
          });
        }
      } catch (err) {
        logger.error({ err: err.message, userId, sessionId }, 'Chat agent error');
        socket.emit('chat:error', {
          sessionId,
          error: 'An error occurred while processing your message. Please try again.',
          code: 'AGENT_ERROR',
        });
      }
    });

    // ---- chat:cancel — Cancel streaming response ----
    socket.on('chat:cancel', ({ sessionId }) => {
      const controller = activeAgents.get(sessionId);
      if (controller) {
        controller.abort();
        activeAgents.delete(sessionId);
        logger.info({ sessionId, userId }, 'Chat stream cancelled');
      }
    });

    // ---- chat:history — Load message history ----
    socket.on('chat:history', async ({ sessionId, before }, callback) => {
      const query = supabaseAdmin
        .from('chat_messages')
        .select('id, role, content, message_type, metadata, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (before) query.lt('created_at', before);

      const { data, error } = await query;
      if (typeof callback === 'function') {
        callback({ messages: data?.reverse() || [], error: error?.message || null });
      }
    });

    // ---- chat:new-session — Start a fresh session ----
    socket.on('chat:new-session', async ({ brandId }, callback) => {
      const sessionId = crypto.randomUUID();

      await supabaseAdmin.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        brand_id: brandId || null,
      });

      if (typeof callback === 'function') {
        callback({ sessionId });
      }
    });

    socket.on('disconnect', () => {
      connectionCounts.chat--;
      // Clean up any active agents
      for (const controller of activeAgents.values()) {
        controller.abort();
      }
      activeAgents.clear();
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
