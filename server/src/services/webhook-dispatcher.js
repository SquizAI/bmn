// server/src/services/webhook-dispatcher.js

import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * Valid webhook event types that users can subscribe to.
 * @type {readonly string[]}
 */
export const WEBHOOK_EVENT_TYPES = [
  'brand.created',
  'brand.updated',
  'logo.generated',
  'mockup.generated',
  'order.created',
  'subscription.changed',
];

/**
 * Maximum number of retry attempts for failed webhook deliveries.
 */
const MAX_RETRIES = 3;

/**
 * Base delay in ms for exponential backoff (doubles each retry).
 */
const BASE_DELAY_MS = 1000;

/**
 * Timeout for each webhook HTTP request in ms.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 *
 * @param {string} payload - JSON-stringified payload
 * @param {string} secret - User's webhook secret
 * @returns {string} Hex-encoded HMAC signature
 */
function computeSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Sleep for a given number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a single HTTP POST to a webhook URL with the event payload.
 * Includes HMAC signature in the X-BMN-Signature header.
 *
 * @param {string} url - The user's webhook endpoint URL
 * @param {string} payloadString - JSON-stringified payload
 * @param {string} signature - HMAC-SHA256 hex signature
 * @returns {Promise<{statusCode: number, body: string}>}
 */
async function sendRequest(url, payloadString, signature) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BMN-Signature': `sha256=${signature}`,
        'User-Agent': 'BrandMeNow-Webhooks/1.0',
      },
      body: payloadString,
      signal: controller.signal,
    });

    const body = await response.text();
    return { statusCode: response.status, body: body.slice(0, 1000) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Log a webhook delivery attempt to the webhook_deliveries table.
 *
 * @param {Object} params
 * @param {string} params.webhookConfigId - The webhook config ID
 * @param {string} params.event - Event type (e.g., 'brand.created')
 * @param {Object} params.payload - The event payload
 * @param {number} params.statusCode - HTTP response status code (0 if network error)
 * @param {string} params.responseBody - Truncated response body
 * @param {boolean} params.success - Whether the delivery was successful
 * @param {number} params.attempt - The attempt number (1-based)
 * @param {string|null} params.errorMessage - Error message if failed
 * @returns {Promise<void>}
 */
async function logDelivery({
  webhookConfigId,
  event,
  payload,
  statusCode,
  responseBody,
  success,
  attempt,
  errorMessage,
}) {
  try {
    await supabaseAdmin.from('webhook_deliveries').insert({
      webhook_config_id: webhookConfigId,
      event,
      payload,
      status_code: statusCode,
      response_body: responseBody || null,
      success,
      attempt,
      error_message: errorMessage || null,
      delivered_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, webhookConfigId, event }, 'Failed to log webhook delivery');
  }
}

/**
 * Dispatch a webhook event to all matching user webhook configurations.
 *
 * Finds all active webhook configs for the given user that subscribe to
 * the specified event, sends the payload to each URL with HMAC signing,
 * and retries up to 3 times with exponential backoff on failure.
 *
 * @param {string} userId - The user ID whose webhook configs to query
 * @param {string} event - The event type (e.g., 'brand.created')
 * @param {Object} payload - The event payload data
 * @returns {Promise<void>}
 */
export async function dispatchWebhook(userId, event, payload) {
  if (!WEBHOOK_EVENT_TYPES.includes(event)) {
    logger.warn({ userId, event }, 'Unknown webhook event type, skipping dispatch');
    return;
  }

  // Find all active webhook configs for this user that include this event
  const { data: configs, error } = await supabaseAdmin
    .from('webhook_configs')
    .select('id, url, secret, events')
    .eq('user_id', userId)
    .eq('active', true);

  if (error) {
    logger.error({ err: error, userId, event }, 'Failed to query webhook configs');
    return;
  }

  if (!configs || configs.length === 0) {
    return; // No webhook configs for this user
  }

  // Filter configs that subscribe to this event
  const matchingConfigs = configs.filter(
    (config) => Array.isArray(config.events) && config.events.includes(event),
  );

  if (matchingConfigs.length === 0) {
    return; // No configs subscribe to this event
  }

  const envelopePayload = {
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  };
  const payloadString = JSON.stringify(envelopePayload);

  // Dispatch to all matching configs in parallel
  const dispatches = matchingConfigs.map(async (config) => {
    const signature = computeSignature(payloadString, config.secret);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await sendRequest(config.url, payloadString, signature);
        const success = result.statusCode >= 200 && result.statusCode < 300;

        await logDelivery({
          webhookConfigId: config.id,
          event,
          payload: envelopePayload,
          statusCode: result.statusCode,
          responseBody: result.body,
          success,
          attempt,
          errorMessage: success ? null : `HTTP ${result.statusCode}`,
        });

        if (success) {
          logger.info(
            { webhookConfigId: config.id, event, attempt, statusCode: result.statusCode },
            'Webhook delivered successfully',
          );
          return; // Success, stop retrying
        }

        logger.warn(
          { webhookConfigId: config.id, event, attempt, statusCode: result.statusCode },
          'Webhook delivery failed, will retry',
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        await logDelivery({
          webhookConfigId: config.id,
          event,
          payload: envelopePayload,
          statusCode: 0,
          responseBody: '',
          success: false,
          attempt,
          errorMessage,
        });

        logger.warn(
          { webhookConfigId: config.id, event, attempt, err },
          'Webhook delivery request failed',
        );
      }

      // Exponential backoff before next retry (skip delay after last attempt)
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    logger.error(
      { webhookConfigId: config.id, event, maxRetries: MAX_RETRIES },
      'Webhook delivery failed after all retries',
    );
  });

  await Promise.allSettled(dispatches);
}

/**
 * Send a test ping to verify a webhook URL is reachable.
 * Sends a test payload and returns the response status.
 *
 * @param {string} url - The webhook URL to verify
 * @param {string} secret - The webhook secret for HMAC signing
 * @returns {Promise<{success: boolean, statusCode: number, message: string}>}
 */
export async function verifyWebhookUrl(url, secret) {
  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Brand Me Now.',
    },
  };
  const payloadString = JSON.stringify(testPayload);
  const signature = computeSignature(payloadString, secret);

  try {
    const result = await sendRequest(url, payloadString, signature);
    const success = result.statusCode >= 200 && result.statusCode < 300;

    return {
      success,
      statusCode: result.statusCode,
      message: success
        ? 'Webhook URL is reachable and responded successfully.'
        : `Webhook URL responded with HTTP ${result.statusCode}.`,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      statusCode: 0,
      message: `Failed to reach webhook URL: ${errorMessage}`,
    };
  }
}
