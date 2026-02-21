// server/src/routes/packaging-templates.js

import { Router } from 'express';
import * as templatesController from '../controllers/packaging-templates.js';

export const packagingTemplateRoutes = Router();

// GET /api/v1/packaging-templates -- List all active templates (optional ?category= filter)
packagingTemplateRoutes.get('/', templatesController.listTemplates);

// GET /api/v1/packaging-templates/by-category/:category -- Templates for a specific category
packagingTemplateRoutes.get('/by-category/:category', templatesController.getTemplatesByCategory);

// GET /api/v1/packaging-templates/:templateId -- Single template with full zone definitions
packagingTemplateRoutes.get('/:templateId', templatesController.getTemplate);
