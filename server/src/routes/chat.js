// server/src/routes/chat.js

import { Router } from 'express';
import * as chatController from '../controllers/chat.js';

export const chatRoutes = Router();

/**
 * POST /:brandId/message
 * Send a chat message and receive an AI assistant response (non-streaming REST fallback).
 */
chatRoutes.post('/:brandId/message', chatController.sendMessage);

// ── Session CRUD ──────────────────────────────────────────────────────

/** GET /sessions — List user's chat sessions */
chatRoutes.get('/sessions', chatController.listSessions);

/** GET /sessions/:sessionId — Get messages for a session */
chatRoutes.get('/sessions/:sessionId', chatController.getSessionMessages);

/** PATCH /sessions/:sessionId — Rename a session */
chatRoutes.patch('/sessions/:sessionId', chatController.renameSession);

/** DELETE /sessions/:sessionId — Delete a session */
chatRoutes.delete('/sessions/:sessionId', chatController.deleteSession);
