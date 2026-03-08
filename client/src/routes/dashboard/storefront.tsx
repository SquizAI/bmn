import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Globe,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Store,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  useStorefronts,
  useStorefront,
  useStorefrontThemes,
  useGenerateStorefront,
  usePublishStorefront,
  useUnpublishStorefront,
  useUpdateStorefront,
} from '@/hooks/use-storefront';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import { useActiveBrand } from '@/hooks/use-active-brand';
import { useUIStore } from '@/stores/ui-store';
import { useStorefrontStore, type PreviewDevice } from '@/stores/storefront-store';
import { cn } from '@/lib/utils';

// ── Theme vibe descriptors ──────────────────────────────────────────────────

const VIBE_MAP: Record<string, string> = {
  'clean-wellness': 'Soft & Natural',
  'bold-performance': 'Dark & Powerful',
  'minimal-nature': 'Clean & Minimal',
  'premium-gold': 'Luxe & Elegant',
  'sport-energy': 'Vibrant & Athletic',
};

// ── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg bg-surface-hover p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text">{message || 'Building your storefront...'}</p>
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

// ── Theme Picker Card ────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: {
    id: string;
    name: string;
    slug: string;
    baseStyles: Record<string, unknown>;
  };
  selected: boolean;
  onSelect: () => void;
}

function ThemeCard({ theme, selected, onSelect }: ThemeCardProps) {
  const styles = theme.baseStyles as {
    colors?: { primary?: string; accent?: string; background?: string; text?: string };
  };
  const colors = styles?.colors ?? {};

  const swatches = [
    { color: colors.primary ?? '#6366f1', label: 'Primary' },
    { color: colors.accent ?? '#8b5cf6', label: 'Accent' },
    { color: colors.background ?? '#0f0f0f', label: 'Background' },
    { color: colors.text ?? '#ffffff', label: 'Text' },
  ];

  const vibe = VIBE_MAP[theme.slug] ?? 'Custom Theme';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border-2 p-5 transition-all duration-200',
        'hover:shadow-lg hover:border-primary/40',
        selected
          ? 'border-primary bg-primary/5 shadow-lg ring-1 ring-primary/20'
          : 'border-border/40 bg-surface/50',
      )}
    >
      {/* Theme name + vibe */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text">{theme.name}</h3>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </motion.div>
        )}
      </div>

      <p className="text-sm text-text-secondary mb-4">{vibe}</p>

      {/* Color swatches */}
      <div className="flex items-center gap-2">
        {swatches.map((swatch) => (
          <div
            key={swatch.label}
            className="h-8 w-8 rounded-lg border border-border/30 shadow-sm"
            style={{ backgroundColor: swatch.color }}
            title={`${swatch.label}: ${swatch.color}`}
          />
        ))}
      </div>
    </button>
  );
}

// ── Device Preview Toggle ────────────────────────────────────────────────────

const DEVICE_CONFIG: Record<PreviewDevice, { icon: typeof Monitor; width: string; label: string }> = {
  desktop: { icon: Monitor, width: '100%', label: 'Desktop' },
  tablet: { icon: Tablet, width: '768px', label: 'Tablet' },
  mobile: { icon: Smartphone, width: '375px', label: 'Mobile' },
};

