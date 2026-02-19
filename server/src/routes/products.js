// server/src/routes/products.js

import { Router } from 'express';
import * as productController from '../controllers/products.js';
import { validate } from '../middleware/validate.js';
import { productQuerySchema, productIdParamsSchema } from '../validation/products.js';

export const productRoutes = Router();

// GET /api/v1/products -- List product catalog (with category filter, search)
productRoutes.get('/', validate({ query: productQuerySchema }), productController.listProducts);

// GET /api/v1/products/categories -- List all product categories
// NOTE: This must be registered BEFORE the /:productId route to avoid matching "categories" as a UUID
productRoutes.get('/categories', productController.listCategories);

// GET /api/v1/products/:productId -- Get single product details
productRoutes.get(
  '/:productId',
  validate({ params: productIdParamsSchema }),
  productController.getProduct
);
