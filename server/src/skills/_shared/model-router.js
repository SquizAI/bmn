// server/src/skills/_shared/model-router.js

import { getAnthropicClient, getOpenAIClient, getGoogleAIClient } from '../../services/providers.js';
import { logger } from '../../lib/logger.js';

/**
 * @typedef {'brand-vision' | 'social-analysis' | 'chatbot' | 'extraction' | 'name-generation' | 'validation' | 'large-context'} TaskType
 */

/**
 * @typedef {Object} ModelRoute
 * @property {string} model - Primary model identifier
 * @property {string} provider - Primary provider ('anthropic' | 'google' | 'openai')
 * @property {string} fallbackModel - Fallback model identifier
 * @property {string} fallbackProvider - Fallback provider
 * @property {string} reason - Why this model was selected
 * @property {number} estimatedCostPer1kTokens - Estimated cost in USD
 */

/** @type {Record<TaskType, ModelRoute>} */
export const MODEL_ROUTES = {
  'brand-vision': {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    fallbackModel: 'gemini-3.0-pro',
    fallbackProvider: 'google',
    reason: 'Best creative + structured output',
    estimatedCostPer1kTokens: 0.009,
  },
  'social-analysis': {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    fallbackModel: 'gemini-3.0-pro',
    fallbackProvider: 'google',
    reason: 'Extended thinking for complex analysis',
    estimatedCostPer1kTokens: 0.009,
  },
  'name-generation': {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    fallbackModel: 'claude-haiku-4-5',
    fallbackProvider: 'anthropic',
    reason: 'Creative + trademark reasoning',
    estimatedCostPer1kTokens: 0.009,
  },
  'chatbot': {
    model: 'claude-haiku-4-5',
    provider: 'anthropic',
    fallbackModel: 'gemini-3.0-flash',
    fallbackProvider: 'google',
    reason: 'Fast + affordable conversational AI',
    estimatedCostPer1kTokens: 0.0024,
  },
  'extraction': {
    model: 'claude-haiku-4-5',
    provider: 'anthropic',
    fallbackModel: 'gemini-3.0-flash',
    fallbackProvider: 'google',
    reason: 'Fast + cheap structured extraction',
    estimatedCostPer1kTokens: 0.0024,
  },
  'validation': {
    model: 'gemini-3.0-flash',
    provider: 'google',
    fallbackModel: 'claude-haiku-4-5',
    fallbackProvider: 'anthropic',
    reason: 'Cheapest for simple validation tasks',
    estimatedCostPer1kTokens: 0.000375,
  },
  'large-context': {
    model: 'gemini-3.0-pro',
    provider: 'google',
    fallbackModel: 'claude-sonnet-4-6',
    fallbackProvider: 'anthropic',
    reason: '1M context for massive inputs',
    estimatedCostPer1kTokens: 0.005625,
  },
};

/**
 * Route a text generation task to the optimal model with automatic fallback.
 *
 * @param {TaskType} taskType - The type of task to route
 * @param {Object} options
 * @param {string} options.prompt - The prompt to send
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {number} [options.temperature=0.7] - Sampling temperature
 * @param {boolean} [options.jsonMode=false] - Request JSON output
 * @returns {Promise<{ text: string, model: string, provider: string, usage: Object, wasFallback?: boolean }>}
 */
export async function routeModel(taskType, options) {
  const route = MODEL_ROUTES[taskType];
  if (!route) throw new Error(`Unknown task type: ${taskType}`);

  try {
    const result = await callProvider(route.provider, route.model, options);
    return { ...result, model: route.model, provider: route.provider };
  } catch (primaryError) {
    logger.warn(
      {
        taskType,
        primaryModel: route.model,
        fallbackModel: route.fallbackModel,
        error: primaryError.message,
      },
      'Primary model failed, falling back'
    );

    try {
      const result = await callProvider(
        route.fallbackProvider,
        route.fallbackModel,
        options
      );
      return {
        ...result,
        model: route.fallbackModel,
        provider: route.fallbackProvider,
        wasFallback: true,
      };
    } catch (fallbackError) {
      logger.error(
        {
          taskType,
          primaryError: primaryError.message,
          fallbackError: fallbackError.message,
        },
        'Both primary and fallback models failed'
      );

      throw new Error(
        `All models failed for ${taskType}: primary (${route.model}): ${primaryError.message}, fallback (${route.fallbackModel}): ${fallbackError.message}`
      );
    }
  }
}

/**
 * Call a specific provider's model.
 *
 * @param {string} provider - 'anthropic' | 'google' | 'openai'
 * @param {string} model - Model identifier
 * @param {Object} options
 * @param {string} options.prompt - The prompt to send
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {number} [options.temperature=0.7] - Sampling temperature
 * @param {boolean} [options.jsonMode=false] - Request JSON output
 * @returns {Promise<{ text: string, usage: Object }>}
 */
async function callProvider(provider, model, options) {
  const {
    prompt,
    systemPrompt,
    maxTokens = 4096,
    temperature = 0.7,
    jsonMode = false,
  } = options;

  switch (provider) {
    case 'anthropic': {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(systemPrompt && { system: systemPrompt }),
        messages: [{ role: 'user', content: prompt }],
      });
      return {
        text: response.content[0].text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    }

    case 'google': {
      const client = getGoogleAIClient();
      const genModel = client.getGenerativeModel({ model });
      const result = await genModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: systemPrompt
                  ? `${systemPrompt}\n\n${prompt}`
                  : prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          ...(jsonMode && { responseMimeType: 'application/json' }),
        },
      });
      return {
        text: result.response.text(),
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount,
        },
      };
    }

    case 'openai': {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          ...(systemPrompt
            ? [{ role: 'system', content: systemPrompt }]
            : []),
          { role: 'user', content: prompt },
        ],
        ...(jsonMode && { response_format: { type: 'json_object' } }),
      });
      return {
        text: response.choices[0].message.content,
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        },
      };
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get the model route configuration for a task type (for cost estimation).
 * @param {TaskType} taskType
 * @returns {ModelRoute}
 */
export function getModelRoute(taskType) {
  return MODEL_ROUTES[taskType];
}

/**
 * List all available model routes (for admin dashboard).
 * @returns {Record<TaskType, ModelRoute>}
 */
export function listModelRoutes() {
  return { ...MODEL_ROUTES };
}
