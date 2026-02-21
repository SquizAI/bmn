import { useNavigate } from 'react-router';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Package,
  ShoppingBag,
  Sparkles,
  BarChart3,
  Columns,
  Zap,
  Check,
  Store,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { RecommendedProductGrid } from '@/components/products/RecommendedProductGrid';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { ConfettiBurst } from '@/components/animations/ConfettiBurst';
import { ProductCompare } from '@/components/products/ProductCompare';
import { RevenueEstimate } from '@/components/products/RevenueEstimate';
import {
  useProducts,
  useProductRecommendations,
  useGenerateRecommendations,
} from '@/hooks/use-products';
import { useSaveProductSelections } from '@/hooks/use-wizard-actions';
import { useWizardStore } from '@/stores/wizard-store';
import { useUIStore } from '@/stores/ui-store';
import { ROUTES } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { SeasonalBadge } from '@/components/products/SeasonalBadge';
import { SocialProofBadge } from '@/components/products/SocialProofBadge';
import { CustomProductRequest } from '@/components/products/CustomProductRequest';
import type { RecommendedProduct } from '@/components/products/ProductRecommendationCard';

// ------ Skeleton Loader ------

function ProductGridSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading products">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading product recommendations...</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.1 }}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-surface/80 shadow-sm"
          >
            {/* Shimmer */}
            <motion.div
              className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/6 to-transparent"
              animate={{ translateX: ['calc(-100%)', 'calc(100%)'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 0.5 }}
            />

            {/* Product image */}
            <div
              className="aspect-4/3 bg-border/15 animate-pulse flex items-center justify-center"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <ShoppingBag className="h-8 w-8 text-text-muted/15" />
            </div>

            {/* Product info */}
            <div className="p-4 space-y-2.5">
              {/* Category badge */}
              <div
                className="h-5 w-20 rounded-full bg-accent/10 animate-pulse"
                style={{ animationDelay: `${i * 0.12 + 0.05}s` }}
              />
              {/* Name */}
              <div
                className="h-4 w-3/4 rounded bg-border/30 animate-pulse"
                style={{ animationDelay: `${i * 0.12 + 0.1}s` }}
              />
              {/* Description lines */}
              <div className="space-y-1.5">
                <div
                  className="h-3 w-full rounded bg-border/20 animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.15}s` }}
                />
                <div
                  className="h-3 w-2/3 rounded bg-border/20 animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.2}s` }}
                />
              </div>
              {/* Price + select row */}
              <div className="flex items-center justify-between pt-1">
                <div
                  className="h-5 w-16 rounded bg-border/25 animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.25}s` }}
                />
                <div
                  className="h-8 w-20 rounded-md bg-primary/10 animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.3}s` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ------ Component ------

export default function ProductSelectionPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const storedSkus = useWizardStore((s) => s.products.selectedSkus);
  const setProducts = useWizardStore((s) => s.setProducts);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);
  const dossierProfile = useWizardStore((s) => s.dossier.profile);

  // Build audience data from dossier for revenue scaling
  const audienceData = useMemo(() => {
    if (dossierProfile && dossierProfile.totalFollowers > 0 && dossierProfile.engagementRate > 0) {
      return {
        followers: dossierProfile.totalFollowers,
        engagementRate: dossierProfile.engagementRate,
      };
    }
    return null;
  }, [dossierProfile]);

  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set(storedSkus));
  const [showCelebration, setShowCelebration] = useState(false);
  const [detailProduct, setDetailProduct] = useState<RecommendedProduct | null>(null);
  const [compareProducts, setCompareProducts] = useState<RecommendedProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [view, setView] = useState<'recommendations' | 'catalog' | 'quick-launch'>('recommendations');

  // Data fetching
  const { data: productsData, isLoading: catalogLoading } = useProducts();
  const {
    data: recommendations,
    isLoading: recsLoading,
    isError: recsError,
  } = useProductRecommendations(brandId);
  const generateRecs = useGenerateRecommendations();
  const saveSelections = useSaveProductSelections();

  const hasRecommendations = !!recommendations?.products?.length;
  const isLoading = view === 'recommendations'
    ? (recsLoading || generateRecs.isPending)
    : (view === 'catalog' || view === 'quick-launch')
      ? catalogLoading
      : false;

  // Filter TruvaNutra / quick-launch products from the catalog
  const quickLaunchProducts = useMemo(() => {
    if (!productsData?.items) return [];
    return productsData.items.filter(
      (p) => p.isTruvanutra === true || p.is_truvanutra === true,
    );
  }, [productsData]);

  // Auto-generate recommendations when none exist and brand has a dossier
  const hasTriggeredGeneration = useRef(false);
  useEffect(() => {
    if (
      brandId &&
      !recsLoading &&
      !hasRecommendations &&
      !recsError &&
      !generateRecs.isPending &&
      !generateRecs.isSuccess &&
      !hasTriggeredGeneration.current
    ) {
      hasTriggeredGeneration.current = true;
      generateRecs.mutate(
        { brandId },
        {
          onError: () => {
            addToast({ type: 'error', title: 'Failed to generate product recommendations' });
          },
        },
      );
    }
  }, [brandId, recsLoading, hasRecommendations, recsError, generateRecs, addToast]);

  // Toggle product selection
  const toggleProduct = useCallback((sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }, []);

  // View product detail
  const handleViewDetail = useCallback(
    (sku: string) => {
      const product = recommendations?.products.find((r) => r.sku === sku);
      if (product) setDetailProduct(product);
    },
    [recommendations],
  );

  // Revenue summary from selected products.
  // Handles two data shapes:
  //   1. Per-product revenue tiers (product.revenue.tiers[])
  //   2. Top-level estimatedMonthlyRevenue from recommendations.summary (server returns flat revenueProjection)
  const revenueSummary = useMemo(() => {
    if (!recommendations?.products) return null;
    if (selectedSkus.size === 0) return null;

    const selected = recommendations.products.filter((r) =>
      selectedSkus.has(r.sku),
    );
    if (selected.length === 0) return null;

    // Check if per-product revenue tiers are available
    const hasPerProductRevenue = selected[0]?.revenue?.tiers?.length > 0;

    if (hasPerProductRevenue) {
      // Original logic: sum per-product revenue tiers
      const totals = { conservative: 0, moderate: 0, aggressive: 0 };
      for (const product of selected) {
        for (const tier of product.revenue?.tiers || []) {
          const key = tier.label as keyof typeof totals;
          if (totals[key] !== undefined) {
            totals[key] += tier.monthlyRevenue;
          }
        }
      }

      return [
        {
          label: 'conservative' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(totals.conservative * 100) / 100,
          monthlyProfit: Math.round(totals.conservative * 0.6 * 100) / 100,
          annualRevenue: Math.round(totals.conservative * 12 * 100) / 100,
          annualProfit: Math.round(totals.conservative * 0.6 * 12 * 100) / 100,
        },
        {
          label: 'moderate' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(totals.moderate * 100) / 100,
          monthlyProfit: Math.round(totals.moderate * 0.6 * 100) / 100,
          annualRevenue: Math.round(totals.moderate * 12 * 100) / 100,
          annualProfit: Math.round(totals.moderate * 0.6 * 12 * 100) / 100,
        },
        {
          label: 'aggressive' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(totals.aggressive * 100) / 100,
          monthlyProfit: Math.round(totals.aggressive * 0.6 * 100) / 100,
          annualRevenue: Math.round(totals.aggressive * 12 * 100) / 100,
          annualProfit: Math.round(totals.aggressive * 0.6 * 12 * 100) / 100,
        },
      ];
    }

    // Fallback: use top-level revenue estimates, scaled by the ratio of selected products.
    // The server returns revenueProjection.estimatedMonthlyRevenue with low/mid/high keys.
    const est = recommendations.revenueProjection?.estimatedMonthlyRevenue;
    if (est) {
      const totalProducts = recommendations.products.length;
      const selectedRatio = selected.length / totalProducts;
      // Normalise key names: server may use low/mid/high or conservative/moderate/aggressive
      const low = (est as Record<string, number>).conservative ?? (est as Record<string, number>).low ?? 0;
      const mid = (est as Record<string, number>).moderate ?? (est as Record<string, number>).mid ?? 0;
      const high = (est as Record<string, number>).aggressive ?? (est as Record<string, number>).high ?? 0;

      return [
        {
          label: 'conservative' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(low * selectedRatio * 100) / 100,
          monthlyProfit: Math.round(low * selectedRatio * 0.6 * 100) / 100,
          annualRevenue: Math.round(low * selectedRatio * 12 * 100) / 100,
          annualProfit: Math.round(low * selectedRatio * 0.6 * 12 * 100) / 100,
        },
        {
          label: 'moderate' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(mid * selectedRatio * 100) / 100,
          monthlyProfit: Math.round(mid * selectedRatio * 0.6 * 100) / 100,
          annualRevenue: Math.round(mid * selectedRatio * 12 * 100) / 100,
          annualProfit: Math.round(mid * selectedRatio * 0.6 * 12 * 100) / 100,
        },
        {
          label: 'aggressive' as const,
          unitsPerMonth: 0,
          monthlyRevenue: Math.round(high * selectedRatio * 100) / 100,
          monthlyProfit: Math.round(high * selectedRatio * 0.6 * 100) / 100,
          annualRevenue: Math.round(high * selectedRatio * 12 * 100) / 100,
          annualProfit: Math.round(high * selectedRatio * 0.6 * 12 * 100) / 100,
        },
      ];
    }

    return null;
  }, [recommendations, selectedSkus]);

  const handleContinue = async () => {
    if (selectedSkus.size === 0 || !brandId) return;

    const skusArray = Array.from(selectedSkus);
    setProducts({ selectedSkus: skusArray });

    try {
      await saveSelections.mutateAsync({ brandId, productSkus: skusArray });
    } catch {
      addToast({ type: 'error', title: 'Failed to save product selections' });
      return;
    }

    setShowCelebration(true);
    setTimeout(() => {
      setShowCelebration(false);
      setStep('mockup-review');
      navigate(ROUTES.WIZARD_MOCKUP_REVIEW);
    }, 1200);
  };

  const handleBack = () => {
    setStep('logo-generation');
    navigate(ROUTES.WIZARD_LOGO_GENERATION);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative flex flex-col gap-8"
    >
      {showCelebration && <ConfettiBurst active duration={2000} />}

      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Product Selection</h2>
        <p className="mt-2 text-text-secondary">
          {hasRecommendations
            ? 'AI has analyzed your brand and ranked the best products for you.'
            : 'Choose the products you want to brand. We will generate mockups for each selected product.'}
        </p>
      </div>

      {/* Selection summary bar */}
      {selectedSkus.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-light px-5 py-3"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {selectedSkus.size} product{selectedSkus.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          {revenueSummary && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <BarChart3 className="h-4 w-4" />
              <span className="font-medium">
                Est. {formatCurrency(revenueSummary[1].monthlyRevenue)}/mo
              </span>
            </div>
          )}

          {/* Compare button */}
          {selectedSkus.size >= 2 && selectedSkus.size <= 4 && recommendations && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const prods = recommendations.products.filter((r) =>
                  selectedSkus.has(r.sku),
                );
                setCompareProducts(prods);
                setShowCompare(true);
              }}
              leftIcon={<Columns className="h-3.5 w-3.5" />}
            >
              Compare
            </Button>
          )}
        </motion.div>
      )}

      {/* View toggle: AI Recommendations vs Full Catalog vs Quick Launch */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product view options">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'recommendations'}
          onClick={() => setView('recommendations')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            view === 'recommendations'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:text-text',
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Recommendations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'catalog'}
          onClick={() => setView('catalog')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            view === 'catalog'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:text-text',
          )}
        >
          <Package className="h-3.5 w-3.5" />
          Full Catalog
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'quick-launch'}
          onClick={() => setView('quick-launch')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            view === 'quick-launch'
              ? 'bg-accent text-white'
              : 'bg-surface-hover text-text-secondary hover:text-text',
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Quick Launch
        </button>
      </div>

      {/* Revenue estimate for selected products */}
      {revenueSummary && selectedSkus.size > 0 && (
        <RevenueEstimate tiers={revenueSummary} audienceData={audienceData} />
      )}

      {/* Main content */}
      {isLoading ? (
        <ProductGridSkeleton />
      ) : view === 'recommendations' && hasRecommendations ? (
        <RecommendedProductGrid
          recommendations={recommendations!.products}
          selectedSkus={selectedSkus}
          onToggleProduct={toggleProduct}
          onViewDetail={handleViewDetail}
        />
      ) : view === 'recommendations' && !hasRecommendations ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>No Recommendations Yet</CardTitle>
          <CardDescription className="mt-2">
            AI product recommendations are generated from your Creator Dossier.
            Switch to the Full Catalog to browse all products manually.
          </CardDescription>
        </Card>
      ) : view === 'quick-launch' ? (
        /* Quick Launch -- TruvaNutra ready-to-ship products */
        <div className="flex flex-col gap-6">
          {/* Quick Launch banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-accent/30 bg-linear-to-r from-accent/5 to-accent/10 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">
                  Start selling today with our ready-to-ship products
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  TruvaNutra products are pre-manufactured and ready to ship under your brand.
                  Earn commissions on every sale while your custom products are being finalized.
                </p>
              </div>
            </div>
          </motion.div>

          {quickLaunchProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickLaunchProducts.map((product) => {
                const isSelected = selectedSkus.has(product.sku);
                const commissionRate = 25; // Default commission rate for TruvaNutra
                const commissionAmount = product.suggestedRetail * (commissionRate / 100);
                return (
                  <motion.div key={product.sku} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card
                      variant="interactive"
                      padding="none"
                      className={cn(
                        'overflow-hidden transition-all',
                        isSelected && 'ring-2 ring-accent border-accent',
                      )}
                    >
                      <div className="relative">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center bg-surface-hover">
                            <Package className="h-12 w-12 text-text-muted" />
                          </div>
                        )}
                        {/* TruvaNutra badge */}
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white shadow-md">
                          <Zap className="h-3 w-3" />
                          Ready to Ship
                        </div>
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-md">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-text">{product.name}</h3>
                        <p className="mt-1 text-xs capitalize text-text-muted">{product.category}</p>

                        {/* Commission-based pricing */}
                        <div className="mt-3 rounded-lg bg-accent/5 p-2.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">Retail Price</span>
                            <span className="font-bold text-text">
                              {formatCurrency(product.suggestedRetail)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-text-secondary">Your Commission ({commissionRate}%)</span>
                            <span className="font-bold text-accent">
                              {formatCurrency(commissionAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Certifications */}
                        {product.certifications && product.certifications.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {product.certifications.map((cert) => (
                              <span
                                key={cert}
                                className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Add to Store button */}
                        <button
                          type="button"
                          onClick={() => toggleProduct(product.sku)}
                          className={cn(
                            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all',
                            isSelected
                              ? 'bg-accent text-white'
                              : 'bg-surface-hover text-text hover:bg-accent/10 hover:text-accent',
                          )}
                        >
                          <Store className="h-3.5 w-3.5" />
                          {isSelected ? 'Added to Store' : 'Add to Store'}
                        </button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card variant="outlined" padding="lg" className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>Quick Launch Products Coming Soon</CardTitle>
              <CardDescription className="mt-2">
                TruvaNutra ready-to-ship products will be available here shortly.
                In the meantime, check out the AI Recommendations or Full Catalog tabs.
              </CardDescription>
            </Card>
          )}
        </div>
      ) : (
        /* Full catalog fallback -- simple grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(productsData?.items || []).map((product) => {
            const isSelected = selectedSkus.has(product.sku);
            return (
              <motion.div key={product.sku} layout>
                <Card
                  variant="interactive"
                  padding="none"
                  className={cn(
                    'overflow-hidden transition-all',
                    isSelected && 'ring-2 ring-primary border-primary',
                  )}
                  onClick={() => toggleProduct(product.sku)}
                >
                  <div className="relative">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-surface-hover">
                        <Package className="h-12 w-12 text-text-muted" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md">
                        <span className="text-sm font-bold">✓</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-text">{product.name}</h3>
                    <p className="mt-1 text-xs text-text-muted capitalize">{product.category}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <SeasonalBadge category={product.category} />
                      <SocialProofBadge productSku={product.sku} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">
                        {formatCurrency(product.basePrice)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover text-text-muted',
                        )}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Custom product request */}
      {brandId && (
        <CustomProductRequest
          brandId={brandId}
          onSubmit={() => addToast({ type: 'success', title: 'Product request submitted!' })}
        />
      )}

      {/* Compare overlay */}
      <AnimatePresence>
        {showCompare && compareProducts.length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCompare(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Compare products"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-text">Compare Products</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCompare(false)}>
                  Close
                </Button>
              </div>
              <ProductCompare
                products={compareProducts}
                onRemove={(sku) =>
                  setCompareProducts((prev) => prev.filter((p) => p.sku !== sku))
                }
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        isOpen={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        isSelected={detailProduct ? selectedSkus.has(detailProduct.sku) : false}
        onToggle={toggleProduct}
      />

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="h-5 w-5" />}
        >
          Back
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={selectedSkus.size === 0}
          loading={saveSelections.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          Continue with {selectedSkus.size} Product{selectedSkus.size !== 1 ? 's' : ''}
        </Button>
      </div>
    </motion.div>
  );
}
