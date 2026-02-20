import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, RefreshCw, Wand2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { GenerationProgress } from '@/components/generation-progress';
import { useWizardStore } from '@/stores/wizard-store';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import {
  useDispatchLogoGeneration,
  useRegenerateLogo,
  useSelectLogo,
} from '@/hooks/use-wizard-actions';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';

// ------ Component ------

export default function LogoGenerationPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const logos = useWizardStore((s) => s.assets.logos);
  const selectedLogoId = useWizardStore((s) => s.assets.selectedLogoId);
  const logoStyle = useWizardStore((s) => s.design.logoStyle);
  const selectLogo = useWizardStore((s) => s.selectLogo);
  const setStep = useWizardStore((s) => s.setStep);
  const setAssets = useWizardStore((s) => s.setAssets);
  const addToast = useUIStore((s) => s.addToast);

  const dispatchGeneration = useDispatchLogoGeneration();
  const regenerateLogo = useRegenerateLogo();
  const selectLogoMutation = useSelectLogo();
  const generation = useGenerationProgress(activeJobId);

  const [selectedId, setSelectedId] = useState<string | null>(selectedLogoId);

  // When generation completes, parse results into logo assets
  useEffect(() => {
    if (generation.isComplete && generation.result) {
      const result = generation.result as Record<string, unknown>;
      const newLogos = (result.logos || []) as Array<{
        id: string;
        url: string;
        thumbnailUrl?: string;
        metadata?: Record<string, unknown>;
      }>;

      if (newLogos.length > 0) {
        setAssets({
          logos: newLogos.map((logo) => ({
            id: logo.id,
            url: logo.url,
            thumbnailUrl: logo.thumbnailUrl,
            metadata: logo.metadata || {},
          })),
        });
      }
    }
  }, [generation.isComplete, generation.result, setAssets]);

  const galleryImages: GalleryImage[] = logos.map((logo) => ({
    id: logo.id,
    url: logo.url,
    thumbnailUrl: logo.thumbnailUrl,
    status: logo.id === selectedId ? 'selected' : 'none',
    label: `Logo ${logos.indexOf(logo) + 1}`,
  }));

  const handleGenerate = async () => {
    if (!brandId) return;
    await dispatchGeneration.mutateAsync({
      brandId,
      style: logoStyle || 'modern',
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
  };

  const handleRegenerate = async (logoId: string) => {
    if (!brandId) return;
    await regenerateLogo.mutateAsync({ brandId, logoId });
  };

  const handleContinue = async () => {
    if (!selectedId || !brandId) return;

    selectLogo(selectedId);
    try {
      await selectLogoMutation.mutateAsync({ brandId, logoId: selectedId });
    } catch {
      addToast({ type: 'error', title: 'Failed to save logo selection' });
      return;
    }

    setStep('product-selection');
    navigate(ROUTES.WIZARD_PRODUCT_SELECTION);
  };

  const handleBack = () => {
    setStep('brand-identity');
    navigate(ROUTES.WIZARD_BRAND_IDENTITY);
  };

  const isGenerating =
    generation.status === 'pending' || generation.status === 'processing';
  const hasLogos = logos.length > 0;

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
        <h2 className="text-2xl font-bold text-text">Logo Generation</h2>
        <p className="mt-2 text-text-secondary">
          {hasLogos
            ? 'Select your favorite logo. You can regenerate individual logos or generate a new set.'
            : 'Generate 4 unique logo concepts based on your brand identity.'}
        </p>
      </div>

      {/* Generate button (show when no logos yet) */}
      {!hasLogos && !isGenerating && (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-hover">
            <Wand2 className="h-10 w-10 text-text-muted" />
          </div>
          <CardTitle>Ready to Generate</CardTitle>
          <CardDescription className="mt-2">
            Our AI will create 4 unique logo designs based on your brand identity, colors, and
            style preferences.
          </CardDescription>
          <Button
            size="lg"
            onClick={handleGenerate}
            loading={dispatchGeneration.isPending}
            leftIcon={<Wand2 className="h-5 w-5" />}
            className="mt-6"
          >
            Generate Logos
          </Button>
        </Card>
      )}

      {/* Progress */}
      {isGenerating && (
        <GenerationProgress
          progress={generation.progress}
          status={generation.status}
          message={generation.message}
          error={generation.error}
        />
      )}

      {/* Logo Gallery */}
      {hasLogos && !isGenerating && (
        <>
          <ImageGallery
            images={galleryImages}
            selectedIds={new Set(selectedId ? [selectedId] : [])}
            selectable
            onSelect={handleSelect}
            columns={2}
          />

          {/* Regenerate individual logos */}
          <div className="flex flex-wrap justify-center gap-2">
            {logos.map((logo, index) => (
              <Button
                key={logo.id}
                variant="outline"
                size="sm"
                onClick={() => handleRegenerate(logo.id)}
                loading={regenerateLogo.isPending}
                leftIcon={<RefreshCw className="h-3 w-3" />}
              >
                Regenerate #{index + 1}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              loading={dispatchGeneration.isPending}
              leftIcon={<RefreshCw className="h-3 w-3" />}
            >
              Generate All New
            </Button>
          </div>
        </>
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
          disabled={!selectedId}
          loading={selectLogoMutation.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          {selectedId ? 'Continue with Selected Logo' : 'Select a Logo to Continue'}
        </Button>
      </div>
    </motion.div>
  );
}
