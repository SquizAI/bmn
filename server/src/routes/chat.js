// server/src/routes/chat.js

import { Router } from 'express';
import * as chatController from '../controllers/chat.js';

export const chatRoutes = Router();

/**
 * POST /:brandId/message
 * Send a chat message and receive an AI assistant response.
 */
chatRoutes.post('/:brandId/message', chatController.sendMessage);
