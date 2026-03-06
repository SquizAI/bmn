// server/src/routes/storefronts.js

import { Router } from 'express';
import * as storefrontController from '../controllers/storefronts.js';
import * as customDomainController from '../controllers/custom-domains.js';
import { validate } from '../middleware/validate.js';
import { requireFeature } from '../middleware/require-tier.js';
import {
  storefrontCreateSchema,
  storefrontUpdateSchema,
  storefrontIdParamsSchema,
  sectionCreateSchema,
  sectionUpdateSchema,
  sectionIdParamsSchema,
  reorderSectionsSchema,
  testimonialCreateSchema,
  testimonialUpdateSchema,
  testimonialIdParamsSchema,
  faqCreateSchema,
  faqUpdateSchema,
  faqIdParamsSchema,
  analyticsQuerySchema,
  customDomainCreateSchema,
  whiteLabelUpdateSchema,
} from '../validation/storefronts.js';

export const storefrontRoutes = Router();

// ── Storefront CRUD ─────────────────────────────────────────────────────────

// POST /api/v1/storefronts -- Create storefront for a brand
storefrontRoutes.post(
  '/',
  validate({ body: storefrontCreateSchema }),
  storefrontController.createStorefront,
);

// GET /api/v1/storefronts -- List user's storefronts
storefrontRoutes.get('/', storefrontController.listStorefronts);

// GET /api/v1/storefronts/themes -- List available themes (must be before :storefrontId)
storefrontRoutes.get('/themes', storefrontController.listThemes);

// GET /api/v1/storefronts/:storefrontId -- Get storefront details
storefrontRoutes.get(
  '/:storefrontId',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.getStorefront,
);

// PATCH /api/v1/storefronts/:storefrontId -- Update storefront settings
storefrontRoutes.patch(
  '/:storefrontId',
  validate({ params: storefrontIdParamsSchema, body: storefrontUpdateSchema }),
  storefrontController.updateStorefront,
);

// DELETE /api/v1/storefronts/:storefrontId -- Delete storefront
storefrontRoutes.delete(
  '/:storefrontId',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.deleteStorefront,
);

// POST /api/v1/storefronts/:storefrontId/publish -- Publish storefront
storefrontRoutes.post(
  '/:storefrontId/publish',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.publishStorefront,
);

// POST /api/v1/storefronts/:storefrontId/unpublish -- Unpublish storefront
storefrontRoutes.post(
  '/:storefrontId/unpublish',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.unpublishStorefront,
);

// ── Section Management ──────────────────────────────────────────────────────

// GET /api/v1/storefronts/:storefrontId/sections
storefrontRoutes.get(
  '/:storefrontId/sections',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.listSections,
);

// POST /api/v1/storefronts/:storefrontId/sections
storefrontRoutes.post(
  '/:storefrontId/sections',
  validate({ params: storefrontIdParamsSchema, body: sectionCreateSchema }),
  storefrontController.createSection,
);

// PATCH /api/v1/storefronts/:storefrontId/sections/reorder
// NOTE: Must be before the :sectionId route to avoid matching "reorder" as a UUID
storefrontRoutes.patch(
  '/:storefrontId/sections/reorder',
  validate({ params: storefrontIdParamsSchema, body: reorderSectionsSchema }),
  storefrontController.reorderSections,
);

// PATCH /api/v1/storefronts/:storefrontId/sections/:sectionId
storefrontRoutes.patch(
  '/:storefrontId/sections/:sectionId',
  validate({ params: sectionIdParamsSchema, body: sectionUpdateSchema }),
  storefrontController.updateSection,
);

// DELETE /api/v1/storefronts/:storefrontId/sections/:sectionId
storefrontRoutes.delete(
  '/:storefrontId/sections/:sectionId',
  validate({ params: sectionIdParamsSchema }),
  storefrontController.deleteSection,
);

// ── Testimonials ────────────────────────────────────────────────────────────

// GET /api/v1/storefronts/:storefrontId/testimonials
storefrontRoutes.get(
  '/:storefrontId/testimonials',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.listTestimonials,
);

// POST /api/v1/storefronts/:storefrontId/testimonials
storefrontRoutes.post(
  '/:storefrontId/testimonials',
  validate({ params: storefrontIdParamsSchema, body: testimonialCreateSchema }),
  storefrontController.createTestimonial,
);

