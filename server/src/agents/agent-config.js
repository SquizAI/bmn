// server/src/agents/agent-config.js
//
// Builds lifecycle hooks for the Brand Wizard agent session.
// Uses the Agent SDK's hook format:
//   hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>
//
// Each HookCallbackMatcher = { matcher?: string, hooks: HookCallback[], timeout?: number }
// Each HookCallback = (input: HookInput, toolUseID, { signal }) => Promise<HookJSONOutput>
//
// Hook inputs use snake_case: tool_name, tool_input, tool_use_id, etc.
// Hook outputs return SyncHookJSONOutput: { continue?, decision?, reason?, hookSpecificOutput? }

import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Build lifecycle hooks for a Brand Wizard agent session.
 *
 * @param {Object} context
 * @param {import('socket.io').Server} context.io - Socket.io server instance
 * @param {string} context.room - Socket.io room (e.g., "brand:{brandId}")
 * @param {string} context.userId - The user running this session
 * @param {string} context.brandId - The brand being built
 * @param {import('bullmq').Job} context.job - The BullMQ job instance
 * @returns {Partial<Record<import('@anthropic-ai/claude-agent-sdk').HookEvent, import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher[]>>}
 */
export function buildAgentHooks({ io, room, userId, brandId, job }) {
  /** @type {number} Tool call counter for progress calculation */
  let toolCallCount = 0;

  return {
    /**
     * SessionStart — fires when the agent session begins.
     */
    SessionStart: [
      {
        hooks: [
          async (input) => {
            logger.info(
              { sessionId: input.session_id, userId, brandId, source: input.source },
              'Agent session started'
            );
            io.of('/wizard').to(room).emit('agent:session-start', {
              sessionId: input.session_id,
              brandId,
            });
            return { continue: true };
          },
        ],
      },
    ],

    /**
     * PreToolUse — fires BEFORE each tool execution.
     * Return { decision: 'approve' } to allow, { decision: 'block', reason: '...' } to deny.
     */
    PreToolUse: [
      {
        hooks: [
          async (input, toolUseID) => {
            toolCallCount++;
            logger.info(
              {
                tool: input.tool_name,
                toolUseId: input.tool_use_id,
                callNumber: toolCallCount,
                sessionId: input.session_id,
              },
              'Tool call starting'
            );

            // Emit progress to client
            io.of('/wizard').to(room).emit('agent:tool-start', {
              tool: input.tool_name,
              callNumber: toolCallCount,
              timestamp: Date.now(),
            });

            // Update BullMQ job progress
            await job.updateProgress({
              currentTool: input.tool_name,
              toolCallCount,
              timestamp: Date.now(),
            });

            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'allow',
              },
            };
          },
        ],
      },
    ],

    /**
     * PostToolUse — fires AFTER each successful tool execution.
     */
    PostToolUse: [
      {
        hooks: [
          async (input) => {
            logger.info(
              {
                tool: input.tool_name,
                toolUseId: input.tool_use_id,
                sessionId: input.session_id,
              },
              'Tool call completed'
            );

            const progressMap = {
              validateInput: 5,
              checkCredits: 10,
              'social-analyzer': 30,
              'brand-generator': 50,
              saveBrandData: 55,
              'logo-creator': 75,
              'mockup-renderer': 85,
              'profit-calculator': 90,
              deductCredit: 92,
              queueCRMSync: 95,
              sendEmail: 98,
            };

            const progress =
              progressMap[input.tool_name] || Math.min(toolCallCount * 10, 95);

            io.of('/wizard').to(room).emit('agent:tool-complete', {
              tool: input.tool_name,
              progress,
              timestamp: Date.now(),
            });

            await job.updateProgress({ progress, lastTool: input.tool_name });

            return { continue: true };
          },
        ],
      },
    ],

    /**
     * PostToolUseFailure — fires when a tool execution throws.
     */
    PostToolUseFailure: [
      {
        hooks: [
          async (input) => {
            logger.error(
              {
                tool: input.tool_name,
                error: input.error,
                toolUseId: input.tool_use_id,
                sessionId: input.session_id,
              },
              'Tool call failed'
            );

            io.of('/wizard').to(room).emit('agent:tool-error', {
              tool: input.tool_name,
              error: input.error,
              timestamp: Date.now(),
            });

            return { continue: true };
          },
        ],
      },
    ],

    /**
     * SessionEnd — fires when the agent session completes.
     */
    SessionEnd: [
      {
        hooks: [
          async (input) => {
            logger.info(
              { sessionId: input.session_id, reason: input.reason },
              'Agent session ended'
            );

            // Persist session metadata to audit log
            await supabaseAdmin.from('audit_log').insert({
              user_id: userId,
              action: 'agent_session_complete',
              resource_type: 'brand',
              resource_id: brandId,
              metadata: {
                sessionId: input.session_id,
                reason: input.reason,
              },
            }).catch((err) => {
              logger.error({ err }, 'Failed to write audit log on session end');
            });

            io.of('/wizard').to(room).emit('agent:session-end', {
              sessionId: input.session_id,
              reason: input.reason,
            });

            return { continue: true };
          },
        ],
      },
    ],
  };
}

/**
 * Strip sensitive data from tool results before sending to client.
 * @param {unknown} result
 * @returns {unknown}
 */
export function sanitizeResultForClient(result) {
  if (!result || typeof result !== 'object') return result;
  const sanitized = { ...result };
  delete sanitized.apiKey;
  delete sanitized.internalUrl;
  delete sanitized.stackTrace;
  delete sanitized.rawResponse;
  return sanitized;
}

/**
 * Determine if an error is recoverable.
 * @param {Error} error
 * @returns {boolean}
 */
export function isRecoverableError(error) {
  const recoverablePatterns = [
    'rate limit', 'timeout', 'econnreset', 'enotfound',
    '429', '503', '502', 'temporarily unavailable',
  ];
  const msg = (error?.message || '').toLowerCase();
  return recoverablePatterns.some((p) => msg.includes(p));
}
