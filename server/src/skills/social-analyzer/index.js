// server/src/skills/social-analyzer/index.js

import { skillConfig } from './config.js';
import { SYSTEM_PROMPT, buildTaskPrompt } from './prompts.js';
import { tools } from './tools.js';
import * as handlers from './handlers.js';

/**
 * Social Analyzer skill module.
 *
 * Scrapes Instagram, TikTok, YouTube, X/Twitter, and Facebook via Apify,
 * analyzes visual aesthetics and feed palette via Gemini Flash,
 * detects niches, calculates brand readiness, and synthesizes
 * a structured Creator Dossier JSON for downstream skills.
 *
 * @type {import('../_shared/types.js').Skill}
 */
export const skill = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  tools,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  model: skillConfig.model,
  steps: ['social-analysis'],
};

/**
 * PRD-compatible subagent config with tools explicitly wired to handlers.
 *
 * @type {import('@anthropic-ai/claude-agent-sdk').SubagentConfig}
 */
export const socialAnalyzer = {
  name: skillConfig.name,
  description: skillConfig.description,
  prompt: SYSTEM_PROMPT,
  model: skillConfig.model,
  maxTurns: skillConfig.maxTurns,
  maxBudgetUsd: skillConfig.maxBudgetUsd,
  tools: {
    scrapeInstagram: {
      description: tools.scrapeInstagram.description,
      inputSchema: tools.scrapeInstagram.inputSchema,
      execute: handlers.scrapeInstagram,
    },
    scrapeTikTok: {
      description: tools.scrapeTikTok.description,
      inputSchema: tools.scrapeTikTok.inputSchema,
      execute: handlers.scrapeTikTok,
    },
    scrapeFacebook: {
      description: tools.scrapeFacebook.description,
      inputSchema: tools.scrapeFacebook.inputSchema,
      execute: handlers.scrapeFacebook,
    },
    scrapeYouTube: {
      description: tools.scrapeYouTube.description,
      inputSchema: tools.scrapeYouTube.inputSchema,
      execute: handlers.scrapeYouTube,
    },
    scrapeTwitter: {
      description: tools.scrapeTwitter.description,
      inputSchema: tools.scrapeTwitter.inputSchema,
      execute: handlers.scrapeTwitter,
    },
    analyzeAesthetic: {
      description: tools.analyzeAesthetic.description,
      inputSchema: tools.analyzeAesthetic.inputSchema,
      execute: handlers.analyzeAesthetic,
    },
    extractFeedPalette: {
      description: tools.extractFeedPalette.description,
      inputSchema: tools.extractFeedPalette.inputSchema,
      execute: handlers.extractFeedPalette,
    },
    detectNiche: {
      description: tools.detectNiche.description,
      inputSchema: tools.detectNiche.inputSchema,
      execute: handlers.detectNiche,
    },
    calculateReadiness: {
      description: tools.calculateReadiness.description,
      inputSchema: tools.calculateReadiness.inputSchema,
      execute: handlers.calculateReadiness,
    },
    calculatePostingFrequency: {
      description: tools.calculatePostingFrequency.description,
      inputSchema: tools.calculatePostingFrequency.inputSchema,
      execute: handlers.calculatePostingFrequency,
    },
    analyzeHashtagStrategy: {
      description: tools.analyzeHashtagStrategy.description,
      inputSchema: tools.analyzeHashtagStrategy.inputSchema,
      execute: handlers.analyzeHashtagStrategy,
    },
    detectContentFormats: {
      description: tools.detectContentFormats.description,
      inputSchema: tools.detectContentFormats.inputSchema,
      execute: handlers.detectContentFormats,
    },
    detectCompetitors: {
      description: tools.detectCompetitors.description,
      inputSchema: tools.detectCompetitors.inputSchema,
      execute: handlers.detectCompetitors,
    },
    estimateAudienceDemographics: {
      description: tools.estimateAudienceDemographics.description,
      inputSchema: tools.estimateAudienceDemographics.inputSchema,
      execute: handlers.estimateAudienceDemographics,
    },
    analyzePostingFrequency: {
      description: tools.analyzePostingFrequency.description,
      inputSchema: tools.analyzePostingFrequency.inputSchema,
      execute: handlers.analyzePostingFrequency,
    },
    analyzeHashtagStrategyAI: {
      description: tools.analyzeHashtagStrategyAI.description,
      inputSchema: tools.analyzeHashtagStrategyAI.inputSchema,
      execute: handlers.analyzeHashtagStrategyAI,
    },
    analyzeContentFormats: {
      description: tools.analyzeContentFormats.description,
      inputSchema: tools.analyzeContentFormats.inputSchema,
      execute: handlers.analyzeContentFormats,
    },
    analyzeContentTone: {
      description: tools.analyzeContentTone.description,
      inputSchema: tools.analyzeContentTone.inputSchema,
      execute: handlers.analyzeContentTone,
    },
    detectExistingBrandName: {
      description: tools.detectExistingBrandName.description,
      inputSchema: tools.detectExistingBrandName.inputSchema,
      execute: handlers.detectExistingBrandName,
    },
  },
};

export { buildTaskPrompt };
export default skill;
