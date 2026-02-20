// server/src/config/index.js

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import { cleanEnv, str, port, url } from 'envalid';

// Load .env from project root (parent of server/)
dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });

/**
 * Validated, typed environment configuration.
 *
 * envalid validates ALL variables on import. If any required variable is missing
 * or has an invalid type, the process crashes immediately with a clear error message.
 *
 * Usage:
 *   import { config } from '../config/index.js';
 *   console.log(config.PORT); // number, guaranteed to exist
 */
export const config = cleanEnv(process.env, {
  // ── App ────────────────────────────────────────────────────
  NODE_ENV: str({
    choices: ['development', 'staging', 'production', 'test'],
    desc: 'Runtime environment',
  }),
  PORT: port({
    default: 4847,
    desc: 'HTTP server port',
  }),
  API_URL: url({
    devDefault: 'http://localhost:4847',
    desc: 'Public API URL (used in CORS, email links, resume tokens)',
  }),
  APP_URL: url({
    devDefault: 'http://localhost:4848',
    desc: 'Frontend SPA URL (used in CORS, redirects)',
  }),
  MARKETING_URL: url({
    devDefault: 'http://localhost:4849',
    desc: 'Marketing site URL (used in CORS)',
  }),
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
    desc: 'pino log level',
  }),

  // ── Security ───────────────────────────────────────────────
  CORS_ORIGINS: str({
    devDefault: 'http://localhost:4848,http://localhost:4849',
    desc: 'Comma-separated list of allowed CORS origins',
  }),
  RESUME_TOKEN_SECRET: str({
    devDefault: 'dev-resume-token-secret-change-in-production',
    desc: 'HMAC secret for wizard resume tokens',
  }),

  // ── Supabase ───────────────────────────────────────────────
  SUPABASE_URL: url({
    desc: 'Supabase project URL',
  }),
  SUPABASE_ANON_KEY: str({
    desc: 'Supabase anonymous/public API key',
  }),
  SUPABASE_SERVICE_ROLE_KEY: str({
    desc: 'Supabase service role key (server-side only, bypasses RLS)',
  }),

  // ── Redis ──────────────────────────────────────────────────
  REDIS_URL: url({
    devDefault: 'redis://localhost:6381',
    desc: 'Redis connection URL (used for BullMQ, rate limiting, caching)',
  }),

  // ── AI Providers ───────────────────────────────────────────
  ANTHROPIC_API_KEY: str({
    devDefault: 'sk-ant-placeholder',
    desc: 'Anthropic API key (Claude models)',
  }),
  OPENAI_API_KEY: str({
    devDefault: 'sk-placeholder',
    desc: 'OpenAI API key (GPT Image 1.5)',
  }),
  GOOGLE_API_KEY: str({
    devDefault: 'placeholder',
    desc: 'Google AI API key (Gemini models)',
  }),
  BFL_API_KEY: str({
    devDefault: 'placeholder',
    desc: 'Black Forest Labs API key (FLUX.2 Pro)',
  }),
  IDEOGRAM_API_KEY: str({
    devDefault: 'placeholder',
    desc: 'Ideogram API key (Ideogram v3)',
  }),

  // ── Payments ───────────────────────────────────────────────
  STRIPE_SECRET_KEY: str({
    devDefault: 'sk_test_placeholder',
    desc: 'Stripe secret API key',
  }),
  STRIPE_PUBLISHABLE_KEY: str({
    devDefault: 'pk_test_placeholder',
    desc: 'Stripe publishable key (sent to frontend via config endpoint)',
  }),
  STRIPE_WEBHOOK_SECRET: str({
    devDefault: 'whsec_placeholder',
    desc: 'Stripe webhook signing secret',
  }),
  STRIPE_PRICE_STARTER: str({
    default: 'price_starter_monthly',
    desc: 'Stripe Price ID for Starter tier ($29/mo) -- replace with real Stripe Price ID',
  }),
  STRIPE_PRICE_PRO: str({
    default: 'price_pro_monthly',
    desc: 'Stripe Price ID for Pro tier ($79/mo) -- replace with real Stripe Price ID',
  }),
  STRIPE_PRICE_AGENCY: str({
    default: 'price_agency_monthly',
    desc: 'Stripe Price ID for Agency tier ($199/mo) -- replace with real Stripe Price ID',
  }),

  // ── Email ──────────────────────────────────────────────────
  RESEND_API_KEY: str({
    devDefault: 'placeholder',
    desc: 'Resend API key for transactional email',
  }),
  FROM_EMAIL: str({
    default: 'hello@brandmenow.com',
    desc: 'Default sender email address',
  }),
  SUPPORT_EMAIL: str({
    default: 'support@brandmenow.com',
    desc: 'Support team email address',
  }),

  // ── Scraping ───────────────────────────────────────────────
  APIFY_API_TOKEN: str({
    devDefault: 'placeholder',
    desc: 'Apify API token for social media scraping',
  }),

  // ── Observability ──────────────────────────────────────────
  SENTRY_DSN: str({
    devDefault: '',
    desc: 'Sentry DSN for error tracking and performance monitoring',
  }),
  POSTHOG_API_KEY: str({
    default: '',
    desc: 'PostHog API key for product analytics (optional in dev)',
  }),
  POSTHOG_HOST: url({
    default: 'https://us.posthog.com',
    desc: 'PostHog API host',
  }),
});
