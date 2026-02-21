import { useNavigate } from 'react-router';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  CheckCheck,
  SlidersHorizontal,
  ArrowLeftRight,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { GenerationProgress } from '@/components/generation-progress';
import { MockupEditor } from '@/components/products/MockupEditor';
import { MockupComparison } from '@/components/products/MockupComparison';
import PrintExportDialog from '@/components/products/PrintExportDialog';
import { useWizardStore } from '@/stores/wizard-store';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import {
  useDispatchMockupGeneration,
  useSaveMockupApprovals,
} from '@/hooks/use-wizard-actions';
import {
  useMockupDetails,
  useSaveMockupPosition,
  useRegenerateMockup,
} from '@/hooks/use-mockup-generation';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

// ------ Types ------

type ViewMode = 'gallery' | 'editor' | 'comparison';

// ------ Component ------

export default function MockupReviewPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const mockups = useWizardStore((s) => s.assets.mockups);
  const selectedLogoId = useWizardStore((s) => s.assets.selectedLogoId);
  const logos = useWizardStore((s) => s.assets.logos);
  const setMockupStatus = useWizardStore((s) => s.setMockupStatus);
  const setAssets = useWizardStore((s) => s.setAssets);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const dispatchMockups = useDispatchMockupGeneration();
  const saveMockupApprovals = useSaveMockupApprovals();
  const saveMockupPosition = useSaveMockupPosition();
  const regenerateMockup = useRegenerateMockup();
  const generation = useGenerationProgress(activeJobId);
  const { data: mockupDetails } = useMockupDetails(brandId);

  const [hasStartedGeneration, setHasStartedGeneration] = useState(mockups.length > 0);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [editingMockupId, setEditingMockupId] = useState<string | null>(null);
  const [comparingMockupId, setComparingMockupId] = useState<string | null>(null);
  const [printExportMockupId, setPrintExportMockupId] = useState<string | null>(null);

  // Get the selected logo URL for the editor
  const selectedLogo = logos.find((l) => l.id === selectedLogoId);
  const logoUrl = selectedLogo?.url || '';

  // Auto-start generation if no mockups exist
  useEffect(() => {
    if (mockups.length === 0 && !hasStartedGeneration && brandId) {
      setHasStartedGeneration(true);
      dispatchMockups.mutate({ brandId });
    }
  }, [mockups.length, hasStartedGeneration, brandId, dispatchMockups]);

  // When generation completes, parse results
  useEffect(() => {
    if (generation.isComplete && generation.result) {
      const result = generation.result as Record<string, unknown>;
      const newMockups = (result.mockups || []) as Array<{
        id: string;
        url: string;
        productSku: string;
        productName?: string;
      }>;

      if (newMockups.length > 0) {
        setAssets({
          mockups: newMockups.map((m) => ({
            id: m.id,
            url: m.url,
            productSku: m.productSku,
            // Preserve existing approval status if mockup was already reviewed
            status: mockups.find((old) => old.id === m.id)?.status || ('pending' as const),
          })),
        });
      }
    }
  }, [generation.isComplete, generation.result, setAssets, mockups]);

  const handleApprove = useCallback(
    (id: string) => {
      const mockup = mockups.find((m) => m.id === id);
      if (!mockup) return;
      const newStatus = mockup.status === 'approved' ? 'pending' : 'approved';
      setMockupStatus(id, newStatus);
    },
    [mockups, setMockupStatus],
  );

  const handleReject = useCallback(
    (id: string) => {
      const mockup = mockups.find((m) => m.id === id);
      if (!mockup) return;
      const newStatus = mockup.status === 'rejected' ? 'pending' : 'rejected';
      setMockupStatus(id, newStatus);
    },
    [mockups, setMockupStatus],
  );

  const handleBulkApprove = () => {
    mockups.forEach((m) => {
      if (m.status !== 'approved') {
        setMockupStatus(m.id, 'approved');
      }
    });
  };

  const handleOpenEditor = (mockupId: string) => {
    setEditingMockupId(mockupId);
    setViewMode('editor');
  };

  const handleOpenComparison = (mockupId: string) => {
    setComparingMockupId(mockupId);
    setViewMode('comparison');
  };

  const handleSavePosition = async (position: { x: number; y: number; scale: number; opacity: number }) => {
    if (!brandId || !editingMockupId) return;
    try {
      await saveMockupPosition.mutateAsync({
        brandId,
        mockupId: editingMockupId,
        position,
      });
      addToast({ type: 'success', title: 'Mockup position saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save position' });
    }
  };

  const handleRegenerateMockup = async (mockupId: string) => {
    if (!brandId) return;
    try {
      await regenerateMockup.mutateAsync({ brandId, mockupId });
      addToast({ type: 'info', title: 'Regenerating mockup...' });
    } catch {
      addToast({ type: 'error', title: 'Failed to regenerate mockup' });
    }
  };

  const galleryImages: GalleryImage[] = mockups.map((m) => ({
    id: m.id,
    url: m.url,
    status: m.status,
    label: m.productSku,
  }));

  const approvedCount = mockups.filter((m) => m.status === 'approved').length;
  const allReviewed = mockups.every((m) => m.status !== 'pending');

  const editingMockup = mockups.find((m) => m.id === editingMockupId);
  const comparingMockup = mockups.find((m) => m.id === comparingMockupId);
  const comparingDetail = mockupDetails?.find((d) => d.id === comparingMockupId);

  const handleContinue = async () => {
    if (!brandId) return;

    const approvals: Record<string, 'approved' | 'rejected'> = {};
    mockups.forEach((m) => {
      if (m.status === 'approved' || m.status === 'rejected') {
        approvals[m.id] = m.status;
      }
    });

    try {
      await saveMockupApprovals.mutateAsync({ brandId, approvals });
    } catch {
      addToast({ type: 'error', title: 'Failed to save mockup approvals' });
      return;
    }

    setStep('bundle-builder');
    navigate(ROUTES.WIZARD_BUNDLE_BUILDER);
  };

  const handleBack = () => {
    setStep('product-selection');
    navigate(ROUTES.WIZARD_PRODUCT_SELECTION);
  };

  const isGenerating =
    generation.status === 'pending' || generation.status === 'processing';
  const hasMockups = mockups.length > 0;

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
          <ImageIcon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Mockup Review</h2>
        <p className="mt-2 text-text-secondary">
          Review your product mockups. Edit logo placement, compare before/after, and approve your favorites.
        </p>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div role="status" aria-busy="true" aria-live="polite">
          <GenerationProgress
            progress={generation.progress}
            status={generation.status}
            message={generation.message}
            error={generation.error}
          />
        </div>
      )}

      {/* View mode tabs */}
      {hasMockups && !isGenerating && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-surface-hover p-1" role="tablist" aria-label="Mockup view modes">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'gallery'}
              onClick={() => setViewMode('gallery')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'gallery'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text',
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Gallery
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'editor'}
              onClick={() => {
                if (mockups.length > 0) handleOpenEditor(mockups[0].id);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'editor'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'comparison'}
              onClick={() => {
                if (mockups.length > 0) handleOpenComparison(mockups[0].id);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'comparison'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text',
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Before/After
            </button>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-sm text-text-secondary" aria-live="polite">
              {approvedCount} of {mockups.length} approved
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              Approve All
            </Button>
          </div>
        </div>
      )}

      {/* Gallery View */}
      {hasMockups && !isGenerating && viewMode === 'gallery' && (
        <>
          <ImageGallery
            images={galleryImages}
            onApprove={handleApprove}
            onReject={handleReject}
            columns={3}
          />

          {/* Quick actions per mockup */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mockups.map((mockup) => (
              <div
                key={mockup.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
              >
                <span className="text-xs font-medium text-text truncate">
                  {mockup.productSku}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEditor(mockup.id)}
                    className="text-xs"
                  >
                    <SlidersHorizontal className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenComparison(mockup.id)}
                    className="text-xs"
                  >
                    <ArrowLeftRight className="mr-1 h-3 w-3" />
                    Compare
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateMockup(mockup.id)}
                    loading={regenerateMockup.isPending}
                    className="text-xs"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Redo
                  </Button>
                  {mockup.status === 'approved' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrintExportMockupId(mockup.id)}
                      className="text-xs"
                    >
                      <Printer className="mr-1 h-3 w-3" />
                      Print
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Editor View */}
      {hasMockups && !isGenerating && viewMode === 'editor' && editingMockup && (
        <div className="space-y-4" role="tabpanel" aria-label="Mockup editor">
          {/* Mockup selector tabs */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select mockup to edit">
            {mockups.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={m.id === editingMockupId}
                onClick={() => setEditingMockupId(m.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  m.id === editingMockupId
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text',
                )}
              >
                {m.productSku}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-lg">
            <MockupEditor
              mockupUrl={editingMockup.url}
              logoUrl={logoUrl}
              productName={editingMockup.productSku}
              onSave={handleSavePosition}
            />
          </div>
        </div>
      )}

      {/* Comparison View */}
      {hasMockups && !isGenerating && viewMode === 'comparison' && comparingMockup && (
        <div className="space-y-4" role="tabpanel" aria-label="Mockup comparison">
          {/* Mockup selector tabs */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select mockup to compare">
            {mockups.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={m.id === comparingMockupId}
                onClick={() => setComparingMockupId(m.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  m.id === comparingMockupId
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text',
                )}
              >
                {m.productSku}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-lg">
            <MockupComparison
              beforeUrl={comparingDetail?.beforeUrl || comparingMockup.url}
              afterUrl={comparingMockup.url}
              beforeLabel="Raw Product"
              afterLabel="Your Brand"
            />
            <p className="mt-4 text-center text-sm font-medium text-text">
              This is what YOUR brand did to this product
            </p>
          </div>
        </div>
      )}

      {/* Empty state during initial loading */}
      {!hasMockups && !isGenerating && (
        <Card variant="outlined" padding="lg" className="text-center">
          <CardTitle>Generating Mockups</CardTitle>
          <CardDescription className="mt-2">
            Your product mockups are being generated. This may take a moment.
          </CardDescription>
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
          size="lg"
          onClick={handleContinue}
          disabled={approvedCount === 0}
          loading={saveMockupApprovals.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          {allReviewed
            ? `Continue with ${approvedCount} Mockup${approvedCount !== 1 ? 's' : ''}`
            : 'Review All Mockups to Continue'}
        </Button>
      </div>

      {/* Print Export Dialog */}
      {brandId && printExportMockupId && (
        <PrintExportDialog
          isOpen={!!printExportMockupId}
          onClose={() => setPrintExportMockupId(null)}
          brandId={brandId}
          productId={printExportMockupId}
          productName={
            mockups.find((m) => m.id === printExportMockupId)?.productSku || 'Product'
          }
        />
      )}
    </motion.div>
  );
}
