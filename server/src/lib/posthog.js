// server/src/lib/posthog.js

import { PostHog } from 'posthog-node';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/** @type {PostHog | null} */
let posthogClient = null;

/**
 * Initialize the PostHog Node.js client.
 * Call once at server startup. Skips init if POSTHOG_API_KEY is empty.
 */
export function initPostHog() {
  if (!config.POSTHOG_API_KEY) {
    logger.warn('PostHog API key not set. Server-side analytics disabled.');
    return;
  }

  posthogClient = new PostHog(config.POSTHOG_API_KEY, {
    host: config.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 20,
    flushInterval: 10000,
  });

  logger.info('PostHog server-side client initialized');
}

/**
 * Capture a server-side event.
 * Used for events that happen on the server (webhook processing, job completion, etc.)
 *
 * @param {string} userId - The user ID (distinctId in PostHog)
 * @param {string} eventName - Event name
 * @param {Object} [properties] - Event properties
 */
export function captureEvent(userId, eventName, properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: eventName,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      source: 'server',
    },
  });
}

/**
 * Identify a user with properties on the server side.
 * Links server-side events to user properties for segmentation.
 *
 * @param {string} userId
 * @param {{ email?: string, subscription_tier?: string, created_at?: string }} properties
 */
export function identifyUser(userId, properties = {}) {
  if (!posthogClient) return;

  posthogClient.identify({
    distinctId: userId,
    properties,
  });
}

/**
 * Check if a feature flag is enabled for a user.
 * Server-side feature flag evaluation.
 *
 * @param {string} userId
 * @param {string} flagKey
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(userId, flagKey) {
  if (!posthogClient) return false;
  return posthogClient.isFeatureEnabled(flagKey, userId);
}

/**
 * Flush all pending events and shut down. Call on server shutdown.
 */
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

export { posthogClient };
