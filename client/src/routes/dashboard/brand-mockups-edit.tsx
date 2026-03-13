import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  Sparkles,
  Check,
  X,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { useBrandDetail } from '@/hooks/use-brand-detail';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { ROUTES, QUERY_KEYS } from '@/lib/constants';

// ------ Progress Bar ------

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg bg-surface-hover p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text">{message || 'Generating mockups...'}</p>
        <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
}

// ------ Summary Bar ------

function MockupSummary({ mockups }: { mockups: GalleryImage[] }) {
  const approved = mockups.filter((m) => m.status === 'approved').length;
  const rejected = mockups.filter((m) => m.status === 'rejected').length;
  const pending = mockups.filter((m) => m.status === 'pending' || m.status === 'none').length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex items-center gap-3 rounded-lg bg-surface-hover p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
          <Check className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-xs text-text-muted">Approved</p>
          <p className="text-lg font-bold text-success">{approved}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-surface-hover p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error/10">
          <X className="h-4 w-4 text-error" />
        </div>
        <div>
          <p className="text-xs text-text-muted">Rejected</p>
          <p className="text-lg font-bold text-error">{rejected}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-surface-hover p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
          <Package className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-xs text-text-muted">Pending</p>
          <p className="text-lg font-bold text-warning">{pending}</p>
        </div>
      </div>
    </div>
  );
}

// ------ Main Component ------

export default function BrandMockupsEditPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { data: brand, isLoading, error } = useBrandDetail(brandId);

  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const genProgress = useGenerationProgress(jobId);

  // Reset generation state when complete
  if (brandId && genProgress.isComplete && jobId) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
  }

  if (brandId && genProgress.isError && jobId) {
    addToast({ type: 'error', title: genProgress.error || 'Mockup generation failed' });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
  }

  const mockups = brand?.mockups ?? [];
  const products = brand?.products ?? [];

  const mockupImages: GalleryImage[] = mockups.map((mockup) => ({
    id: mockup.id,
    url: mockup.url,
    status: mockup.status,
    label: mockup.productName,
  }));

  const handleGenerateMore = useCallback(async () => {
    if (!brandId || generating) return;
    setGenerating(true);
    try {
      const result = await apiClient.post<{ jobId: string }>(
        `/api/v1/brands/${brandId}/generate/mockups`,
      );
      if (result?.jobId) {
        setJobId(result.jobId);
      } else {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        setGenerating(false);
        addToast({ type: 'success', title: 'Mockups generated' });
      }
    } catch (err) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : 'Failed to start mockup generation';
      addToast({ type: 'error', title: msg });
    }
  }, [brandId, generating, queryClient, addToast]);

  const handleApprove = useCallback(
    async (mockupId: string) => {
      if (!brandId) return;
      try {
        await apiClient.patch(`/api/v1/brands/${brandId}/mockups/${mockupId}`, {
          status: 'approved',
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        addToast({ type: 'success', title: 'Mockup approved' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to approve mockup';
        addToast({ type: 'error', title: msg });
      }
    },
    [brandId, queryClient, addToast],
  );

  const handleReject = useCallback(
    async (mockupId: string) => {
      if (!brandId) return;
      try {
        await apiClient.patch(`/api/v1/brands/${brandId}/mockups/${mockupId}`, {
          status: 'rejected',
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        addToast({ type: 'info', title: 'Mockup rejected' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reject mockup';
        addToast({ type: 'error', title: msg });
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
                Product Mockups ({mockupImages.length} mockups)
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGenerateMore}
          loading={generating}
          leftIcon={<Sparkles className="h-4 w-4" />}
        >
          Generate New Mockups
        </Button>
      </div>

      {/* Generation Progress */}
      {generating && jobId && (
        <ProgressBar progress={genProgress.progress} message={genProgress.message} />
      )}

      {/* Products that will be mocked up */}
      {products.length > 0 && mockupImages.length === 0 && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Products to Mock Up ({products.length})</CardTitle>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <div key={p.productSku} className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-hover/50 p-2.5">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.productName} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{p.productName}</p>
                  <p className="text-xs text-text-muted">{p.category}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No products linked — point to catalog */}
      {products.length === 0 && mockupImages.length === 0 && !generating && (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
              <ShoppingBag className="h-7 w-7 text-warning" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-text">No products selected</p>
              <p className="text-sm text-text-secondary mt-1">
                Add products to this brand before generating mockups
              </p>
            </div>
            <Link to={ROUTES.DASHBOARD_PRODUCTS}>
              <Button variant="outline" leftIcon={<ShoppingBag className="h-4 w-4" />}>
                Browse Product Catalog
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Summary */}
      {mockupImages.length > 0 && <MockupSummary mockups={mockupImages} />}

      {/* Mockup Gallery */}
      {mockupImages.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <CardTitle>Mockup Gallery</CardTitle>
            <span className="text-xs text-text-muted">
              Hover to approve or reject
            </span>
          </div>

          <ImageGallery
            images={mockupImages}
            columns={3}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </Card>
      ) : products.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
              <Package className="h-8 w-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-text">No mockups yet</p>
              <p className="text-sm text-text-secondary mt-1">
                Generate mockups for your {products.length} selected product{products.length !== 1 ? 's' : ''} with your brand logos applied
              </p>
            </div>
            <Button
              onClick={handleGenerateMore}
              loading={generating}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Generate Mockups
            </Button>
          </div>
        </Card>
      ) : null}
    </motion.div>
  );
}
