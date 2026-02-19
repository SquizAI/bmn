// server/src/agents/brand-wizard.js

import { buildAgentHooks } from './agent-config.js';
import { BRAND_WIZARD_SYSTEM_PROMPT } from './prompts/brand-wizard-prompt.js';
import { getRegisteredTools } from '../skills/_shared/tool-registry.js';
import { sessionManager } from './session-manager.js';
import { logger } from '../lib/logger.js';

// Direct tools (always available to parent agent)
import { saveBrandData } from './tools/save-brand-data.js';
import { searchProducts } from './tools/search-products.js';
import { validateInput } from './tools/validate-input.js';
import { queueCRMSync } from './tools/queue-crm-sync.js';
import { sendEmail } from './tools/send-email.js';
import { checkCredits } from './tools/check-credits.js';
import { deductCredit } from './tools/deduct-credit.js';

/** Direct tools always available to the parent agent */
const PARENT_TOOLS = [
  saveBrandData,
  searchProducts,
  validateInput,
  queueCRMSync,
  sendEmail,
  checkCredits,
  deductCredit,
];

/**
 * Attempt to import the Anthropic Agent SDK.
 * Wrapped in try/catch since the SDK may not be installed yet.
 */
let agentQuery = null;
try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  agentQuery = sdk.query;
} catch {
  // Agent SDK not installed yet -- will throw descriptive error at runtime
}

/**
 * Run the Brand Wizard agent for a specific wizard step.
 *
 * This is an async generator function that yields agent messages
 * as they are produced. Each message can be a tool call, a text
 * response, or a final result.
 *
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.brandId - Brand being built
 * @param {string} params.step - Current wizard step (e.g., 'social-analysis', 'logo-generation')
 * @param {string} [params.sessionId] - Previous session ID for resume
 * @param {Object} params.input - User input for this step
 * @param {import('socket.io').Server} params.io - Socket.io server
 * @param {import('bullmq').Job} params.job - BullMQ job instance
 * @returns {AsyncGenerator} Yields agent messages
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
  if (!agentQuery) {
    throw new Error(
      'Anthropic Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. Run: npm install @anthropic-ai/claude-agent-sdk'
    );
  }

  const room = `brand:${brandId}`;

  // Get step-specific subagent tools from the registry
  const stepSubagents = getRegisteredTools(step);

  // Merge parent direct tools + step-relevant subagent tools
  const allTools = [...PARENT_TOOLS, ...stepSubagents];

  // Build lifecycle hooks
  const hooks = buildAgentHooks({ io, room, userId, brandId, job });

  // Build the step-specific user prompt
  const userPrompt = buildStepPrompt(step, input, { userId, brandId });

  logger.info(
    {
      userId,
      brandId,
      step,
      sessionId: sessionId || 'new',
      toolCount: allTools.length,
      subagentCount: stepSubagents.length,
    },
    'Starting Brand Wizard agent'
  );

  // Run the agent
  for await (const message of agentQuery({
    prompt: userPrompt,
    system: BRAND_WIZARD_SYSTEM_PROMPT,
    options: {
      model: 'claude-sonnet-4-6',
      allowedTools: allTools,
      resume: sessionId || undefined,
      maxTurns: 50,
      maxBudgetUsd: 2.00,
      permissionMode: 'bypassPermissions',
    },
    hooks,
  })) {
    // Yield each message for the BullMQ worker to process
    yield message;

    // Persist session on completion
    if (message.type === 'result') {
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
    'social-analysis': `Analyze the user's social media profiles. Use the social-analyzer subagent.
      Extract brand DNA: aesthetic, themes, audience, engagement, personality.
      Save the analysis results via saveBrandData.`,

    'brand-identity': `Generate a complete brand identity based on the social analysis data.
      Use the brand-generator subagent.
      Include: vision, values, archetype, color palette (4-6 colors), fonts, logo style.
      Save all results via saveBrandData.`,

    'logo-generation': `Generate 4 logo options for the brand.
      First check credits via checkCredits (operationType: "logo", quantity: 4).
      If credits available, use the logo-creator subagent.
      After successful generation, deduct credits via deductCredit.
      Save logo assets via saveBrandData.`,

    'logo-refinement': `Refine the selected logo based on user feedback.
      Check credits first (1 credit for refinement).
      Use the logo-creator subagent with the refinement instructions.
      Deduct credits after success.`,

    'product-selection': `Help the user browse and select products from the catalog.
      Use searchProducts to show available products.
      Save selected product SKUs via saveBrandData.`,

    'mockup-generation': `Generate product mockups for all selected products.
      Check credits via checkCredits (operationType: "mockup", quantity: number of products).
      Use the mockup-renderer subagent.
      Deduct credits after success.
      Save mockup assets via saveBrandData.`,

    'bundle-composition': `Create product bundles from selected products.
      Use the mockup-renderer subagent for bundle composition images.
      Check and deduct credits for each bundle image.
      Save bundle data via saveBrandData.`,

    'profit-projection': `Calculate profit margins and revenue projections.
      Use the profit-calculator subagent.
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
