// server/src/agents/brand-wizard.js
//
// Brand Wizard agent — the parent orchestration agent that runs
// the multi-step brand creation wizard via the Anthropic Agent SDK.
//
// SDK API:
//   query({ prompt: string, options?: Options }) => AsyncGenerator<SDKMessage>
//
// Tools are delivered via an in-process MCP server (createSdkMcpServer).
// Subagents are defined via options.agents as Record<string, AgentDefinition>.
// Hooks use the format: Partial<Record<HookEvent, HookCallbackMatcher[]>>.

import { buildAgentHooks } from './agent-config.js';
import { BRAND_WIZARD_SYSTEM_PROMPT } from './prompts/brand-wizard-prompt.js';
import { getAgentDefinitions } from '../skills/_shared/tool-registry.js';
import { createParentToolsServer, PARENT_TOOL_NAMES } from './tools/mcp-server.js';
import { sessionManager } from './session-manager.js';
import { logger } from '../lib/logger.js';

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
 * Run the Brand Wizard agent for a specific wizard step.
 *
 * This is an async generator that yields SDK messages as they stream.
 * The BullMQ worker consumes these messages to emit Socket.io events
 * and persist results.
 *
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.brandId - Brand being built
 * @param {string} params.step - Current wizard step
 * @param {string} [params.sessionId] - Previous session ID for resume
 * @param {Object} params.input - User input for this step
 * @param {import('socket.io').Server} params.io - Socket.io server
 * @param {import('bullmq').Job} params.job - BullMQ job instance
 * @returns {AsyncGenerator<import('@anthropic-ai/claude-agent-sdk').SDKMessage>}
 */
export async function* runBrandWizard({
  userId,
  brandId,
  step,
  sessionId,
  input,
  io,
  job,
}) {
  if (!sdkQuery) {
    throw new Error(
      'Anthropic Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. Run: npm install @anthropic-ai/claude-agent-sdk'
    );
  }

  const room = `brand:${brandId}`;

  // 1. Create the in-process MCP server with parent tools
  const parentToolsServer = createParentToolsServer();

  // 2. Get step-specific subagent definitions
  const agents = getAgentDefinitions(step);

  // 3. Build lifecycle hooks
  const hooks = buildAgentHooks({ io, room, userId, brandId, job });

  // 4. Build the step-specific user prompt
  const userPrompt = buildStepPrompt(step, input, { userId, brandId });

  logger.info(
    {
      userId,
      brandId,
      step,
      sessionId: sessionId || 'new',
      agentCount: Object.keys(agents).length,
      toolCount: PARENT_TOOL_NAMES.length,
    },
    'Starting Brand Wizard agent'
  );

  // 5. Run the agent via SDK query()
  const query = sdkQuery({
    prompt: userPrompt,
    options: {
      // Model
      model: 'claude-sonnet-4-6',

      // System prompt
      systemPrompt: BRAND_WIZARD_SYSTEM_PROMPT,

      // Custom tools via in-process MCP server
      mcpServers: {
        'bmn-parent-tools': parentToolsServer,
      },

      // Auto-allow our custom tools without prompting
      allowedTools: PARENT_TOOL_NAMES.map((name) => `mcp__bmn-parent-tools__${name}`),

      // Subagent definitions (skill modules)
      agents,

      // Lifecycle hooks
      hooks,

      // Session resume
      resume: sessionId || undefined,

      // Limits
      maxTurns: 50,
      maxBudgetUsd: 2.00,

      // Permission mode — bypass for server-side automation
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,

      // Don't persist sessions to disk — we manage sessions via Redis/Supabase
      persistSession: false,

      // Working directory for the agent process
      cwd: process.cwd(),

      // Pass required env vars to the subprocess
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'brand-me-now/2.0.0',
      },
    },
  });

  // 6. Stream messages back to the worker
  for await (const message of query) {
    yield message;

    // Persist session on successful completion
    if (message.type === 'result' && message.subtype === 'success') {
      await sessionManager.save({
        brandId,
        sessionId: message.session_id,
        step,
        totalCost: message.total_cost_usd,
      });
    }
  }
}

/**
 * Build a step-specific prompt with safe user input wrapping.
 * Uses XML delimiter pattern to prevent prompt injection.
 *
 * @param {string} step - Wizard step identifier
 * @param {Object} input - User-provided input for this step
 * @param {Object} context - Session context (userId, brandId)
 * @returns {string}
 */
function buildStepPrompt(step, input, context) {
  const stepInstructions = {
    'social-analysis': `Analyze the user's social media profiles. Use the social-analyzer subagent via the Task tool.
      Extract brand DNA: aesthetic, themes, audience, engagement, personality.
      Save the analysis results via saveBrandData.`,

    'brand-identity': `Generate a complete brand identity based on the social analysis data.
      Use the brand-generator subagent via the Task tool.
      Include: vision, values, archetype, color palette (4-6 colors), fonts, logo style.
      Save all results via saveBrandData.`,

    'logo-generation': `Generate 4 logo options for the brand.
      First check credits via checkCredits (operationType: "logo", quantity: 4).
      If credits available, use the logo-creator subagent via the Task tool.
      After successful generation, deduct credits via deductCredit.
      Save logo assets via saveBrandData.`,

    'logo-refinement': `Refine the selected logo based on user feedback.
      Check credits first (1 credit for refinement).
      Use the logo-creator subagent via the Task tool with the refinement instructions.
      Deduct credits after success.`,

    'product-selection': `Help the user browse and select products from the catalog.
      Use searchProducts to show available products.
      Save selected product SKUs via saveBrandData.`,

    'mockup-generation': `Generate product mockups for all selected products.
      Check credits via checkCredits (operationType: "mockup", quantity: number of products).
      Use the mockup-renderer subagent via the Task tool.
      Deduct credits after success.
      Save mockup assets via saveBrandData.`,

    'bundle-composition': `Create product bundles from selected products.
      Use the mockup-renderer subagent via the Task tool for bundle composition images.
      Check and deduct credits for each bundle image.
      Save bundle data via saveBrandData.`,

    'profit-projection': `Calculate profit margins and revenue projections.
      Use the profit-calculator subagent via the Task tool.
      Include projections at 3 sales tiers (low, mid, high).
      Save projections via saveBrandData.`,

    'completion': `Finalize the brand. Queue CRM sync (brand.completed event).
      Send brand completion email. Return final brand summary.`,
  };

  const instructions =
    stepInstructions[step] ||
    `Process the user's request for step: ${step}`;

  return `Current wizard step: ${step}
Brand ID: ${context.brandId}
User ID: ${context.userId}

${instructions}

<user_input>
${JSON.stringify(input, null, 2)}
</user_input>

Process the above user input according to the step instructions. Return structured JSON as specified in your step_schemas.`;
}
