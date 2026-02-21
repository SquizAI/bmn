import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Plus,
  ArrowRight,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBrands, useDeleteBrand, type Brand } from '@/hooks/use-brands';
import { ROUTES } from '@/lib/constants';
import { cn, capitalize } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { useState } from 'react';

// ------ Status Badge ------

function StatusBadge({ status }: { status: Brand['status'] }) {
  const styles = {
    draft: 'bg-[#FEF3C7] text-[#92400E]',
    active: 'bg-[#D1FAE5] text-[#065F46]',
    archived: 'bg-surface-hover text-text-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status],
      )}
    >
      {capitalize(status)}
    </span>
  );
}

// ------ Brand Card ------

function BrandCard({ brand }: { brand: Brand }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const deleteBrand = useDeleteBrand();
  const addToast = useUIStore((s) => s.addToast);

  const handleDelete = async () => {
    if (!confirm(`Delete "${brand.name}"? This cannot be undone.`)) return;
    try {
      await deleteBrand.mutateAsync(brand.id);
      addToast({ type: 'success', title: `"${brand.name}" deleted` });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete brand' });
    }
    setMenuOpen(false);
  };

  const updatedAt = new Date(brand.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card variant="interactive" padding="none" className="group overflow-hidden">
        {/* Thumbnail / Gradient placeholder */}
        <div className="relative aspect-16/10 w-full overflow-hidden">
          {brand.thumbnailUrl ? (
            <img
              src={brand.thumbnailUrl}
              alt={brand.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#111] to-[#333]">
              <span className="text-2xl font-bold tracking-tight text-white/20">
                {brand.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute left-3 top-3">
            <StatusBadge status={brand.status} />
          </div>

          {/* Menu */}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-9 z-20 w-36 rounded-md border border-border bg-surface py-1 shadow-lg">
                    <Link
                      to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-text hover:bg-surface-hover"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Link>
                    <Link
                      to={`${ROUTES.WIZARD}?brandId=${brand.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-text hover:bg-surface-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}>
            <h3 className="text-[13px] font-semibold text-text transition-colors group-hover:text-text-secondary">
              {brand.name}
            </h3>
          </Link>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-text-muted">
            <Clock className="h-3 w-3" />
            <span>{updatedAt}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ------ Empty State ------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24"
    >
      {/* Abstract decorative element */}
      <div className="relative mb-10">
        <div className="h-px w-48 bg-linear-to-r from-transparent via-border to-transparent" />
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
            <Plus className="h-3.5 w-3.5 text-text-muted" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-text">
        Start building your brand
      </h2>
      <p className="mt-3 max-w-md text-center text-[13px] leading-relaxed text-text-muted">
        Our AI analyzes your social presence and generates a complete brand identity —
        from visual design to product mockups — in minutes.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Link to={ROUTES.WIZARD}>
          <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Create Your First Brand
          </Button>
        </Link>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8 text-center">
          {[
            { value: '2min', label: 'Avg. creation time' },
            { value: '7', label: 'AI-powered steps' },
            { value: '100%', label: 'Customizable' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-lg font-bold tracking-tight text-text">{stat.value}</p>
              <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ------ Main Page ------

export default function BrandsPage() {
  const { data, isLoading } = useBrands();
  const brands = data?.items || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">My Brands</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Manage your AI-generated brands and assets.
          </p>
        </div>
        {brands.length > 0 && (
          <Link to={ROUTES.WIZARD}>
            <Button leftIcon={<Plus className="h-4 w-4" />}>New Brand</Button>
          </Link>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-16/10 rounded-lg bg-surface-hover" />
              <div className="mt-3 h-3 w-2/3 rounded bg-surface-hover" />
              <div className="mt-2 h-2.5 w-1/3 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && brands.length === 0 && <EmptyState />}

      {/* Brand grid */}
      {!isLoading && brands.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  );
}
