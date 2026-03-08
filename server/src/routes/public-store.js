// server/src/routes/public-store.js
// Public storefront API — no authentication required.
// Serves published storefront data to customer-facing store SPA.

import { Router } from 'express';
import * as publicStoreController from '../controllers/public-store.js';
import { validate } from '../middleware/validate.js';
import { serveStorePreview } from '../controllers/store-preview.js';
import {
  storeSlugParamsSchema,
  productIdParamsSchema,
  cartSessionParamsSchema,
  cartCreateSchema,
  contactCreateSchema,
  checkoutCreateSchema,
  pageviewSchema,
  storeProductsQuerySchema,
} from '../validation/storefronts.js';

export const publicStoreRoutes = Router();

// GET /api/v1/store/:slug/preview -- Server-rendered preview page for dashboard iframe
publicStoreRoutes.get(
  '/:slug/preview',
  serveStorePreview,
);

// GET /api/v1/store/:slug -- Get full published storefront data (single request)
publicStoreRoutes.get(
  '/:slug',
  validate({ params: storeSlugParamsSchema }),
  publicStoreController.getPublicStore,
);

// GET /api/v1/store/:slug/products -- Get products for storefront (with category filter)
publicStoreRoutes.get(
  '/:slug/products',
  validate({ params: storeSlugParamsSchema, query: storeProductsQuerySchema }),
  publicStoreController.getStoreProducts,
);

// GET /api/v1/store/:slug/products/:productId -- Get single product detail
publicStoreRoutes.get(
  '/:slug/products/:productId',
  validate({ params: productIdParamsSchema }),
  publicStoreController.getStoreProduct,
);

// POST /api/v1/store/:slug/cart -- Create or update cart
publicStoreRoutes.post(
  '/:slug/cart',
  validate({ params: storeSlugParamsSchema, body: cartCreateSchema }),
  publicStoreController.createOrUpdateCart,
);

// GET /api/v1/store/:slug/cart/:sessionId -- Get cart by session
publicStoreRoutes.get(
  '/:slug/cart/:sessionId',
  validate({ params: cartSessionParamsSchema }),
  publicStoreController.getCart,
);

// POST /api/v1/store/:slug/checkout -- Create Stripe checkout session
publicStoreRoutes.post(
  '/:slug/checkout',
  validate({ params: storeSlugParamsSchema, body: checkoutCreateSchema }),
  publicStoreController.createCheckoutSession,
);

// POST /api/v1/store/:slug/contact -- Submit contact form
publicStoreRoutes.post(
  '/:slug/contact',
  validate({ params: storeSlugParamsSchema, body: contactCreateSchema }),
  publicStoreController.submitContactForm,
);

// POST /api/v1/store/:slug/analytics/pageview -- Track page view
publicStoreRoutes.post(
  '/:slug/analytics/pageview',
  validate({ params: storeSlugParamsSchema, body: pageviewSchema }),
  publicStoreController.trackPageView,
);