// PATCH /api/v1/storefronts/:storefrontId/testimonials/:testimonialId
storefrontRoutes.patch(
  '/:storefrontId/testimonials/:testimonialId',
  validate({ params: testimonialIdParamsSchema, body: testimonialUpdateSchema }),
  storefrontController.updateTestimonial,
);

// DELETE /api/v1/storefronts/:storefrontId/testimonials/:testimonialId
storefrontRoutes.delete(
  '/:storefrontId/testimonials/:testimonialId',
  validate({ params: testimonialIdParamsSchema }),
  storefrontController.deleteTestimonial,
);

// ── FAQs ────────────────────────────────────────────────────────────────────

// GET /api/v1/storefronts/:storefrontId/faqs
storefrontRoutes.get(
  '/:storefrontId/faqs',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.listFaqs,
);

// POST /api/v1/storefronts/:storefrontId/faqs
storefrontRoutes.post(
  '/:storefrontId/faqs',
  validate({ params: storefrontIdParamsSchema, body: faqCreateSchema }),
  storefrontController.createFaq,
);

// PATCH /api/v1/storefronts/:storefrontId/faqs/:faqId
storefrontRoutes.patch(
  '/:storefrontId/faqs/:faqId',
  validate({ params: faqIdParamsSchema, body: faqUpdateSchema }),
  storefrontController.updateFaq,
);

// DELETE /api/v1/storefronts/:storefrontId/faqs/:faqId
storefrontRoutes.delete(
  '/:storefrontId/faqs/:faqId',
  validate({ params: faqIdParamsSchema }),
  storefrontController.deleteFaq,
);

// ── Analytics & Contacts ────────────────────────────────────────────────────

// GET /api/v1/storefronts/:storefrontId/analytics
storefrontRoutes.get(
  '/:storefrontId/analytics',
  validate({ params: storefrontIdParamsSchema, query: analyticsQuerySchema }),
  storefrontController.getAnalytics,
);

// GET /api/v1/storefronts/:storefrontId/contacts
storefrontRoutes.get(
  '/:storefrontId/contacts',
  validate({ params: storefrontIdParamsSchema }),
  storefrontController.listContacts,
);

// ── Custom Domain (Agency tier only) ──────────────────────────────────────

// POST /api/v1/storefronts/:storefrontId/domain -- Add custom domain
storefrontRoutes.post(
  '/:storefrontId/domain',
  validate({ params: storefrontIdParamsSchema, body: customDomainCreateSchema }),
  requireFeature('white_label'),
  customDomainController.addDomain,
);

// GET /api/v1/storefronts/:storefrontId/domain -- Get domain status
storefrontRoutes.get(
  '/:storefrontId/domain',
  validate({ params: storefrontIdParamsSchema }),
  requireFeature('white_label'),
  customDomainController.getDomain,
);

// DELETE /api/v1/storefronts/:storefrontId/domain -- Remove custom domain
storefrontRoutes.delete(
  '/:storefrontId/domain',
  validate({ params: storefrontIdParamsSchema }),
  requireFeature('white_label'),
  customDomainController.removeDomain,
);

// POST /api/v1/storefronts/:storefrontId/domain/verify -- Check DNS verification
storefrontRoutes.post(
  '/:storefrontId/domain/verify',
  validate({ params: storefrontIdParamsSchema }),
  requireFeature('white_label'),
  customDomainController.verifyDomain,
);

// ── White-Label Settings (Agency tier only) ───────────────────────────────

// GET /api/v1/storefronts/:storefrontId/white-label -- Get white-label settings
storefrontRoutes.get(
  '/:storefrontId/white-label',
  validate({ params: storefrontIdParamsSchema }),
  requireFeature('white_label'),
  customDomainController.getWhiteLabel,
);

// PATCH /api/v1/storefronts/:storefrontId/white-label -- Update white-label settings
storefrontRoutes.patch(
  '/:storefrontId/white-label',
  validate({ params: storefrontIdParamsSchema, body: whiteLabelUpdateSchema }),
  requireFeature('white_label'),
  customDomainController.updateWhiteLabel,
);
