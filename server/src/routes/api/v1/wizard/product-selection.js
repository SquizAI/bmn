// server/src/routes/api/v1/wizard/product-selection.js

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { validate } from '../../../../middleware/validate.js';

export const productSelectionRouter = Router();

const saveSelectionsBody = z.object({
  brandId: z.string().uuid(),
  productSkus: z.array(z.string()).min(1).max(20),
});

// ---- PUT /api/v1/wizard/product-selection ----
// Save the user's product selections for the current brand.

productSelectionRouter.put(
  '/',
  validate({ body: saveSelectionsBody }),
  async (req, res, next) => {
    try {
      const { brandId, productSkus } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({ success: false, error: 'Brand not found' });
      }

      // Verify all SKUs exist
      const { data: products, error: productError } = await supabaseAdmin
        .from('products')
        .select('sku')
        .in('sku', productSkus)
        .eq('is_active', true);

      if (productError) {
        return res.status(500).json({ success: false, error: 'Failed to validate products' });
      }

      const validSkus = new Set(products.map((p) => p.sku));
      const invalidSkus = productSkus.filter((sku) => !validSkus.has(sku));
      if (invalidSkus.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid product SKUs: ${invalidSkus.join(', ')}`,
        });
      }

      // Clear existing selections for this brand
      await supabaseAdmin
        .from('brand_products')
        .delete()
        .eq('brand_id', brandId);

      // Insert new selections
      const rows = productSkus.map((sku) => ({
        brand_id: brandId,
        product_sku: sku,
        user_id: userId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('brand_products')
        .insert(rows);

      if (insertError) {
        logger.error({ msg: 'Failed to save product selections', error: insertError.message });
        return res.status(500).json({ success: false, error: 'Failed to save product selections' });
      }

      // Update brand wizard state
      await supabaseAdmin
        .from('brands')
        .update({ wizard_step: 'product-selection', updated_at: new Date().toISOString() })
        .eq('id', brandId);

      res.json({
        success: true,
        data: { brandId, selectedSkus: productSkus, count: productSkus.length },
      });
    } catch (err) {
      logger.error({ msg: 'Product selection save failed', error: err.message });
      next(err);
    }
  }
);
