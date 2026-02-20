import { useNavigate } from 'react-router';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, Image as ImageIcon, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { GenerationProgress } from '@/components/generation-progress';
import { useWizardStore } from '@/stores/wizard-store';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import {
  useDispatchMockupGeneration,
  useSaveMockupApprovals,
} from '@/hooks/use-wizard-actions';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';

// ------ Component ------

export default function MockupReviewPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const mockups = useWizardStore((s) => s.assets.mockups);
  const setMockupStatus = useWizardStore((s) => s.setMockupStatus);
  const setAssets = useWizardStore((s) => s.setAssets);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const dispatchMockups = useDispatchMockupGeneration();
  const saveMockupApprovals = useSaveMockupApprovals();
  const generation = useGenerationProgress(activeJobId);

  const [hasStartedGeneration, setHasStartedGeneration] = useState(mockups.length > 0);

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
            status: 'pending' as const,
          })),
        });
      }
    }
  }, [generation.isComplete, generation.result, setAssets]);

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

  const galleryImages: GalleryImage[] = mockups.map((m) => ({
    id: m.id,
    url: m.url,
    status: m.status,
    label: m.productSku,
  }));

  const approvedCount = mockups.filter((m) => m.status === 'approved').length;
  const allReviewed = mockups.every((m) => m.status !== 'pending');

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

    setStep('profit-calculator');
    navigate(ROUTES.WIZARD_PROFIT_CALCULATOR);
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
          Review your product mockups. Approve the ones you love, reject any that need changes.
        </p>
      </div>

      {/* Progress */}
      {isGenerating && (
        <GenerationProgress
          progress={generation.progress}
          status={generation.status}
          message={generation.message}
          error={generation.error}
        />
      )}

      {/* Mockup Gallery */}
      {hasMockups && !isGenerating && (
        <>
          {/* Stats + Bulk approve */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
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

          <ImageGallery
            images={galleryImages}
            onApprove={handleApprove}
            onReject={handleReject}
            columns={3}
          />
        </>
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
    </motion.div>
  );
}
