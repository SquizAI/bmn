// server/src/agents/tools/validate-input.js

import { z } from 'zod';

/**
 * Attempt to load Google AI SDK. If not installed yet, provide a stub fallback.
 * This allows the agent system to boot even if @google/generativeai is not yet
 * in the dependency tree.
 */
let genAI = null;
try {
  const { GoogleGenerativeAI } = await import('@google/generativeai');
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
} catch {
  // SDK not installed yet -- stub will be used in execute()
}

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const validateInput = {
  name: 'validateInput',
  description:
    'Cheap and fast validation or classification using Gemini 3.0 Flash ($0.15/1M input tokens). Use for: checking if a social handle looks valid, classifying user intent, validating brand name appropriateness, NSFW detection on text.',
  inputSchema: z.object({
    input: z.string().describe('The text to validate or classify'),
    validationType: z
      .enum([
        'social_handle',
        'brand_name',
        'nsfw_text',
        'user_intent',
        'color_hex',
        'general',
      ])
      .describe('What kind of validation to perform'),
    criteria: z
      .string()
      .optional()
      .describe('Additional validation criteria or instructions'),
  }),
  execute: async ({ input, validationType, criteria }) => {
    // If Google AI SDK is not installed, return a stub response
    if (!genAI) {
      return {
        valid: true,
        message: 'Validation unavailable - Google AI SDK not configured',
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });

    const prompts = {
      social_handle: `Validate if this looks like a real social media handle (not gibberish, not offensive). Handle: "${input}". Return JSON: { "valid": boolean, "reason": string }`,
      brand_name: `Evaluate this brand name for appropriateness, memorability, and potential trademark issues. Name: "${input}". Return JSON: { "appropriate": boolean, "memorable": number (1-10), "concerns": string[] }`,
      nsfw_text: `Check if this text contains NSFW, offensive, or inappropriate content. Text: "${input}". Return JSON: { "safe": boolean, "reason": string }`,
      user_intent: `Classify the user's intent from this message. Message: "${input}". Return JSON: { "intent": string, "confidence": number }`,
      color_hex: `Validate these color hex codes and name them. Input: "${input}". Return JSON: { "valid": boolean, "colors": { "hex": string, "name": string }[] }`,
      general: `${criteria || 'Validate the following input'}: "${input}". Return JSON with your assessment.`,
    };

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompts[validationType] }] },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    });

    return JSON.parse(result.response.text());
  },
};
