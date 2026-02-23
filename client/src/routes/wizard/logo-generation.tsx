import { useNavigate } from 'react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, RefreshCw, Wand2, Image as ImageIcon,
  Loader2, Palette, Upload, X, Pin, Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { LogoStylePicker } from '@/components/logo-studio/LogoStylePicker';
import { VariationSelector } from '@/components/logo-studio/VariationSelector';
import { ColorPaletteEditor } from '@/components/logo-studio/ColorPaletteEditor';
import { RefinementInput } from '@/components/logo-studio/RefinementInput';
import { LogoCompare } from '@/components/logo-studio/LogoCompare';
import { LogoHistory } from '@/components/logo-studio/LogoHistory';
// Retained for potential error-state display in future iterations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GenerationProgress } from '@/components/generation-progress';
import { useWizardStore } from '@/stores/wizard-store';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import {
  useDispatchLogoGeneration,
  useRegenerateLogo,
  useSelectLogo,
  useUploadLogo,
} from '@/hooks/use-wizard-actions';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

// ------ Skeleton Loader ------

function LogoGallerySkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {/* Style indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Palette className="h-3.5 w-3.5" />
        <span>Generating logo variations...</span>
      </div>

      {/* Logo grid - matches ImageGallery 2-column layout */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.12 }}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-surface/80 shadow-sm"
          >
            {/* Shimmer */}
            <motion.div
              className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/6 to-transparent"
              animate={{ translateX: ['calc(-100%)', 'calc(100%)'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 0.5 }}
            />

            {/* Image placeholder */}
            <div
              className="aspect-square bg-border/15 animate-pulse flex items-center justify-center"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <ImageIcon className="h-10 w-10 text-text-muted/20" />
            </div>

            {/* Label bar */}
            <div className="p-3 flex items-center justify-between">
              <div
                className="h-4 w-16 rounded bg-border/25 animate-pulse"
                style={{ animationDelay: `${i * 0.15 + 0.1}s` }}
              />
              <div
                className="h-5 w-5 rounded-full bg-border/20 animate-pulse"
                style={{ animationDelay: `${i * 0.15 + 0.15}s` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ------ Logo Upload Drop Zone ------

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function LogoUploadZone({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const clearPreview = () => {
    setSelectedFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleConfirmUpload = () => {
    if (selectedFile) onUpload(selectedFile);
  };

  return (
    <div className="space-y-3">
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-8
            transition-colors text-center
            ${isDragging
              ? 'border-accent bg-accent/5'
              : 'border-border/60 hover:border-accent/50 hover:bg-surface-hover/50'}
          `}
        >
          <Upload className="mx-auto h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm font-medium text-text-secondary">
            Drop your logo here or click to browse
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PNG, JPG, SVG, or WebP (max 10 MB)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      ) : (
        <div className="relative rounded-xl border border-border/50 bg-surface/80 p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-border/30">
              <img
                src={preview}
                alt="Logo preview"
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {selectedFile?.name}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {selectedFile && (selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={clearPreview}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={handleConfirmUpload}
            loading={isUploading}
            leftIcon={<Upload className="h-3.5 w-3.5" />}
            className="mt-3 w-full"
          >
            Use This Logo
          </Button>
        </div>
      )}
    </div>
  );
}

// ------ Controls Panel ------

function ControlsPanel({
  logoStyle,
  onStyleChange,
  selectedVariations,
  onVariationsChange,
  colors,
  onColorsChange,
  disabled,
  defaultExpanded,
}: {
  logoStyle: string;
  onStyleChange: (style: string) => void;
  selectedVariations: string[];
  onVariationsChange: (v: string[]) => void;
  colors: string[];
  onColorsChange: (c: string[]) => void;
  disabled: boolean;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-border/50 bg-surface/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-text-secondary hover:text-text transition-colors"
      >
        <Settings2 className="h-4 w-4" />
        <span>Generation Settings</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-5 px-4 pb-4">
              <LogoStylePicker value={logoStyle} onChange={onStyleChange} disabled={disabled} />
              <VariationSelector selected={selectedVariations} onChange={onVariationsChange} disabled={disabled} />
              <ColorPaletteEditor colors={colors} onChange={onColorsChange} disabled={disabled} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------ Component ------

export default function LogoGenerationPage() {
  const navigate = useNavigate();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const logos = useWizardStore((s) => s.assets.logos);
  const selectedLogoId = useWizardStore((s) => s.assets.selectedLogoId);
  const logoStyle = useWizardStore((s) => s.design.logoStyle);
  const colorPalette = useWizardStore((s) => s.design.colorPalette);
  const selectedVariations = useWizardStore((s) => s.design.selectedVariations);
  const logoHistory = useWizardStore((s) => s.assets.logoHistory);
  const pinnedLogoIds = useWizardStore((s) => s.assets.pinnedLogoIds);
  const selectLogo = useWizardStore((s) => s.selectLogo);
  const setStep = useWizardStore((s) => s.setStep);
  const setAssets = useWizardStore((s) => s.setAssets);
  const setDesign = useWizardStore((s) => s.setDesign);
  const pinLogo = useWizardStore((s) => s.pinLogo);
  const unpinLogo = useWizardStore((s) => s.unpinLogo);
  const clearPins = useWizardStore((s) => s.clearPins);
  const setSelectedVariations = useWizardStore((s) => s.setSelectedVariations);
  const addToast = useUIStore((s) => s.addToast);

  const dispatchGeneration = useDispatchLogoGeneration();
  const regenerateLogo = useRegenerateLogo();
  const selectLogoMutation = useSelectLogo();
  const uploadLogo = useUploadLogo();
  const generation = useGenerationProgress(activeJobId);

  const [selectedId, setSelectedId] = useState<string | null>(selectedLogoId);

  // Local state for controls
  const [localStyle, setLocalStyle] = useState(logoStyle || 'modern');
  const [localVariations, setLocalVariations] = useState<string[]>(
    selectedVariations.length > 0 ? selectedVariations : ['combination', 'icon', 'wordmark'],
  );
  const [localColors, setLocalColors] = useState<string[]>(
    colorPalette.length > 0 ? colorPalette.map((c) => c.hex) : ['#6366F1', '#8B5CF6', '#EC4899'],
  );

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
      } else {
        addToast({ type: 'warning', title: 'No logos were generated. Try generating again.' });
      }
    }
  }, [generation.isComplete, generation.result, setAssets, addToast]);

  // Build gallery images with pin action overlay
  const galleryImages: GalleryImage[] = logos.map((logo, index) => ({
    id: logo.id,
    url: logo.url,
    thumbnailUrl: logo.thumbnailUrl,
    status: logo.id === selectedId ? 'selected' : 'none',
    label: `Logo ${index + 1}`,
  }));

  // Collect pinned logos for compare panel (from current + history)
  const allLogos = [
    ...logos,
    ...logoHistory.flat(),
  ];
  const pinnedLogos = pinnedLogoIds
    .map((id) => allLogos.find((l) => l.id === id))
    .filter(Boolean)
    .map((logo) => ({
      id: logo!.id,
      url: logo!.url,
      label: `Logo`,
    }));

  const handleGenerate = async () => {
    if (!brandId) return;

    // Sync local controls to store
    setDesign({ logoStyle: localStyle });
    setSelectedVariations(localVariations);

    await dispatchGeneration.mutateAsync({
      brandId,
      style: localStyle,
      variations: localVariations,
      colorPalette: localColors,
    });
  };

  const handleRefinement = async (notes: string) => {
    if (!brandId) return;

    await dispatchGeneration.mutateAsync({
      brandId,
      style: localStyle,
      variations: localVariations,
      colorPalette: localColors,
      refinementNotes: notes,
    });
  };

  const handleUpload = async (file: File) => {
    if (!brandId) return;
    try {
      const asset = await uploadLogo.mutateAsync({ brandId, file });
      setAssets({
        logos: [
          ...logos,
          {
            id: asset.id,
            url: asset.url,
            metadata: asset.metadata || {},
          },
        ],
      });
      setSelectedId(asset.id);
      addToast({ type: 'success', title: 'Logo uploaded successfully!' });
    } catch {
      addToast({ type: 'error', title: 'Failed to upload logo. Please try again.' });
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
  };

  const handlePinToggle = (logoId: string) => {
    if (pinnedLogoIds.includes(logoId)) {
      unpinLogo(logoId);
    } else {
      pinLogo(logoId);
    }
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
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
          <ImageIcon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text">Logo Studio</h2>
        <p className="mt-2 text-text-secondary">
          {hasLogos
            ? 'Select your favorite logo, pin to compare, or refine with instructions.'
            : 'Configure your style, then generate AI logos or upload your own.'}
        </p>
      </div>

      {/* Controls Panel -- always visible, collapsible after generation */}
      <ControlsPanel
        logoStyle={localStyle}
        onStyleChange={setLocalStyle}
        selectedVariations={localVariations}
        onVariationsChange={setLocalVariations}
        colors={localColors}
        onColorsChange={setLocalColors}
        disabled={isGenerating}
        defaultExpanded={!hasLogos}
      />

      {/* Generate / Upload options (show when no logos yet and not generating) */}
      {!hasLogos && !isGenerating && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* AI Generate card */}
          <Card variant="outlined" padding="lg" className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover">
              <Wand2 className="h-8 w-8 text-text-muted" />
            </div>
            <CardTitle className="text-base">Generate with AI</CardTitle>
            <CardDescription className="mt-1.5 text-sm">
              Create {localVariations.length} unique logo designs based on your brand identity.
            </CardDescription>
            <Button
              size="lg"
              onClick={handleGenerate}
              loading={dispatchGeneration.isPending}
              leftIcon={<Wand2 className="h-5 w-5" />}
              className="mt-5 w-full"
            >
              Generate Logos
            </Button>
          </Card>

          {/* Upload card */}
          <Card variant="outlined" padding="lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover text-center">
              <Upload className="h-8 w-8 text-text-muted" />
            </div>
            <CardTitle className="text-base text-center">Upload Your Logo</CardTitle>
            <CardDescription className="mt-1.5 text-sm text-center">
              Already have a logo? Upload it to use with your branded products.
            </CardDescription>
            <div className="mt-4">
              <LogoUploadZone onUpload={handleUpload} isUploading={uploadLogo.isPending} />
            </div>
          </Card>
        </div>
      )}

      {/* Progress + Skeleton */}
      {isGenerating && (
        <div className="space-y-5" role="status" aria-busy="true" aria-live="polite">
          {/* Compact progress header */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>{generation.message || 'Starting logo generation...'}</span>
            </div>
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-border/40">
              {generation.progress > 0 ? (
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-accent to-primary"
                  animate={{ width: `${generation.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              ) : (
                <motion.div
                  className="h-full w-1/4 rounded-full bg-accent/50"
                  animate={{ x: ['0%', '300%', '0%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          </div>

          {/* Logo skeleton grid */}
          <LogoGallerySkeleton count={localVariations.length || 4} />
        </div>
      )}

      {/* Logo Compare Panel */}
      {hasLogos && !isGenerating && pinnedLogos.length > 0 && (
        <LogoCompare
          pinnedLogos={pinnedLogos}
          onUnpin={unpinLogo}
          onClearAll={clearPins}
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
            aria-label="Generated logo options"
          />

          {/* Per-logo action buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            {logos.map((logo, index) => (
              <div key={logo.id} className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePinToggle(logo.id)}
                  className={cn(
                    pinnedLogoIds.includes(logo.id) && 'border-accent text-accent',
                  )}
                >
                  <Pin className={cn('h-3 w-3 mr-1', pinnedLogoIds.includes(logo.id) && 'fill-current')} />
                  {pinnedLogoIds.includes(logo.id) ? 'Pinned' : 'Pin'} #{index + 1}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerate(logo.id)}
                  loading={regenerateLogo.isPending}
                  leftIcon={<RefreshCw className="h-3 w-3" />}
                >
                  Regen #{index + 1}
                </Button>
              </div>
            ))}
          </div>

          {/* Regenerate All */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              loading={dispatchGeneration.isPending}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Generate All New
            </Button>
          </div>

          {/* Refinement Input */}
          <RefinementInput
            onSubmit={handleRefinement}
            isGenerating={isGenerating}
          />

          {/* Logo History */}
          <LogoHistory
            batches={logoHistory}
            onSelect={handleSelect}
            onPin={handlePinToggle}
            pinnedIds={pinnedLogoIds}
          />

          {/* Upload additional logo option */}
          <div className="border-t border-border/40 pt-4">
            <p className="text-xs text-text-muted text-center mb-3">
              Or upload your own logo to add it to the options
            </p>
            <LogoUploadZone onUpload={handleUpload} isUploading={uploadLogo.isPending} />
          </div>
        </>
      )}

      {/* Navigation Actions */}
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
