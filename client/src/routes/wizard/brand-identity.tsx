import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Palette,
  Save,
  Type,
  Target,
  Heart,
  Eye,
  Sparkles,
  PenLine,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { ColorPalette, type ColorEntry } from '@/components/color-palette';
import { BrandDirectionCard } from '@/components/brand/BrandDirectionCard';
import { BrandNarrative } from '@/components/brand/BrandNarrative';
import { BrandVoiceSamples } from '@/components/brand/BrandVoiceSamples';
import { BrandToneSliders, type ToneValues } from '@/components/brand/BrandToneSliders';
import { FontPairingPreview } from '@/components/brand/FontPairingPreview';
import { ArchetypeExplainer } from '@/components/brand/ArchetypeExplainer';
import { TaglineSelector } from '@/components/brand/TaglineSelector';
import { ColorHarmonyValidator } from '@/components/brand/ColorHarmonyValidator';
import BrandStyleGuidePdf from '@/components/brand/BrandStyleGuidePdf';
import { BrandDnaVisualization } from '@/components/brand/BrandDnaVisualization';
import { LiveBrandPreview } from '@/components/brand/LiveBrandPreview';
import { ConfettiBurst } from '@/components/animations/ConfettiBurst';
import { LoadingTip } from '@/components/brand/LoadingTip';
import { useWizardStore } from '@/stores/wizard-store';
import { useSaveBrandIdentity } from '@/hooks/use-wizard-actions';
import {
  useDispatchBrandGeneration,
  useSelectBrandDirection,
  type BrandDirection,
} from '@/hooks/use-brand-generation';
import { useBrandDirections } from '@/hooks/use-brand-directions';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';

// ── Schema for the edit form ────────────────────────────────────

const brandIdentitySchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100),
  vision: z.string().min(10, 'Vision must be at least 10 characters').max(500),
  archetype: z.string().min(1, 'Archetype is required'),
  values: z.array(z.string().min(1)).min(1, 'At least one value is required').max(6),
  targetAudience: z.string().min(5, 'Target audience is required').max(300),
  colorPalette: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        name: z.string(),
        role: z.string(),
      }),
    )
    .min(3, 'At least 3 colors are needed'),
  fontPrimary: z.string().min(1, 'Primary font is required'),
  fontSecondary: z.string().min(1, 'Secondary font is required'),
});

type BrandIdentityForm = z.infer<typeof brandIdentitySchema>;

// ── Archetypes list ─────────────────────────────────────────────

const ARCHETYPES = [
  'The Creator', 'The Sage', 'The Explorer', 'The Hero',
  'The Magician', 'The Outlaw', 'The Regular Guy/Gal', 'The Lover',
  'The Jester', 'The Caregiver', 'The Ruler', 'The Innocent',
];

// ── Font options ────────────────────────────────────────────────

const FONT_OPTIONS = [
  'Inter', 'Space Grotesk', 'Poppins', 'Playfair Display', 'Montserrat',
  'Roboto', 'Lato', 'DM Sans', 'Raleway', 'Oswald', 'Merriweather',
  'Source Sans 3', 'Nunito', 'Work Sans', 'Sora', 'Outfit',
];

// ── Generation progress messages ────────────────────────────────

const GENERATION_MESSAGES = [
  'Analyzing your social DNA...',
  'Mapping brand archetypes...',
  'Crafting color palettes...',
  'Pairing typography...',
  'Defining brand voice...',
  'Writing brand narratives...',
  'Finalizing directions...',
];

// ── Phase enum ──────────────────────────────────────────────────

type Phase = 'loading' | 'choose-direction' | 'review-narrative' | 'customize';

// ── Component ───────────────────────────────────────────────────

