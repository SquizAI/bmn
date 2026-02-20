import { useState, useCallback } from 'react';
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
import { useWizardStore } from '@/stores/wizard-store';
import { useSaveBrandIdentity } from '@/hooks/use-wizard-actions';
import {
  useSelectBrandDirection,
  type BrandDirection,
} from '@/hooks/use-brand-generation';
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

// ── Mock 3 Directions (replaced by real AI in production) ───────

const MOCK_DIRECTIONS: BrandDirection[] = [
  {
    id: 'direction-a',
    label: 'Bold & Energetic',
    tagline: 'Stand out. Speak loud. Own it.',
    archetype: { name: 'The Hero', score: 0.88, description: 'Your content radiates determination and strength. You inspire your audience to take action and achieve their goals.' },
    vision: 'Empower a generation of creators to build brands that demand attention and drive real results.',
    values: ['Courage', 'Authenticity', 'Impact', 'Excellence'],
    colorPalette: [
      { hex: '#111111', name: 'Obsidian', role: 'primary' },
      { hex: '#FF4D4D', name: 'Flame Red', role: 'secondary' },
      { hex: '#FFB800', name: 'Electric Gold', role: 'accent' },
      { hex: '#FAFAFA', name: 'Clean White', role: 'background' },
      { hex: '#1A1A1A', name: 'Near Black', role: 'text' },
    ],
    fonts: { heading: { family: 'Oswald', weight: '700' }, body: { family: 'Source Sans 3', weight: '400' } },
    voice: { tone: 'Direct, confident, and action-oriented', vocabularyLevel: 'conversational', communicationStyle: 'Motivational calls-to-action with punchy, short sentences' },
    logoStyle: { style: 'bold', reasoning: 'Bold typography and high-contrast design match your energetic, action-driven content style.' },
    narrative: 'Based on your content, you are a natural motivator. Your audience looks to you for the push they need to take the next step. Your brand should feel like a rallying cry -- bold colors, strong typography, and messaging that hits hard.',
  },
  {
    id: 'direction-b',
    label: 'Clean & Premium',
    tagline: 'Refined. Intentional. Elevated.',
    archetype: { name: 'The Ruler', score: 0.82, description: 'Your aesthetic is polished and purposeful. You project authority and sophistication that your audience trusts.' },
    vision: 'Set the standard for premium creator brands through meticulous quality and refined aesthetics.',
    values: ['Quality', 'Precision', 'Trust', 'Sophistication'],
    colorPalette: [
      { hex: '#1C1C1E', name: 'Rich Black', role: 'primary' },
      { hex: '#B8956A', name: 'Champagne Gold', role: 'secondary' },
      { hex: '#E8DDD3', name: 'Warm Linen', role: 'accent' },
      { hex: '#FEFDFB', name: 'Ivory', role: 'background' },
      { hex: '#2C2C2E', name: 'Charcoal', role: 'text' },
    ],
    fonts: { heading: { family: 'Playfair Display', weight: '700' }, body: { family: 'Inter', weight: '400' } },
    voice: { tone: 'Polished, authoritative, and understated', vocabularyLevel: 'professional', communicationStyle: 'Elegant and measured, with confidence that speaks through restraint' },
    logoStyle: { style: 'minimal', reasoning: 'Minimalist design with premium typography conveys the sophisticated, high-end positioning of your brand.' },
    narrative: 'Based on your content, you have an eye for quality and detail that your audience deeply respects. Your brand should feel like a luxury experience -- refined colors, elegant typography, and messaging that conveys authority without shouting.',
  },
  {
    id: 'direction-c',
    label: 'Warm & Approachable',
    tagline: 'Real. Relatable. Yours.',
    archetype: { name: 'The Caregiver', score: 0.85, description: 'Your content creates genuine connection. Your audience feels seen and supported through your warm, nurturing presence.' },
    vision: 'Build a brand that feels like a trusted friend -- accessible, genuine, and deeply human.',
    values: ['Community', 'Empathy', 'Transparency', 'Joy'],
    colorPalette: [
      { hex: '#5B4A3F', name: 'Warm Earth', role: 'primary' },
      { hex: '#E07A5F', name: 'Terracotta', role: 'secondary' },
      { hex: '#F4D35E', name: 'Sunlight', role: 'accent' },
      { hex: '#FFF8F0', name: 'Cream', role: 'background' },
      { hex: '#3D3027', name: 'Dark Bark', role: 'text' },
    ],
    fonts: { heading: { family: 'DM Sans', weight: '700' }, body: { family: 'Nunito', weight: '400' } },
    voice: { tone: 'Warm, friendly, and encouraging', vocabularyLevel: 'casual', communicationStyle: 'Storytelling with personal anecdotes, like talking to a friend' },
    logoStyle: { style: 'modern', reasoning: 'Modern but warm design with rounded elements creates the approachable, friendly feel that matches your community-building style.' },
    narrative: 'Based on your content, you build real connections. Your audience trusts you because you show up as yourself -- no facade, no filters. Your brand should feel like coming home -- warm tones, friendly typography, and messaging that makes everyone feel welcome.',
  },
];

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

// ── Phase enum ──────────────────────────────────────────────────

type Phase = 'choose-direction' | 'review-narrative' | 'customize';

// ── Component ───────────────────────────────────────────────────

export default function BrandIdentityPage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const design = useWizardStore((s) => s.design);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setDesign = useWizardStore((s) => s.setDesign);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const saveMutation = useSaveBrandIdentity();
  const selectDirectionMutation = useSelectBrandDirection();

  // ── Local state ─────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('choose-direction');
  const [directions] = useState<BrandDirection[]>(MOCK_DIRECTIONS);
  const [selectedDirection, setSelectedDirection] = useState<BrandDirection | null>(null);
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

  // ── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      <AnimatePresence mode="wait">
        {/* ─── PHASE 1: Choose Direction ─────────────────────── */}
        {phase === 'choose-direction' && (
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
            <BrandVoiceSamples direction={selectedDirection} brandName={brand.name} />

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
