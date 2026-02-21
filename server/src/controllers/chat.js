// server/src/controllers/chat.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { routeModel } from '../skills/_shared/model-router.js';

/**
 * Send a chat message and receive an AI assistant response.
 *
 * POST /api/v1/chat/:brandId/message
 * Body: { content: string, sessionId: string }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { content, sessionId } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    // Fetch brand context for the AI
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name, wizard_state, wizard_step')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      logger.warn({ brandId, userId, error: brandError?.message }, 'Chat: brand not found');
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Fetch recent chat history for context
    const { data: history } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Save user message
    await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      brand_id: brandId,
      session_id: sessionId,
      role: 'user',
      content: content.trim(),
    });

    // Build context-aware system prompt
    const wizardStep = brand.wizard_step || 'unknown';
    const brandName = brand.name || 'your brand';
    const systemPrompt = [
      `You are a friendly, concise brand advisor helping a creator build their brand "${brandName}".`,
      `They are currently on the "${wizardStep}" step of the brand wizard.`,
      'Keep responses under 3 sentences unless they ask for detail.',
      'Be encouraging and specific.',
    ].join(' ');

    // Build conversation as a single prompt string (model-router uses `prompt`, not `messages`)
    const conversationLines = (history || []).map(
      (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`,
    );
    conversationLines.push(`User: ${content.trim()}`);
    conversationLines.push('Assistant:');

    const prompt = conversationLines.join('\n');

    const result = await routeModel('chatbot', {
      systemPrompt,
      prompt,
      maxTokens: 512,
      temperature: 0.7,
    });

    const assistantContent = result.text || 'Sorry, I could not generate a response.';

    // Save assistant message
    await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      brand_id: brandId,
      session_id: sessionId,
      role: 'assistant',
      content: assistantContent,
      model_used: result.model,
      tokens_used: result.usage?.inputTokens + result.usage?.outputTokens || 0,
    });

    logger.info(
      {
        brandId,
        sessionId,
        model: result.model,
        wasFallback: result.wasFallback || false,
      },
      'Chat message processed',
    );

    res.json({
      success: true,
      data: { role: 'assistant', content: assistantContent },
    });
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Chat sendMessage failed');
    next(err);
  }
}

// ── Session CRUD ──────────────────────────────────────────────────────

/**
 * List user's chat sessions.
 * GET /api/v1/chat/sessions
 */
export async function listSessions(req, res, next) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, brand_id, title, message_count, last_message_at, created_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, data: { items: data } });
  } catch (err) {
    logger.error({ error: err.message }, 'Chat listSessions failed');
    next(err);
  }
}

/**
 * Get messages for a session.
 * GET /api/v1/chat/sessions/:sessionId
 */
export async function getSessionMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Verify session ownership
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, message_type, metadata, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    res.json({ success: true, data: { messages: data } });
  } catch (err) {
    logger.error({ error: err.message }, 'Chat getSessionMessages failed');
    next(err);
  }
}

/**
 * Rename a session.
 * PATCH /api/v1/chat/sessions/:sessionId
 */
export async function renameSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, data: { message: 'Session renamed' } });
  } catch (err) {
    logger.error({ error: err.message }, 'Chat renameSession failed');
    next(err);
  }
}

/**
 * Delete a session and its messages.
 * DELETE /api/v1/chat/sessions/:sessionId
 */
export async function deleteSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Delete messages first
    await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    // Delete session
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, data: { message: 'Session deleted' } });
  } catch (err) {
    logger.error({ error: err.message }, 'Chat deleteSession failed');
    next(err);
  }
}
