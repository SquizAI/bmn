// server/src/skills/product-recommender/tools.js

import { getProductCatalog } from './tools/get-product-catalog.js';
import { analyzeNicheProductFit } from './tools/analyze-niche-product-fit.js';
import { estimatePersonalizedRevenue } from './tools/estimate-personalized-revenue.js';
import { suggestBundles } from './tools/suggest-bundles.js';
import { synthesizeRecommendations } from './tools/synthesize-recommendations.js';

export const tools = {
  getProductCatalog,
  analyzeNicheProductFit,
  estimatePersonalizedRevenue,
  suggestBundles,
  synthesizeRecommendations,
};
