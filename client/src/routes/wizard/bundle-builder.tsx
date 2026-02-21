import { useNavigate } from 'react-router';
import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Gift,
  TrendingUp,
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  BundleBuilderComponent,
  type BundleSuggestion,
} from '@/components/products/BundleBuilder';
import { RevenueEstimate } from '@/components/products/RevenueEstimate';
import { useWizardStore } from '@/stores/wizard-store';
import { useProductRecommendations, useProducts } from '@/hooks/use-products';
import { useUIStore } from '@/stores/ui-store';
import { ROUTES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { generateId } from '@/lib/utils';

// ------ Component ------

export default function BundleBuilderPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const selectedSkus = useWizardStore((s) => s.products.selectedSkus);
  const bundles = useWizardStore((s) => s.products.bundles);
  const addBundle = useWizardStore((s) => s.addBundle);
  const removeBundle = useWizardStore((s) => s.removeBundle);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const { data: recommendations, isLoading: recsLoading } =
    useProductRecommendations(brandId);
  const { data: productsData } = useProducts();

  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(
    new Set(bundles.map((b) => b.id).filter(Boolean) as string[]),
  );

  // Get AI-suggested bundles from recommendations
  const suggestedBundles: BundleSuggestion[] = recommendations?.bundles || [];

  // Get available products (those that were selected in product-selection step)
  const availableProducts = (productsData?.items || [])
    .filter((p) => selectedSkus.includes(p.sku))
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      imageUrl: p.imageUrl,
      suggestedRetail: p.basePrice,
    }));

  const handleSelectBundle = useCallback(
    (bundleId: string) => {
      setSelectedBundleIds((prev) => {
        const next = new Set(prev);
        if (next.has(bundleId)) {
          next.delete(bundleId);
        } else {
          next.add(bundleId);
        }
        return next;
      });
    },
    [],
  );

  const handleCreateBundle = useCallback(
    (bundle: { name: string; productSkus: string[] }) => {
      const id = generateId();
      addBundle({
        id,
        name: bundle.name,
        productSkus: bundle.productSkus,
      });
      setSelectedBundleIds((prev) => new Set([...prev, id]));
      addToast({ type: 'success', title: `Bundle "${bundle.name}" created` });
    },
    [addBundle, addToast],
  );

  // Calculate combined revenue for selected bundles
  const bundleRevenueSummary = (() => {
    const selectedSuggested = suggestedBundles.filter((b) =>
      selectedBundleIds.has(b.id),
    );
    if (selectedSuggested.length === 0) return null;

    const totals = { conservative: 0, moderate: 0, aggressive: 0 };
    for (const bundle of selectedSuggested) {
      totals.conservative += bundle.estimatedMonthlyRevenue.conservative;
      totals.moderate += bundle.estimatedMonthlyRevenue.moderate;
      totals.aggressive += bundle.estimatedMonthlyRevenue.aggressive;
    }

    return [
      {
        label: 'conservative' as const,
        unitsPerMonth: 0,
        monthlyRevenue: Math.round(totals.conservative * 100) / 100,
        monthlyProfit: Math.round(totals.conservative * 0.5 * 100) / 100,
        annualRevenue: Math.round(totals.conservative * 12 * 100) / 100,
        annualProfit: Math.round(totals.conservative * 0.5 * 12 * 100) / 100,
      },
      {
        label: 'moderate' as const,
        unitsPerMonth: 0,
        monthlyRevenue: Math.round(totals.moderate * 100) / 100,
        monthlyProfit: Math.round(totals.moderate * 0.5 * 100) / 100,
        annualRevenue: Math.round(totals.moderate * 12 * 100) / 100,
        annualProfit: Math.round(totals.moderate * 0.5 * 12 * 100) / 100,
      },
      {
        label: 'aggressive' as const,
        unitsPerMonth: 0,
        monthlyRevenue: Math.round(totals.aggressive * 100) / 100,
        monthlyProfit: Math.round(totals.aggressive * 0.5 * 100) / 100,
        annualRevenue: Math.round(totals.aggressive * 12 * 100) / 100,
        annualProfit: Math.round(totals.aggressive * 0.5 * 12 * 100) / 100,
      },
    ];
  })();

  const handleContinue = () => {
    // Save selected bundles to store
    const allBundles = [
      ...suggestedBundles
        .filter((b) => selectedBundleIds.has(b.id))
        .map((b) => ({
          id: b.id,
          name: b.name,
          productSkus: b.productSkus,
        })),
      ...bundles.filter((b) => b.id && selectedBundleIds.has(b.id)),
    ];

    // Remove old bundles and add selected ones
    while (bundles.length > 0) {
      removeBundle(0);
    }
    for (const bundle of allBundles) {
      addBundle(bundle);
    }

    setStep('profit-calculator');
    navigate(ROUTES.WIZARD_PROFIT_CALCULATOR);
  };

  const handleSkip = () => {
    setStep('profit-calculator');
    navigate(ROUTES.WIZARD_PROFIT_CALCULATOR);
  };

  const handleBack = () => {
    setStep('mockup-review');
    navigate(ROUTES.WIZARD_MOCKUP_REVIEW);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
          <Gift className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Bundle Builder</h2>
        <p className="mt-2 text-text-secondary">
          Group your products into bundles for higher average order values and better customer deals.
        </p>
      </div>

      {/* Revenue from bundles */}
      {bundleRevenueSummary && selectedBundleIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} aria-live="polite">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold text-text">
              Bundle Revenue Estimate ({selectedBundleIds.size} bundle
              {selectedBundleIds.size !== 1 ? 's' : ''})
            </span>
          </div>
          <RevenueEstimate tiers={bundleRevenueSummary} />
        </motion.div>
      )}

      {/* Bundle builder content */}
      {recsLoading ? (
        <div className="flex justify-center py-12" role="status" aria-busy="true" aria-label="Loading bundle suggestions">
          <Spinner size="lg" />
        </div>
      ) : (
        <BundleBuilderComponent
          suggestedBundles={suggestedBundles}
          availableProducts={availableProducts}
          onCreateBundle={handleCreateBundle}
          onSelectBundle={handleSelectBundle}
          selectedBundleIds={selectedBundleIds}
        />
      )}

      {/* Tip */}
      {suggestedBundles.length > 0 && (
        <Card variant="outlined" padding="sm" className="border-primary/20 bg-primary-light/30">
          <p className="text-xs text-text-secondary">
            <strong className="text-text">Tip:</strong> Bundles typically increase average order
            value by 25-40% and encourage customers to try more products. A 10-20% bundle discount
            still yields higher total profit per order.
          </p>
        </Card>
      )}

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
          variant="ghost"
          size="lg"
          onClick={handleSkip}
          rightIcon={<SkipForward className="h-5 w-5" />}
        >
          Skip Bundles
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          {selectedBundleIds.size > 0
            ? `Continue with ${selectedBundleIds.size} Bundle${selectedBundleIds.size !== 1 ? 's' : ''}`
            : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}