function DeviceToggle({
  device,
  onChange,
}: {
  device: PreviewDevice;
  onChange: (d: PreviewDevice) => void;
}) {
  return (
    <div className="flex items-center rounded-lg bg-surface-elevated p-1 gap-0.5">
      {(Object.keys(DEVICE_CONFIG) as PreviewDevice[]).map((d) => {
        const { icon: Icon, label } = DEVICE_CONFIG[d];
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            title={label}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
              d === device
                ? 'bg-primary text-primary-foreground'
                : 'text-text-muted hover:text-text hover:bg-surface-hover',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function StorefrontPage() {
  const activeBrand = useActiveBrand();
  const brandId = activeBrand?.id;

  const { data: storefronts, isLoading } = useStorefronts();
  const [activeStorefrontId, setActiveStorefrontId] = useState<string | null>(null);
  const { data: storefrontDetail } = useStorefront(activeStorefrontId);
  const { data: themes, isLoading: themesLoading } = useStorefrontThemes();

  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const previewDevice = useStorefrontStore((s) => s.previewDevice);
  const setPreviewDevice = useStorefrontStore((s) => s.setPreviewDevice);
  const setStorefront = useStorefrontStore((s) => s.setStorefront);
  const reset = useStorefrontStore((s) => s.reset);

  const generateMutation = useGenerateStorefront();
  const publishMutation = usePublishStorefront();
  const unpublishMutation = useUnpublishStorefront();
  const updateMutation = useUpdateStorefront();

  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showRegenWarning, setShowRegenWarning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slugEdit, setSlugEdit] = useState('');

  const genProgress = useGenerationProgress(jobId);

  // Auto-select first storefront
  useEffect(() => {
    if (storefronts?.length && !activeStorefrontId) {
      setActiveStorefrontId(storefronts[0].id);
    }
  }, [storefronts, activeStorefrontId]);

  // Sync storefront detail into Zustand store
  useEffect(() => {
    if (storefrontDetail) {
      setStorefront({
        id: storefrontDetail.id,
        brandId: storefrontDetail.brandId,
        slug: storefrontDetail.slug,
        customDomain: storefrontDetail.customDomain,
        themeId: storefrontDetail.themeId,
        status: storefrontDetail.status,
        settings: storefrontDetail.settings,
        publishedAt: storefrontDetail.publishedAt,
        createdAt: storefrontDetail.createdAt,
        updatedAt: storefrontDetail.updatedAt,
      });
      setSlugEdit(storefrontDetail.slug);
    }
    return () => reset();
  }, [storefrontDetail, setStorefront, reset]);

  // Handle generation complete
  if (genProgress.isComplete && jobId) {
    queryClient.invalidateQueries({ queryKey: ['storefronts'] });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
    addToast({ type: 'success', title: 'Storefront generated successfully!' });
  }

  if (genProgress.isError && jobId) {
    addToast({ type: 'error', title: genProgress.error || 'Storefront generation failed' });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
  }

  const handleBuildStore = useCallback(async () => {
    if (!brandId || !selectedThemeId || generating) return;
    setGenerating(true);

    try {
      const result = await generateMutation.mutateAsync({
        brandId,
        themeId: selectedThemeId,
      });

      const resultData = result as { jobId?: string };
      if (resultData?.jobId) {
        setJobId(resultData.jobId);
      } else {
        // No job ID -- just refresh
        await queryClient.invalidateQueries({ queryKey: ['storefronts'] });
        setGenerating(false);
        addToast({ type: 'success', title: 'Storefront generated!' });
      }
    } catch (err) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : 'Failed to start storefront generation';
      addToast({ type: 'error', title: msg });
    }
  }, [brandId, selectedThemeId, generating, generateMutation, queryClient, addToast]);

  const handlePublishToggle = useCallback(async () => {
    if (!storefrontDetail) return;

    try {
      if (storefrontDetail.status === 'published') {
        await unpublishMutation.mutateAsync(storefrontDetail.id);
        addToast({ type: 'info', title: 'Storefront unpublished' });
      } else {
        await publishMutation.mutateAsync(storefrontDetail.id);
        addToast({ type: 'success', title: 'Storefront published!' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update storefront status';
      addToast({ type: 'error', title: msg });
    }
  }, [storefrontDetail, publishMutation, unpublishMutation, addToast]);

  const handleSlugSave = useCallback(async () => {
    if (!storefrontDetail || slugEdit === storefrontDetail.slug) return;

    try {
      await updateMutation.mutateAsync({ id: storefrontDetail.id, slug: slugEdit });
      addToast({ type: 'success', title: 'Storefront URL updated' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update slug';
      addToast({ type: 'error', title: msg });
      setSlugEdit(storefrontDetail.slug);
    }
  }, [storefrontDetail, slugEdit, updateMutation, addToast]);

  const handleRegenerate = useCallback(() => {
    setShowRegenWarning(false);
    setActiveStorefrontId(null);
  }, []);

  // API URL for preview iframe
  const apiUrl = import.meta.env.VITE_API_URL || '';

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── No brand selected ──────────────────────────────────────────────────────

  if (!brandId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
          <Store className="h-8 w-8 text-text-muted" />
        </div>
        <h2 className="text-xl font-bold text-text">No Brand Selected</h2>
        <p className="text-text-secondary text-center max-w-md">
          Select a brand from the brand switcher in the sidebar to build your storefront.
        </p>
      </motion.div>
    );
  }

  // ── State 1: No storefront — Theme Picker ──────────────────────────────────

  const hasStorefront = storefronts && storefronts.length > 0 && activeStorefrontId;

  if (!hasStorefront) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-3xl mx-auto py-8 px-4"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4"
          >
            <Sparkles className="h-8 w-8 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold text-text mb-2">Your Brand, Your Store</h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Pick a vibe and we'll build your entire storefront in seconds.
          </p>
        </div>

        {/* Generation Progress */}
        <AnimatePresence>
          {generating && jobId && (
            <div className="mb-6">
              <ProgressBar progress={genProgress.progress} message={genProgress.message} />
            </div>
          )}
        </AnimatePresence>

        {/* Theme Cards */}
        {themesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : themes && themes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
          >
            {themes.map((theme, i) => (
              <motion.div
                key={theme.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
              >
                <ThemeCard
                  theme={theme}
                  selected={selectedThemeId === theme.id}
                  onSelect={() => setSelectedThemeId(theme.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card variant="outlined" padding="lg" className="text-center mb-8">
            <p className="text-text-secondary">No themes available yet. Check back soon.</p>
          </Card>
        )}

        {/* Build Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selectedThemeId || generating}
            loading={generating}
            onClick={handleBuildStore}
            leftIcon={<Sparkles className="h-5 w-5" />}
            className="px-8"
          >
            Build My Store
          </Button>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-text-muted mt-6"
        >
          AI will generate your entire storefront using your brand identity, products, and colors.
        </motion.p>
      </motion.div>
    );
  }

  // ── State 2: Storefront Exists — Management View ───────────────────────────

  const sf = storefrontDetail;
  const isPublished = sf?.status === 'published';
  const slug = sf?.slug ?? '';
  const storefrontUrl = `${slug}.brandmenow.store`;
  const previewSrc = `${apiUrl}/api/v1/store/${slug}/preview`;
  const { width: iframeWidth } = DEVICE_CONFIG[previewDevice];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6 h-full"
    >
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              isPublished
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isPublished ? 'bg-success' : 'bg-warning',
              )}
            />
            {isPublished ? 'Live' : 'Draft'}
          </span>

          {/* Storefront URL */}
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <Globe className="h-3.5 w-3.5" />
            <a
              href={`https://${storefrontUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline decoration-dotted underline-offset-2"
            >
              {storefrontUrl}
            </a>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Regenerate */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRegenWarning(true)}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Regenerate
          </Button>

          {/* Publish / Unpublish */}
          <Button
            variant={isPublished ? 'outline' : 'primary'}
            size="sm"
            loading={publishMutation.isPending || unpublishMutation.isPending}
            onClick={handlePublishToggle}
            leftIcon={isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          >
            {isPublished ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Regeneration Warning Dialog */}
      <AnimatePresence>
        {showRegenWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="outlined" padding="md" className="border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text mb-1">
                    Regenerate storefront?
                  </p>
                  <p className="text-sm text-text-secondary mb-3">
                    This will replace your current storefront with a new AI-generated one.
                    Your current design will be lost.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRegenerate}
                    >
                      Yes, Regenerate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRegenWarning(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Area */}
      <Card variant="outlined" padding="none" className="flex-1 flex flex-col min-h-125">
        {/* Preview Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-sm font-medium text-text-secondary">Preview</span>
          <DeviceToggle device={previewDevice} onChange={setPreviewDevice} />
        </div>

        {/* Iframe Container */}
        <div className="flex-1 flex items-start justify-center bg-surface-elevated/50 p-4 overflow-auto">
          <motion.div
            layout
            transition={{ duration: 0.3 }}
            style={{ width: iframeWidth, maxWidth: '100%' }}
            className="h-full"
          >
            <iframe
              src={previewSrc}
              title="Storefront Preview"
              className="w-full h-full min-h-150 rounded-lg border border-border/30 bg-white"
              sandbox="allow-scripts allow-same-origin"
              onError={(e) => {
                // Fallback: hide the broken iframe and show placeholder
                const target = e.currentTarget;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling;
                if (placeholder instanceof HTMLElement) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
            {/* Fallback placeholder (hidden by default) */}
            <div
              className="w-full min-h-150 rounded-lg border border-border/30 bg-surface-elevated items-center justify-center flex-col gap-3"
              style={{ display: 'none' }}
            >
              <Store className="h-12 w-12 text-text-muted" />
              <p className="text-text-secondary font-medium">Preview loading...</p>
              <p className="text-sm text-text-muted">
                Your storefront is live at{' '}
                <span className="text-primary font-medium">{storefrontUrl}</span>
              </p>
            </div>
          </motion.div>
        </div>
      </Card>

      {/* Settings Section (collapsible) */}
      <Card variant="outlined" padding="none">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-hover/50 transition-colors"
        >
          <span className="text-sm font-medium text-text">Settings</span>
          {settingsOpen ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </button>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-2 border-t border-border/30 space-y-4">
                {/* Slug editor */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Storefront URL"
                      value={slugEdit}
                      onChange={(e) => setSlugEdit(e.target.value)}
                      rightAddon={<span className="text-xs text-text-muted">.brandmenow.store</span>}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={slugEdit === sf?.slug || updateMutation.isPending}
                    loading={updateMutation.isPending}
                    onClick={handleSlugSave}
                  >
                    Save
                  </Button>
                </div>

                {/* Theme info */}
                {sf?.themeId && themes && (
                  <div>
                    <p className="text-sm font-medium text-text mb-1">Theme</p>
                    <p className="text-sm text-text-secondary">
                      {themes.find((t) => t.id === sf.themeId)?.name ?? 'Custom'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
