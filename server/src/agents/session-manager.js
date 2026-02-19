// server/src/agents/session-manager.js

import { supabaseAdmin } from '../lib/supabase.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Manages agent session persistence for resume capability.
 * Sessions are stored in both Redis (fast lookup) and Supabase (durable).
 *
 * Flow:
 * 1. Agent completes a step -> sessionId returned
 * 2. Server saves sessionId to Redis (24h TTL) + brands table
 * 3. User returns -> server reads sessionId from Redis (fast) or Supabase (fallback)
 * 4. Agent resumed with full prior context via the `resume` option
 */
export const sessionManager = {
  /**
   * Save a session reference after agent completion.
   * @param {Object} params
   * @param {string} params.brandId - The brand UUID
   * @param {string} params.sessionId - Agent SDK session ID
   * @param {string} params.step - Wizard step at time of save
   * @param {number} params.totalCost - Session cost in USD
   */
  async save({ brandId, sessionId, step, totalCost }) {
    // Redis: fast lookup with 24-hour TTL
    await redis.set(
      `session:${brandId}`,
      JSON.stringify({ sessionId, step, totalCost, savedAt: Date.now() }),
      'EX',
      86400
    );

    // Supabase: durable persistence
    await supabaseAdmin
      .from('brands')
      .update({
        agent_session_id: sessionId,
        wizard_step: step,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, sessionId, step }, 'Agent session saved');
  },

  /**
   * Retrieve a session ID for resume.
   * Tries Redis first (fast), falls back to Supabase (durable).
   * @param {string} brandId
   * @returns {Promise<string|null>} Session ID or null if not found/expired
   */
  async get(brandId) {
    // Try Redis first
    const cached = await redis.get(`session:${brandId}`);
    if (cached) {
      const { sessionId } = JSON.parse(cached);
      logger.debug({ brandId, sessionId, source: 'redis' }, 'Session retrieved');
      return sessionId;
    }

    // Fallback to Supabase
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('agent_session_id')
      .eq('id', brandId)
      .single();

    if (error || !data?.agent_session_id) return null;

    logger.debug(
      { brandId, sessionId: data.agent_session_id, source: 'supabase' },
      'Session retrieved'
    );
    return data.agent_session_id;
  },

  /**
   * Clear a session (e.g., when starting fresh).
   * @param {string} brandId
   */
  async clear(brandId) {
    await redis.del(`session:${brandId}`);
    await supabaseAdmin
      .from('brands')
      .update({ agent_session_id: null })
      .eq('id', brandId);

    logger.info({ brandId }, 'Agent session cleared');
  },
};
