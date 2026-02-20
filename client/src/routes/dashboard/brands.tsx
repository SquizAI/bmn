import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Plus,
  Sparkles,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { useBrands, useDeleteBrand, type Brand } from '@/hooks/use-brands';
import { ROUTES } from '@/lib/constants';
import { cn, capitalize } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { useState } from 'react';

// ------ Status Badge ------

function StatusBadge({ status }: { status: Brand['status'] }) {
  const styles = {
    draft: 'bg-warning-bg text-warning',
    active: 'bg-success-bg text-success',
    archived: 'bg-surface-hover text-text-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Card variant="interactive" padding="none" className="overflow-hidden">
        {/* Thumbnail / Gradient placeholder */}
        <div className="relative h-36 w-full">
          {brand.thumbnailUrl ? (
            <img
              src={brand.thumbnailUrl}
              alt={brand.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <Sparkles className="h-10 w-10 text-primary/40" />
            </div>
          )}

          {/* Status badge */}
          <div className="absolute left-3 top-3">
            <StatusBadge status={brand.status} />
          </div>

          {/* Menu */}
          <div className="absolute right-2 top-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-text hover:bg-white"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-border bg-surface py-1 shadow-lg">
                    <Link
                      to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                    <Link
                      to={`${ROUTES.WIZARD}?brandId=${brand.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-4 w-4" />
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
            <h3 className="font-semibold text-text hover:text-primary transition-colors">
              {brand.name}
            </h3>
          </Link>
          <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
            <Clock className="h-3 w-3" />
            <span>Updated {updatedAt}</span>
          </div>
        </CardContent>
      </Card>
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
          <h1 className="text-2xl font-bold text-text">My Brands</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your AI-generated brands and assets.
          </p>
        </div>
        <Link to={ROUTES.WIZARD}>
          <Button leftIcon={<Plus className="h-4 w-4" />}>Create Brand</Button>
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse-soft">
              <CardContent>
                <div className="h-32 rounded-lg bg-surface-hover" />
                <div className="mt-4 h-4 w-2/3 rounded bg-surface-hover" />
                <div className="mt-2 h-3 w-1/2 rounded bg-surface-hover" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && brands.length === 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No brands yet</CardTitle>
            <CardDescription className="mt-2 max-w-md">
              Create your first AI-powered brand. Our wizard will guide you from social media
              analysis to a complete brand identity with logos, mockups, and revenue projections.
            </CardDescription>
            <Link to={ROUTES.WIZARD} className="mt-6">
              <Button size="lg" leftIcon={<Plus className="h-5 w-5" />}>
                Create Your First Brand
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Brand grid */}
      {!isLoading && brands.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  );
}
