import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ArrowRight,
  Lock,
  Package,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn, capitalize } from '@/lib/utils';
import { useBrowseProducts, useProductCategories } from '@/hooks/use-products';
import { useProductTiers, type ProductTier } from '@/hooks/use-admin-product-tiers';
import { useAuthStore } from '@/stores/auth-store';
import { CatalogProductCard } from '@/components/products/CatalogProductCard';
import { CatalogDetailModal } from '@/components/products/CatalogDetailModal';
import type { Product } from '@/hooks/use-products';

// ------ Tier Overview Card ------

function TierOverviewCard({
  tier,
  productCount,
  isAccessible,
  isActive,
  onClick,
}: {
  tier: ProductTier;
  productCount: number;
  isAccessible: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const subLabel = tier.min_subscription_tier === 'free'
    ? 'All plans'
    : `${capitalize(tier.min_subscription_tier)}+`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-1 flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200',
        isActive
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-border-hover hover:bg-surface-hover/50',
        !isAccessible && 'opacity-70',
      )}
    >
      {/* Color bar top */}
      <div
        className="absolute left-0 top-0 h-1 w-full rounded-t-xl"
        style={{ backgroundColor: tier.badge_color }}
      />

      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: tier.badge_color }}
        >
          {tier.display_name}
        </span>
        {!isAccessible && (
          <Lock className="h-3.5 w-3.5 text-text-muted" />
        )}
      </div>

      <p className="text-lg font-bold text-text">{productCount}</p>
      <p className="text-xs text-text-muted">
        {productCount === 1 ? 'product' : 'products'} &middot; {subLabel}
      </p>
    </button>
  );
}

// ------ Category Emoji Map ------

const CATEGORY_EMOJI: Record<string, string> = {
  supplements: '\u{1F48A}',
  skincare: '\u{2728}',
  wellness: '\u{1F9D8}',
  apparel: '\u{1F455}',
  accessories: '\u{1F45C}',
  home_goods: '\u{1F3E0}',
  packaging: '\u{1F4E6}',
  digital: '\u{1F4BB}',
  food_beverage: '\u{2615}',
  journals: '\u{1F4D3}',
  candles: '\u{1F56F}\uFE0F',
  digital_downloads: '\u{1F4E5}',
};

// ------ Subscription Tier Order (for accessibility check) ------

const SUB_ORDER: Record<string, number> = { free: 0, starter: 1, pro: 2, agency: 3 };

// ------ Main Page ------

export default function ProductCatalogPage() {
  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTier, setActiveTier] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Auth for subscription level check
  const profile = useAuthStore((s) => s.profile);
  const userSubTier = profile?.subscription_tier ?? 'free';
  const userTierLevel = SUB_ORDER[userSubTier] ?? 0;

  // Data
  const { data: productsData, isLoading } = useBrowseProducts({
    category: activeCategory !== 'all' ? activeCategory : undefined,
    tier: activeTier !== 'all' ? activeTier : undefined,
    search: debouncedSearch || undefined,
    limit: 100,
  });
  const { data: categoriesData } = useProductCategories();
  const { data: tiersData } = useProductTiers();

  const products = productsData?.items ?? [];
  const total = productsData?.total ?? 0;
  const categories = categoriesData ?? [];
  const tiers = tiersData?.tiers ?? [];

  // Count products per tier (from current filtered set or full catalog)
  const tierProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tiers) counts[t.slug] = 0;
    for (const p of products) {
      if (p.tier?.slug) counts[p.tier.slug] = (counts[p.tier.slug] ?? 0) + 1;
    }
    return counts;
  }, [products, tiers]);

  // Reset filters
  const hasFilters = activeCategory !== 'all' || activeTier !== 'all' || debouncedSearch !== '';
  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActiveCategory('all');
    setActiveTier('all');
  };

  // Handle tier card click (toggle)
  const handleTierClick = (slug: string) => {
    setActiveTier((prev) => (prev === slug ? 'all' : slug));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Product Catalog</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Browse {total || 'our'} products across {categories.length || 12} categories. See what you can sell with your brand.
          </p>
        </div>
        <Link to={ROUTES.WIZARD}>
          <Button rightIcon={<ArrowRight className="h-4 w-4" />}>
            Start Building
          </Button>
        </Link>
      </div>

      {/* Tier Overview Cards */}
      {tiers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((tier) => {
              const requiredLevel = SUB_ORDER[tier.min_subscription_tier] ?? 0;
              const isAccessible = userTierLevel >= requiredLevel;
              return (
                <TierOverviewCard
                  key={tier.id}
                  tier={tier}
                  productCount={tierProductCounts[tier.slug] ?? 0}
                  isAccessible={isAccessible}
                  isActive={activeTier === tier.slug}
                  onClick={() => handleTierClick(tier.slug)}
                />
              );
            })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-10 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setDebouncedSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            activeCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface-hover text-text-secondary hover:text-text',
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory((prev) => (prev === cat ? 'all' : cat))}
            className={cn(
              'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-hover text-text-secondary hover:text-text',
            )}
          >
            <span>{CATEGORY_EMOJI[cat] ?? ''}</span>
            {capitalize(cat.replace(/_/g, ' '))}
          </button>
        ))}
      </div>

      {/* Result count + clear filters */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Showing {products.length}{total > products.length ? ` of ${total}` : ''} products
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-lg bg-surface-hover" />
              <div className="mt-3 h-3 w-2/3 rounded bg-surface-hover" />
              <div className="mt-2 h-2.5 w-1/3 rounded bg-surface-hover" />
              <div className="mt-2 h-2.5 w-1/4 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && products.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover">
            <Package className="h-8 w-8 text-text-muted" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-text">No products found</h2>
          <p className="mt-1 text-sm text-text-muted">
            Try adjusting your search or filters.
          </p>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={resetFilters}
            >
              Reset Filters
            </Button>
          )}
        </motion.div>
      )}

      {/* Product grid */}
      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {products.map((product) => (
              <CatalogProductCard
                key={product.sku}
                product={product}
                onViewDetail={setSelectedProduct}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* CTA Banner */}
      {!isLoading && products.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-6 sm:p-8"
        >
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text">Ready to build your brand?</h3>
              <p className="mt-0.5 text-sm text-text-muted">
                Our AI will analyze your social presence and recommend the perfect products for your audience.
              </p>
            </div>
            <Link to={ROUTES.WIZARD}>
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Start the Wizard
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Detail Modal */}
      <CatalogDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </motion.div>
  );
}
