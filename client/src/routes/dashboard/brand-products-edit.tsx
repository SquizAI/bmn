import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  ShoppingBag,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useBrandDetail, type BrandProjection } from '@/hooks/use-brand-detail';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { ROUTES, QUERY_KEYS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

// ------ Product Card ------

interface ProductCardProps {
  product: BrandProjection;
  onRemove: (sku: string) => void;
  removing: boolean;
}

function ProductCard({ product, onRemove, removing }: ProductCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-hover"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-light">
        <Package className="h-6 w-6 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{product.productName}</p>
        <p className="text-xs text-text-muted mt-0.5">SKU: {product.productSku}</p>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-xs text-text-muted">Cost</p>
          <p className="font-medium text-text-secondary">{formatCurrency(product.costPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted">Retail</p>
          <p className="font-medium text-text">{formatCurrency(product.retailPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted">Margin</p>
          <p className="font-medium text-success">{Math.round(product.margin * 100)}%</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(product.productSku)}
        disabled={removing}
        className="text-text-muted hover:text-error shrink-0"
        aria-label={`Remove ${product.productName}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

// ------ Summary Stats ------

function ProductSummary({ projections }: { projections: BrandProjection[] }) {
  const totalMonthlyRevenue = projections.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const totalMonthlyProfit = projections.reduce((sum, p) => sum + p.monthlyProfit, 0);
  const avgMargin =
    projections.length > 0
      ? projections.reduce((sum, p) => sum + p.margin, 0) / projections.length
      : 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        { label: 'Products', value: String(projections.length) },
        { label: 'Est. Monthly Revenue', value: formatCurrency(totalMonthlyRevenue) },
        { label: 'Est. Monthly Profit', value: formatCurrency(totalMonthlyProfit) },
        { label: 'Avg Margin', value: `${Math.round(avgMargin * 100)}%` },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg bg-surface-hover p-3 text-center">
          <p className="text-xs text-text-muted">{stat.label}</p>
          <p className="mt-1 text-lg font-bold text-text">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

// ------ Main Component ------

export default function BrandProductsEditPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { data: brand, isLoading, error } = useBrandDetail(brandId);

  const [removingSku, setRemovingSku] = useState<string | null>(null);

  const projections = brand?.projections ?? [];

  const handleRemoveProduct = useCallback(
    async (sku: string) => {
      if (!brandId) return;
      setRemovingSku(sku);
      try {
        await apiClient.delete(`/api/v1/brands/${brandId}/products/${sku}`);
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        addToast({ type: 'success', title: 'Product removed from brand' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to remove product';
        addToast({ type: 'error', title: msg });
      } finally {
        setRemovingSku(null);
      }
    },
    [brandId, queryClient, addToast],
  );

  // ------ Loading / Error States ------

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-lg text-text-secondary">Brand not found</p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text">{brand.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm text-text-secondary">
                Product Selection ({projections.length} products)
              </span>
            </div>
          </div>
        </div>

        <Link to={ROUTES.DASHBOARD_PRODUCTS}>
          <Button
            variant="outline"
            leftIcon={<ShoppingBag className="h-4 w-4" />}
            rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Browse Catalog
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      {projections.length > 0 && <ProductSummary projections={projections} />}

      {/* Product List */}
      {projections.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <CardTitle>Brand Products</CardTitle>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {projections.map((product) => (
                <ProductCard
                  key={product.productSku}
                  product={product}
                  onRemove={handleRemoveProduct}
                  removing={removingSku === product.productSku}
                />
              ))}
            </AnimatePresence>
          </div>
        </Card>
      ) : (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
              <Package className="h-8 w-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-text">No products linked</p>
              <p className="text-sm text-text-secondary mt-1">
                Browse the product catalog to add products to this brand
              </p>
            </div>
            <Link to={ROUTES.DASHBOARD_PRODUCTS}>
              <Button leftIcon={<ShoppingBag className="h-4 w-4" />}>
                Browse Catalog
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
