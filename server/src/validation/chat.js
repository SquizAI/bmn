// server/src/validation/chat.js

import { z } from 'zod';

/**
 * POST /api/v1/chat/:brandId/message
 * Body schema for sending a chat message.
 */
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
});

/**
 * Params schema for routes that require a brandId.
 */
export const brandIdParamsSchema = z.object({
  brandId: z.string().uuid(),
});

/**
 * Params schema for routes that require a sessionId.
 */
export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * PATCH /api/v1/chat/sessions/:sessionId
 * Body schema for renaming a chat session.
 */
export const renameSessionSchema = z.object({
  title: z.string().min(1).max(200),
});
