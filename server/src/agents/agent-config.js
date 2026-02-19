// server/src/agents/agent-config.js

import { Sentry } from '../lib/sentry.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Build lifecycle hooks for a Brand Wizard agent session.
 * Hooks integrate the agent with Socket.io (real-time progress),
 * Sentry (error tracking), pino (structured logging), and
 * BullMQ (job progress updates).
 *
 * @param {Object} context
 * @param {import('socket.io').Server} context.io - Socket.io server instance
 * @param {string} context.room - Socket.io room (e.g., "brand:{brandId}")
 * @param {string} context.userId - The user running this session
 * @param {string} context.brandId - The brand being built
 * @param {import('bullmq').Job} context.job - The BullMQ job instance
 * @returns {Object} Lifecycle hooks object for the Agent SDK
 */
export function buildAgentHooks({ io, room, userId, brandId, job }) {
  /** @type {number} Tool call counter for progress calculation */
  let toolCallCount = 0;

  /** @type {number} Running cost accumulator in USD */
  let sessionCostUsd = 0;

  return {
    /**
     * SessionStart -- fires when the agent session begins.
     * Log the session start, emit Socket.io event.
     */
    SessionStart: ({ sessionId }) => {
      logger.info({ sessionId, userId, brandId }, 'Agent session started');
      io.to(room).emit('agent:session-start', { sessionId, brandId });
    },

    /**
     * PreToolUse -- fires BEFORE each tool execution.
     * Used for: rate limit checks, logging, cost guard rails.
     * Return { decision: 'block', message: '...' } to prevent execution.
     */
    PreToolUse: async ({ toolName, toolInput, sessionId }) => {
      toolCallCount++;
      logger.info(
        { toolName, toolInput, sessionId, callNumber: toolCallCount },
        'Tool call starting'
      );

      // Emit progress to client
      io.to(room).emit('agent:tool-start', {
        tool: toolName,
        callNumber: toolCallCount,
        timestamp: Date.now(),
      });

      // Update BullMQ job progress
      await job.updateProgress({
        currentTool: toolName,
        toolCallCount,
        timestamp: Date.now(),
      });

      // Cost guard: if we've somehow exceeded budget outside SDK tracking, block
      if (sessionCostUsd > 2.50) {
        logger.warn({ sessionCostUsd, sessionId }, 'Manual cost guard triggered');
        return {
          decision: 'block',
          message: 'Session cost limit exceeded. Please try again.',
        };
      }

      return { decision: 'allow' };
    },

    /**
     * PostToolUse -- fires AFTER each successful tool execution.
     * Emit Socket.io progress, track costs, update job.
     */
    PostToolUse: async ({ toolName, toolInput, toolResult, sessionId }) => {
      logger.info(
        { toolName, sessionId, resultSize: JSON.stringify(toolResult).length },
        'Tool call completed'
      );

      // Calculate approximate progress percentage based on typical wizard flows
      const progressMap = {
        'validateInput': 5,
        'checkCredits': 10,
        'social-analyzer': 30,
        'brand-generator': 50,
        'saveBrandData': 55,
        'logo-creator': 75,
        'mockup-renderer': 85,
        'profit-calculator': 90,
        'deductCredit': 92,
        'queueCRMSync': 95,
        'sendEmail': 98,
      };

      const progress = progressMap[toolName] || Math.min(toolCallCount * 10, 95);

      io.to(room).emit('agent:tool-complete', {
        tool: toolName,
        progress,
        result: sanitizeResultForClient(toolResult),
        timestamp: Date.now(),
      });

      await job.updateProgress({ progress, lastTool: toolName });
    },

    /**
     * PostToolUseFailure -- fires when a tool execution throws.
     * Log to Sentry, emit error to client, attempt graceful degradation.
     */
    PostToolUseFailure: async ({ toolName, toolInput, error, sessionId }) => {
      logger.error(
        { toolName, toolInput, error: error.message, sessionId },
        'Tool call failed'
      );

      Sentry.captureException(error, {
        tags: { toolName, sessionId, userId, brandId },
        extra: { toolInput },
      });

      io.to(room).emit('agent:tool-error', {
        tool: toolName,
        error: error.message,
        recoverable: isRecoverableError(error),
        timestamp: Date.now(),
      });
    },

    /**
     * SessionEnd -- fires when the agent session completes (success or failure).
     * Save session state, cleanup, emit final event.
     */
    SessionEnd: async ({ sessionId, totalCostUsd, turnCount, reason }) => {
      logger.info(
        { sessionId, totalCostUsd, turnCount, reason },
        'Agent session ended'
      );

      // Persist session cost to audit log
      await supabaseAdmin.from('audit_log').insert({
        user_id: userId,
        action: 'agent_session_complete',
        resource_type: 'brand',
        resource_id: brandId,
        metadata: { sessionId, totalCostUsd, turnCount, reason },
      });

      io.to(room).emit('agent:session-end', {
        sessionId,
        cost: totalCostUsd,
        turns: turnCount,
        reason,
      });
    },
  };
}

/**
 * Strip sensitive data from tool results before sending to client.
 * Never leak API keys, internal URLs, or raw error stacks.
 * @param {unknown} result
 * @returns {unknown}
 */
export function sanitizeResultForClient(result) {
  if (!result || typeof result !== 'object') return result;
  const sanitized = { ...result };
  // Remove fields that should never reach the client
  delete sanitized.apiKey;
  delete sanitized.internalUrl;
  delete sanitized.stackTrace;
  delete sanitized.rawResponse;
  return sanitized;
}

/**
 * Determine if an error is recoverable (agent should retry)
 * vs fatal (agent should stop and report).
 * @param {Error} error
 * @returns {boolean}
 */
export function isRecoverableError(error) {
  const recoverablePatterns = [
    'rate limit', 'timeout', 'ECONNRESET', 'ENOTFOUND',
    '429', '503', '502', 'temporarily unavailable',
  ];
  const msg = error.message.toLowerCase();
  return recoverablePatterns.some((p) => msg.includes(p));
}
