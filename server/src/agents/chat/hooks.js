// server/src/agents/chat/hooks.js
//
// Lightweight lifecycle hooks for the chat agent.
// Emits Socket.io events to the /chat namespace for real-time
// tool execution feedback. Lighter than wizard hooks (no BullMQ job progress).

import { logger } from '../../lib/logger.js';

/**
 * Build lifecycle hooks for a chat agent session.
 *
 * @param {Object} context
 * @param {import('socket.io').Server} context.io - Socket.io server instance
 * @param {string} context.userId - The user's ID
 * @param {string} context.sessionId - Chat session ID
 * @returns {Object} Agent SDK hooks object
 */
export function buildChatHooks({ io, userId, sessionId }) {
  let toolCallCount = 0;

  return {
    SessionStart: [
      {
        hooks: [
          async (input) => {
            logger.info(
              { sessionId, userId, agentSessionId: input.session_id },
              'Chat agent session started'
            );
            io.of('/chat').to(`chat:${userId}`).emit('chat:session-start', {
              sessionId,
              agentSessionId: input.session_id,
            });
            return { continue: true };
          },
        ],
      },
    ],

    PreToolUse: [
      {
        hooks: [
          async (input) => {
            toolCallCount++;
            logger.info(
              {
                tool: input.tool_name,
                callNumber: toolCallCount,
                sessionId,
              },
              'Chat tool call starting'
            );

            io.of('/chat').to(`chat:${userId}`).emit('chat:tool-start', {
              sessionId,
              toolName: input.tool_name,
              toolInput: input.tool_input,
              callNumber: toolCallCount,
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

    PostToolUse: [
      {
        hooks: [
          async (input) => {
            logger.info(
              { tool: input.tool_name, sessionId },
              'Chat tool call completed'
            );

            io.of('/chat').to(`chat:${userId}`).emit('chat:tool-complete', {
              sessionId,
              toolName: input.tool_name,
              timestamp: Date.now(),
            });

            return { continue: true };
          },
        ],
      },
    ],

    PostToolUseFailure: [
      {
        hooks: [
          async (input) => {
            logger.error(
              { tool: input.tool_name, error: input.error, sessionId },
              'Chat tool call failed'
            );

            io.of('/chat').to(`chat:${userId}`).emit('chat:tool-error', {
              sessionId,
              toolName: input.tool_name,
              error: input.error,
              timestamp: Date.now(),
            });

            return { continue: true };
          },
        ],
      },
    ],

    SessionEnd: [
      {
        hooks: [
          async (input) => {
            logger.info(
              { sessionId, reason: input.reason },
              'Chat agent session ended'
            );
            return { continue: true };
          },
        ],
      },
    ],
  };
}