export default function BrandIdentityPage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const design = useWizardStore((s) => s.design);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);
  const setActiveJob = useWizardStore((s) => s.setActiveJob);
  const addToast = useUIStore((s) => s.addToast);

  const saveMutation = useSaveBrandIdentity();
  const selectDirectionMutation = useSelectBrandDirection();
  const generateMutation = useDispatchBrandGeneration();

  // ── Local state ─────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading');
  const [directions, setDirections] = useState<BrandDirection[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<BrandDirection | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedTagline, setSelectedTagline] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const hasDispatchedRef = useRef(false);

  // ── Socket.io tracking for real-time generation progress ────
  const [trackingJobId, setTrackingJobId] = useState<string | null>(activeJobId);
  const brandGen = useBrandDirections(trackingJobId);

  // ── Auto-trigger generation on mount ──────────────────────────
  useEffect(() => {
    if (!brandId || hasDispatchedRef.current) return;
    hasDispatchedRef.current = true;

    generateMutation.mutate(
      { brandId },
      {
        onSuccess: (data) => {
          // Case 1: Server returned cached directions (no BullMQ job needed)
          if (data?.cached && data?.directions?.length) {
            setDirections(data.directions);
            setPhase('choose-direction');
            return;
          }
          // Case 2: Server dispatched a BullMQ job -- track via Socket.io
          if (data?.jobId) {
            setTrackingJobId(data.jobId);
            setActiveJob(data.jobId);
            // Phase stays 'loading'; brandGen hook will track progress
          }
        },
        onError: (err) => {
          setGenError(err instanceof Error ? err.message : 'Failed to generate brand directions');
          hasDispatchedRef.current = false;
        },
      },
    );
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to Socket.io progress updates ─────────────────────
  useEffect(() => {
    // When brandGen completes with directions, transition to choose phase
    if (brandGen.isComplete && brandGen.directions.length > 0) {
      setDirections(brandGen.directions);
      setPhase('choose-direction');
      setTrackingJobId(null);
      setActiveJob(null);
    }

    // Handle error from Socket.io
    if (brandGen.isError) {
      setGenError(brandGen.error || 'Brand generation failed');
    }
  }, [brandGen.isComplete, brandGen.isError, brandGen.directions, brandGen.error, setActiveJob]);

  // ── Rotating loading messages ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading') return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < GENERATION_MESSAGES.length - 1 ? prev + 1 : prev,
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [phase]);

  const [toneValues, setToneValues] = useState<ToneValues>({
    casualToFormal: 50,
    playfulToSerious: 50,
    boldToSubtle: 50,
    traditionalToModern: 50,
  });
  // ── Form setup (used in customize phase) ────────────────────
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset: resetForm,
    formState: { errors, isDirty },
  } = useForm<BrandIdentityForm>({
    resolver: zodResolver(brandIdentitySchema),
    defaultValues: {
      name: brand.name || '',
      vision: brand.vision || '',
      archetype: brand.archetype || '',
      values: brand.values.length > 0 ? brand.values : [''],
      targetAudience: brand.targetAudience || '',
      colorPalette: design.colorPalette.length > 0
        ? design.colorPalette.map((c) => ({ hex: c.hex, name: c.name, role: c.role }))
        : [
            { hex: '#6366f1', name: 'Primary', role: 'primary' },
            { hex: '#f43f5e', name: 'Secondary', role: 'secondary' },
            { hex: '#10b981', name: 'Accent', role: 'accent' },
            { hex: '#1e1b4b', name: 'Background', role: 'background' },
            { hex: '#f8fafc', name: 'Text', role: 'text' },
          ],
      fontPrimary: design.fonts?.primary || 'Inter',
      fontSecondary: design.fonts?.secondary || 'Space Grotesk',
    },
  });

  const watchedValues = watch('values');

  // ── Handlers ────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (!brandId) return;
    hasDispatchedRef.current = false;
    setGenError(null);
    setDirections([]);
    setPhase('loading');
    setLoadingMessageIndex(0);
    brandGen.reset();

    generateMutation.mutate(
      { brandId },
      {
        onSuccess: (data) => {
          if (data?.cached && data?.directions?.length) {
            setDirections(data.directions);
            setPhase('choose-direction');
            return;
          }
          if (data?.jobId) {
            setTrackingJobId(data.jobId);
            setActiveJob(data.jobId);
          }
        },
        onError: (err) => {
          setGenError(err instanceof Error ? err.message : 'Failed to generate brand directions');
          hasDispatchedRef.current = false;
        },
      },
    );
  }, [brandId, generateMutation, brandGen, setActiveJob]);

  const handleRegenerate = useCallback(() => {
    if (!brandId) return;
    hasDispatchedRef.current = true;
    setGenError(null);
    setDirections([]);
    setSelectedDirection(null);
    setPhase('loading');
    setLoadingMessageIndex(0);
    brandGen.reset();

    generateMutation.mutate(
      { brandId, regenerate: true },
      {
        onSuccess: (data) => {
          if (data?.directions?.length) {
            setDirections(data.directions);
            setPhase('choose-direction');
            return;
          }
          if (data?.jobId) {
            setTrackingJobId(data.jobId);
            setActiveJob(data.jobId);
          }
        },
        onError: (err) => {
          setGenError(err instanceof Error ? err.message : 'Failed to regenerate brand directions');
          hasDispatchedRef.current = false;
          if (directions.length > 0) {
            setPhase('choose-direction');
          }
        },
      },
    );
  }, [brandId, generateMutation, brandGen, setActiveJob, directions.length]);

  const handleSelectDirection = useCallback((direction: BrandDirection) => {
    setSelectedDirection(direction);
  }, []);

  const handleConfirmDirection = useCallback(() => {
    if (!selectedDirection) return;

    // Populate the form with the selected direction's values
    resetForm({
      name: brand.name || '',
      vision: selectedDirection.vision,
      archetype: selectedDirection.archetype.name,
      values: selectedDirection.values,
      targetAudience: brand.targetAudience || '',
      colorPalette: selectedDirection.colorPalette.map((c) => ({
        hex: c.hex,
        name: c.name,
        role: c.role,
      })),
      fontPrimary: selectedDirection.fonts.heading.family,
      fontSecondary: selectedDirection.fonts.body.family,
    });

    // Apply to stores
    setBrand({
      vision: selectedDirection.vision,
      archetype: selectedDirection.archetype.name,
      values: selectedDirection.values,
    });

    setDesign({
      colorPalette: selectedDirection.colorPalette.map((c) => ({
        hex: c.hex,
        name: c.name,
        role: c.role as 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'custom',
      })),
      fonts: {
        primary: selectedDirection.fonts.heading.family,
        secondary: selectedDirection.fonts.body.family,
      },
      logoStyle: selectedDirection.logoStyle.style,
    });

    // Set tone sliders based on voice
    const voiceLevel = selectedDirection.voice.vocabularyLevel;
    setToneValues({
      casualToFormal: voiceLevel === 'formal' ? 85 : voiceLevel === 'professional' ? 65 : voiceLevel === 'conversational' ? 35 : 15,
      playfulToSerious: selectedDirection.id === 'direction-a' ? 35 : selectedDirection.id === 'direction-b' ? 70 : 25,
      boldToSubtle: selectedDirection.id === 'direction-a' ? 20 : selectedDirection.id === 'direction-b' ? 60 : 45,
      traditionalToModern: selectedDirection.id === 'direction-c' ? 40 : 65,
    });

    // Save direction selection to API
    if (brandId) {
      selectDirectionMutation.mutate({
        brandId,
        directionId: selectedDirection.id,
        direction: selectedDirection,
      });
    }

    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
    setPhase('review-narrative');
  }, [selectedDirection, brand.name, brand.targetAudience, brandId, resetForm, setBrand, setDesign, selectDirectionMutation]);

  const handleProceedToCustomize = useCallback(() => {
    setPhase('customize');
  }, []);

  const onSubmit = async (data: BrandIdentityForm) => {
    setBrand({
      name: data.name,
      vision: data.vision,
      archetype: data.archetype,
      values: data.values.filter(Boolean),
      targetAudience: data.targetAudience,
    });

    setDesign({
      colorPalette: data.colorPalette as ColorEntry[],
      fonts: { primary: data.fontPrimary, secondary: data.fontSecondary },
    });

    if (brandId) {
      try {
        await saveMutation.mutateAsync({
          brandId,
          identity: {
            vision: data.vision,
            archetype: data.archetype,
            values: data.values.filter(Boolean),
            targetAudience: data.targetAudience,
            colorPalette: data.colorPalette as Array<{ hex: string; name: string; role: string }>,
            fonts: { primary: data.fontPrimary, secondary: data.fontSecondary },
          },
        });
      } catch {
        addToast({ type: 'error', title: 'Failed to save brand identity' });
        return;
      }
    }

    addToast({ type: 'success', title: 'Brand identity saved!' });
    setStep('logo-generation');
    navigate(ROUTES.WIZARD_LOGO_GENERATION);
  };

  const handleBack = () => {
    if (phase === 'customize') {
      setPhase('review-narrative');
    } else if (phase === 'review-narrative') {
      setPhase('choose-direction');
    } else {
      setStep('social-analysis');
      navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
    }
  };

  // Determine if we are in an error state
  const isError = genError !== null || generateMutation.isError;

  // ── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative flex flex-col gap-8"
    >
      {showCelebration && <ConfettiBurst active duration={2000} />}

      <AnimatePresence mode="wait">
        {/* ─── PHASE 0: Loading / Generating ─────────────────── */}
        {phase === 'loading' && !isError && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-8 py-16"
          >
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--bmn-color-primary)] to-[var(--bmn-color-accent)]">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
              <motion.div
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface border-2 border-border"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              >
                <Loader2 className="h-4 w-4 text-primary" />
              </motion.div>
            </motion.div>

            {/* Title */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text">
                Crafting Your Brand Directions
              </h2>
              <p className="mt-2 max-w-md text-text-secondary">
                Our AI is analyzing your social presence and creating three unique
                brand identity directions tailored just for you.
              </p>
            </div>

            {/* Progress indicator */}
            <div className="w-full max-w-md">
              <div className="mb-2 flex justify-between text-xs text-text-muted">
                <span>
                  {brandGen.message || GENERATION_MESSAGES[loadingMessageIndex]}
                </span>
                {brandGen.progress > 0 && (
                  <span>{Math.round(brandGen.progress)}%</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: '5%' }}
                  animate={{
                    width: `${Math.max(
                      brandGen.progress > 0 ? brandGen.progress : 0,
                      Math.min(5 + loadingMessageIndex * 14, 95),
                    )}%`,
                  }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Animated loading steps */}
            <div className="flex flex-col gap-2 text-sm">
              {GENERATION_MESSAGES.slice(0, loadingMessageIndex + 1).map(
                (msg, i) => (
                  <motion.div
                    key={msg}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    {i < loadingMessageIndex ? (
                      <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <motion.div
                        className="h-4 w-4 rounded-full border-2 border-primary"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}
                    <span
                      className={
                        i < loadingMessageIndex
                          ? 'text-text-muted line-through'
                          : 'text-text-secondary font-medium'
                      }
                    >
                      {msg}
                    </span>
                  </motion.div>
                ),
              )}
            </div>

            {/* Educational tips while loading */}
            <LoadingTip />
          </motion.div>
        )}

        {/* ─── ERROR STATE ───────────────────────────────────── */}
        {phase === 'loading' && isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 py-16"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-error/10">
              <AlertCircle className="h-10 w-10 text-error" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-text">Generation Failed</h2>
              <p className="mt-2 max-w-md text-text-secondary">
                {genError || 'Something went wrong while generating your brand directions. Please try again.'}
              </p>
            </div>
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
                type="button"
                size="lg"
                onClick={handleRetry}
                loading={generateMutation.isPending}
                leftIcon={<RefreshCw className="h-5 w-5" />}
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── PHASE 1: Choose Direction ─────────────────────── */}
        {phase === 'choose-direction' && directions.length > 0 && (
          <motion.div
            key="choose-direction"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-8"
          >
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-text">Choose Your Brand Direction</h2>
              <p className="mt-2 max-w-lg mx-auto text-text-secondary">
                Based on your social presence, we created three distinct brand identity directions.
                Each one interprets your content and audience differently. Pick the one that resonates.
              </p>
            </div>

            {/* 3 Direction Cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {directions.map((direction, index) => (
                <BrandDirectionCard
                  key={direction.id}
                  direction={direction}
                  selected={selectedDirection?.id === direction.id}
                  onSelect={() => handleSelectDirection(direction)}
                  index={index}
                />
              ))}
            </div>

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
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleRegenerate}
                loading={generateMutation.isPending}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Regenerate
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={!selectedDirection}
                onClick={handleConfirmDirection}
                rightIcon={<ArrowRight className="h-5 w-5" />}
                className="flex-1"
              >
                {selectedDirection
                  ? `Continue with "${selectedDirection.label}"`
                  : 'Select a Direction'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── PHASE 2: Narrative Review ─────────────────────── */}
        {phase === 'review-narrative' && selectedDirection && (
          <motion.div
            key="review-narrative"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
                <Palette className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text">Your Brand Identity</h2>
              <p className="mt-2 text-text-secondary">
                Direction: <span className="font-semibold">{selectedDirection.label}</span>
              </p>
            </div>

            {/* Brand Narrative */}
            <BrandNarrative direction={selectedDirection} brandName={brand.name} />

            {/* Archetype Explainer */}
            <ArchetypeExplainer archetype={selectedDirection.archetype.name} />

            {/* Voice Samples */}
            <BrandVoiceSamples direction={selectedDirection} brandName={brand.name} brandId={brandId} />

            {/* Tone Sliders */}
            <BrandToneSliders values={toneValues} onChange={setToneValues} />

            {/* Font Pairing Preview */}
            <FontPairingPreview
              headingFont={selectedDirection.fonts.heading.family}
              bodyFont={selectedDirection.fonts.body.family}
              brandName={brand.name}
              primaryColor={selectedDirection.colorPalette.find((c) => c.role === 'primary')?.hex}
              accentColor={selectedDirection.colorPalette.find((c) => c.role === 'accent')?.hex}
            />

            {/* Color Palette Display */}
            <Card variant="outlined" padding="md">
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Color Palette</CardTitle>
                </div>
                <ColorPalette
                  colors={selectedDirection.colorPalette.map((c) => ({
                    hex: c.hex,
                    name: c.name,
                    role: c.role as ColorEntry['role'],
                  }))}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="h-5 w-5" />}
              >
                Change Direction
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleProceedToCustomize}
                leftIcon={<PenLine className="h-5 w-5" />}
              >
                Customize
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  // Skip customization, go straight to logos
                  addToast({ type: 'success', title: 'Brand identity saved!' });
                  setStep('logo-generation');
                  navigate(ROUTES.WIZARD_LOGO_GENERATION);
                }}
                rightIcon={<ArrowRight className="h-5 w-5" />}
                className="flex-1"
              >
                Looks Great, Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── PHASE 3: Customize (Edit Form) ───────────────── */}
        {phase === 'customize' && (
          <motion.div
            key="customize"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
                <PenLine className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text">Customize Your Identity</h2>
              <p className="mt-2 text-text-secondary">
                Fine-tune every detail. Edit any field to make it perfectly yours.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
              {/* Brand Name */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Brand Name</CardTitle>
                  </div>
                  <Input
                    placeholder="Your brand name"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </CardContent>
              </Card>

              {/* Vision */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Brand Vision</CardTitle>
                  </div>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Describe your brand vision..."
                    {...register('vision')}
                  />
                  {errors.vision?.message && (
                    <p className="text-xs text-error">{errors.vision.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Archetype */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Brand Archetype</CardTitle>
                    <ArchetypeExplainer archetype={watch('archetype')} compact />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {ARCHETYPES.map((archetype) => (
                      <label
                        key={archetype}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface-hover has-checked:border-primary has-checked:bg-primary-light"
                      >
                        <input
                          type="radio"
                          value={archetype}
                          className="accent-primary"
                          {...register('archetype')}
                        />
                        <span className="text-sm text-text">{archetype}</span>
                      </label>
                    ))}
                  </div>
                  {errors.archetype?.message && (
                    <p className="text-xs text-error">{errors.archetype.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Values */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <CardTitle className="text-base">Brand Values</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {(watchedValues || []).map((_, index) => (
                      <Input
                        key={index}
                        placeholder={`Value ${index + 1}`}
                        className="w-40"
                        {...register(`values.${index}`)}
                      />
                    ))}
                    {(watchedValues?.length || 0) < 6 && (
                      <Controller
                        name="values"
                        control={control}
                        render={({ field }) => (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => field.onChange([...(field.value || []), ''])}
                          >
                            + Add Value
                          </Button>
                        )}
                      />
                    )}
                  </div>
                  {errors.values?.message && (
                    <p className="text-xs text-error">{errors.values.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Target Audience */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <CardTitle className="text-base">Target Audience</CardTitle>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Describe your target audience..."
                    {...register('targetAudience')}
                  />
                  {errors.targetAudience?.message && (
                    <p className="text-xs text-error">{errors.targetAudience.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Color Palette */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Color Palette</CardTitle>
                  </div>
                  <Controller
                    name="colorPalette"
                    control={control}
                    render={({ field }) => (
                      <ColorPalette
                        colors={field.value as ColorEntry[]}
                        onChange={field.onChange}
                        editable
                      />
                    )}
                  />
                  {/* Color Harmony Validation */}
                  <ColorHarmonyValidator colors={watch('colorPalette') || []} />

                  {errors.colorPalette?.message && (
                    <p className="text-xs text-error">{errors.colorPalette.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Fonts */}
              <Card variant="outlined" padding="md">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Typography</CardTitle>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">
                        Primary Font (Headings)
                      </label>
                      <select
                        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register('fontPrimary')}
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">
                        Secondary Font (Body)
                      </label>
                      <select
                        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register('fontSecondary')}
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live font preview */}
                  <FontPairingPreview
                    headingFont={watch('fontPrimary')}
                    bodyFont={watch('fontSecondary')}
                    brandName={watch('name')}
                    primaryColor={watch('colorPalette')?.[0]?.hex}
                    accentColor={watch('colorPalette')?.[2]?.hex}
                  />
                </CardContent>
              </Card>

              {/* Live Brand Preview */}
              <LiveBrandPreview
                brandName={watch('name')}
                archetype={watch('archetype')}
                primaryColor={watch('colorPalette')?.[0]?.hex || '#6366f1'}
                accentColor={watch('colorPalette')?.[2]?.hex || '#10b981'}
                backgroundColor={watch('colorPalette')?.[3]?.hex || '#1e1b4b'}
                textColor={watch('colorPalette')?.[4]?.hex || '#f8fafc'}
                headingFont={watch('fontPrimary')}
                bodyFont={watch('fontSecondary')}
                values={watch('values')?.filter(Boolean) || []}
              />

              {/* Tagline Selector */}
              <TaglineSelector
                brandName={watch('name')}
                archetype={watch('archetype')}
                values={watch('values')?.filter(Boolean) || []}
                brandId={brandId ?? undefined}
                selectedTagline={selectedTagline}
                onSelect={setSelectedTagline}
              />

              {/* Brand DNA Visualization */}
              <BrandDnaVisualization
                archetype={watch('archetype')}
                values={watch('values')?.filter(Boolean) || []}
                colorPalette={(watch('colorPalette') || []).map((c) => ({ hex: c.hex, name: c.name, role: c.role }))}
                targetAudience={watch('targetAudience')}
                brandName={watch('name')}
              />

              {/* Brand Style Guide PDF Export */}
              <BrandStyleGuidePdf
                brandName={watch('name')}
                vision={watch('vision')}
                archetype={watch('archetype')}
                values={watch('values')?.filter(Boolean)}
                targetAudience={watch('targetAudience')}
                voiceTone={selectedDirection?.voice?.tone}
                taglines={selectedTagline ? [selectedTagline, selectedDirection?.tagline].filter(Boolean) as string[] : selectedDirection?.tagline ? [selectedDirection.tagline] : []}
                colorPalette={(watch('colorPalette') || []).map((c) => ({ hex: c.hex, name: c.name, role: c.role }))}
                fonts={{ heading: watch('fontPrimary'), body: watch('fontSecondary') }}
              />

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
                  type="submit"
                  size="lg"
                  loading={saveMutation.isPending}
                  rightIcon={isDirty ? <Save className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                  className="flex-1"
                >
                  {isDirty ? 'Save & Continue' : 'Continue to Logos'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
