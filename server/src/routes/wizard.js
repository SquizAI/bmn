// server/src/routes/wizard.js

import { Router } from 'express';
import * as wizardController from '../controllers/wizard.js';
import { validate } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rate-limit.js';
import {
  wizardStartSchema,
  wizardStepUpdateSchema,
  socialHandlesSchema,
  wizardResumeSchema,
} from '../validation/wizard.js';

export const wizardRoutes = Router();

// POST /api/v1/wizard/start -- Start a new wizard session
wizardRoutes.post('/start', validate({ body: wizardStartSchema }), wizardController.startWizard);

// GET /api/v1/wizard/:brandId/state -- Get current wizard state
wizardRoutes.get('/:brandId/state', wizardController.getWizardState);

// PATCH /api/v1/wizard/:brandId/step -- Save wizard step data
wizardRoutes.patch(
  '/:brandId/step',
  validate({ body: wizardStepUpdateSchema }),
  wizardController.saveStepData
);

// POST /api/v1/wizard/:brandId/analyze-social -- Queue social media analysis
wizardRoutes.post(
  '/:brandId/analyze-social',
  validate({ body: socialHandlesSchema }),
  generationLimiter,
  wizardController.analyzeSocial
);

// POST /api/v1/wizard/:brandId/generate-identity -- Queue brand identity generation
wizardRoutes.post(
  '/:brandId/generate-identity',
  generationLimiter,
  wizardController.generateIdentity
);

// POST /api/v1/wizard/:brandId/generate-names -- Queue brand name generation
wizardRoutes.post(
  '/:brandId/generate-names',
  generationLimiter,
  wizardController.generateNames
);

// POST /api/v1/wizard/:brandId/recommend-products -- Get AI product recommendations
wizardRoutes.post(
  '/:brandId/recommend-products',
  generationLimiter,
  wizardController.recommendProducts
);

// POST /api/v1/wizard/:brandId/generate-mockups -- Queue mockup generation
wizardRoutes.post(
  '/:brandId/generate-mockups',
  generationLimiter,
  wizardController.generateMockups
);

// POST /api/v1/wizard/resume -- Resume wizard from HMAC-signed token
wizardRoutes.post(
  '/resume',
  validate({ body: wizardResumeSchema }),
  wizardController.resumeWizard
);

// POST /api/v1/wizard/:brandId/complete -- Mark wizard as complete
wizardRoutes.post('/:brandId/complete', wizardController.completeWizard);
