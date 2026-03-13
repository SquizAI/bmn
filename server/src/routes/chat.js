// server/src/routes/chat.js

import { Router } from 'express';
import * as chatController from '../controllers/chat.js';
import { validate } from '../middleware/validate.js';
import {
  sendMessageSchema,
  brandIdParamsSchema,
  sessionIdParamsSchema,
  renameSessionSchema,
} from '../validation/chat.js';

export const chatRoutes = Router();

// ── Session CRUD ──────────────────────────────────────────────────────
// NOTE: Session routes MUST be registered before /:brandId routes
// to prevent "sessions" from being matched as a brandId param.

/** GET /sessions — List user's chat sessions */
chatRoutes.get('/sessions', chatController.listSessions);

/** GET /sessions/:sessionId — Get messages for a session */
chatRoutes.get(
  '/sessions/:sessionId',
  validate({ params: sessionIdParamsSchema }),
  chatController.getSessionMessages
);

/** PATCH /sessions/:sessionId — Rename a session */
chatRoutes.patch(
  '/sessions/:sessionId',
  validate({ params: sessionIdParamsSchema, body: renameSessionSchema }),
  chatController.renameSession
);

/** DELETE /sessions/:sessionId — Delete a session */
chatRoutes.delete(
  '/sessions/:sessionId',
  validate({ params: sessionIdParamsSchema }),
  chatController.deleteSession
);

// ── Brand-scoped routes ─────────────────────────────────────────────────

/**
 * POST /:brandId/message
 * Send a chat message and receive an AI assistant response (non-streaming REST fallback).
 */
chatRoutes.post(
  '/:brandId/message',
  validate({ params: brandIdParamsSchema, body: sendMessageSchema }),
  chatController.sendMessage
);
