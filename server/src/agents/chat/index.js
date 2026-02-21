// server/src/agents/chat/index.js
//
// Chat agent entry point. Creates a role-filtered, context-aware
// agent session using the Anthropic Agent SDK. Returns an async
// generator that yields SDK messages for streaming to the client.

import { createChatToolsServer } from './mcp-server.js';
import { buildChatSystemPrompt } from './system-prompt.js';
import { buildChatHooks } from './hooks.js';
import { getEffectiveRole } from './tool-filter.js';
import { logger } from '../../lib/logger.js';

/**
 * Lazily import the Agent SDK query function.
 * @type {typeof import('@anthropic-ai/claude-agent-sdk').query | null}
 */
let sdkQuery = null;
try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  sdkQuery = sdk.query;
} catch {
  // Agent SDK not installed — will throw descriptive error at runtime
}

/**
 * Run the chat agent for a single user message.
 *
 * Returns an async generator that yields SDK messages for streaming.
 * The Socket.io handler consumes these to emit events to the client.
 *
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.sessionId - Chat session ID
 * @param {string} params.message - User's message text
 * @param {Object} params.profile - User profile { role, org_id, email, full_name }
 * @param {string|null} params.orgRole - Org membership role
 * @param {Object|null} params.activeBrand - Active brand data (if any)
 * @param {string} [params.pageContext] - Current page route
 * @param {Object[]} [params.history] - Previous messages for context
 * @param {import('socket.io').Server} params.io - Socket.io server
 * @returns {AsyncGenerator}
 */
export async function* runChatAgent({
  userId,
  sessionId,
  message,
  profile,
  orgRole,
  activeBrand,
  pageContext,
  history,
  io,
}) {
  if (!sdkQuery) {
    throw new Error(
      'Anthropic Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed.'
    );
  }

  const effectiveRole = getEffectiveRole(profile.role, orgRole);

  // 1. Create role-filtered MCP tool server
  const { server: chatToolsServer, toolNames } = createChatToolsServer({
    userId,
    orgId: profile.org_id,
    profileRole: profile.role,
    orgRole,
  });

  // 2. Build dynamic system prompt
  const systemPrompt = buildChatSystemPrompt({
    effectiveRole,
    activeBrand,
    availableToolNames: toolNames,
    user: { email: profile.email, fullName: profile.full_name },
    pageContext,
  });

  // 3. Build lifecycle hooks
  const hooks = buildChatHooks({ io, userId, sessionId });

  // 4. Build conversation messages from history
  const messages = [];
  if (history && history.length > 0) {
    for (const msg of history) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }
  }

  // 5. Add current message with XML safety wrapping
  const safeMessage = `<user_message>\n${message}\n</user_message>`;
  messages.push({ role: 'user', content: safeMessage });

  logger.info({
    userId,
    sessionId,
    effectiveRole,
    toolCount: toolNames.length,
    historyLength: history?.length || 0,
    activeBrandId: activeBrand?.id || null,
  }, 'Starting chat agent');

  // 6. Run the agent
  const query = sdkQuery({
    prompt: safeMessage,
    options: {
      model: 'claude-sonnet-4-6',
      systemPrompt,
      mcpServers: {
        'bmn-chat-tools': chatToolsServer,
      },
      allowedTools: toolNames.map((name) => `mcp__bmn-chat-tools__${name}`),
      hooks,
      maxTurns: 15,
      maxBudgetUsd: 0.50,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'brand-me-now-chat/2.0.0',
      },
    },
  });

  // 7. Stream messages back
  for await (const msg of query) {
    yield msg;
  }
}
