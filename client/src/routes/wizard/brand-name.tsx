import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  PenLine,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { BrandNameCard } from '@/components/brand/BrandNameCard';
import { useWizardStore } from '@/stores/wizard-store';
import { useUIStore } from '@/stores/ui-store';
import { useDispatchNameGeneration, useSelectBrandName } from '@/hooks/use-name-generation';
import { ROUTES } from '@/lib/constants';
import type { NameSuggestion } from '@/hooks/use-name-generation';

// ── Mock data for prototype (will be replaced by real Socket.io events) ──

const MOCK_SUGGESTIONS: NameSuggestion[] = [
  {
    name: 'Lumivora',
    technique: 'invented',
    rationale: 'Combines "lumi" (light) with "vora" (to devour/embrace), suggesting a brand that devours the spotlight with radiant energy.',
    pronunciation: 'LOO-mih-VOR-ah',
    scores: { memorability: 9, brandability: 9 },
    domain: { com: 'available', co: 'available', io: 'taken', bestAvailable: 'lumivora.com' },
    socialHandles: { instagram: 'available', tiktok: 'available', youtube: 'available' },
    trademark: { status: 'clear', risk: 'low', notes: 'No existing trademarks found.' },
  },
  {
    name: 'Aureate',
    technique: 'evocative',
    rationale: 'Means "golden" or "gilded" -- evokes premium quality, warmth, and aspiration. Connects to the golden standard of personal branding.',
    pronunciation: 'AW-ree-it',
    scores: { memorability: 8, brandability: 8 },
    domain: { com: 'taken', co: 'available', io: 'available', bestAvailable: 'aureate.co' },
    socialHandles: { instagram: 'taken', tiktok: 'available', youtube: 'available' },
    trademark: { status: 'potential-conflict', risk: 'medium', notes: 'Similar name found in jewelry category.' },
  },
  {
    name: 'Vantage Point',
    technique: 'metaphor',
    rationale: 'Suggests an elevated perspective -- a brand that gives creators a strategic viewpoint above their competition.',
    pronunciation: 'VAN-tij POINT',
    scores: { memorability: 7, brandability: 7 },
    domain: { com: 'taken', co: 'taken', io: 'available', bestAvailable: 'vantagepoint.io' },
    socialHandles: { instagram: 'taken', tiktok: 'taken', youtube: 'taken' },
    trademark: { status: 'potential-conflict', risk: 'medium', notes: 'Multiple trademarks exist with similar name.' },
  },
  {
    name: 'Kindred Co',
    technique: 'descriptive',
    rationale: 'Speaks to community and shared values. "Kindred" implies like-minded people drawn together, perfect for a creator brand.',
    pronunciation: 'KIN-dred CO',
    scores: { memorability: 8, brandability: 8 },
    domain: { com: 'taken', co: 'available', io: 'available', bestAvailable: 'kindredco.co' },
    socialHandles: { instagram: 'taken', tiktok: 'available', youtube: 'available' },
    trademark: { status: 'clear', risk: 'low', notes: 'No direct conflicts found in relevant categories.' },
  },
  {
    name: 'Novahaus',
    technique: 'compound',
    rationale: 'Combines "nova" (new/star) with "haus" (house/creative studio), blending innovation with craftsmanship. German-inspired sounds premium.',
    pronunciation: 'NO-vah-HOUS',
    scores: { memorability: 9, brandability: 9 },
    domain: { com: 'available', co: 'available', io: 'available', bestAvailable: 'novahaus.com' },
    socialHandles: { instagram: 'available', tiktok: 'available', youtube: 'available' },
    trademark: { status: 'clear', risk: 'low', notes: 'No existing trademarks found.' },
  },
  {
    name: 'Meridian',
    technique: 'metaphor',
    rationale: 'A meridian is a line of longitude -- symbolizes reaching the peak, the highest point. Suggests ambition and global reach.',
    pronunciation: 'meh-RID-ee-an',
    scores: { memorability: 8, brandability: 7 },
    domain: { com: 'taken', co: 'taken', io: 'taken', bestAvailable: null },
    socialHandles: { instagram: 'taken', tiktok: 'taken', youtube: 'taken' },
    trademark: { status: 'conflict-found', risk: 'high', notes: 'Existing trademark in multiple categories.' },
  },
  {
    name: 'Prismiq',
    technique: 'coined',
    rationale: 'Based on "prism" (refracting light into many colors) with a modern "-iq" suffix, suggesting multifaceted intelligence and creativity.',
    pronunciation: 'PRIZ-meek',
    scores: { memorability: 8, brandability: 9 },
    domain: { com: 'available', co: 'available', io: 'available', bestAvailable: 'prismiq.com' },
    socialHandles: { instagram: 'available', tiktok: 'available', youtube: 'available' },
    trademark: { status: 'clear', risk: 'low', notes: 'No existing trademarks found.' },
  },
  {
    name: 'Embark Studio',
    technique: 'descriptive',
    rationale: 'Embark means to begin a journey -- perfect for creators starting their brand journey. "Studio" adds creative professionalism.',
    pronunciation: 'em-BARK STOO-dee-oh',
    scores: { memorability: 7, brandability: 7 },
    domain: { com: 'taken', co: 'available', io: 'available', bestAvailable: 'embarkstudio.co' },
    socialHandles: { instagram: 'taken', tiktok: 'available', youtube: 'taken' },
    trademark: { status: 'potential-conflict', risk: 'medium', notes: 'Gaming studio with similar name exists.' },
  },
];

// ── Component ──────────────────────────────────────────────────

export default function BrandNamePage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setStep = useWizardStore((s) => s.setStep);
  const addToast = useUIStore((s) => s.addToast);

  const [suggestions, setSuggestions] = useState<NameSuggestion[]>(MOCK_SUGGESTIONS);
  const [selectedName, setSelectedName] = useState<string | null>(brand.name || null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const dispatchMutation = useDispatchNameGeneration();
  const selectMutation = useSelectBrandName();

  const topRecommendation = suggestions.length > 0 ? suggestions[0].name : null;

  const handleSelectName = useCallback((name: string) => {
    setSelectedName(name);
    setIsCustomMode(false);
    setCustomName('');
  }, []);

  const handleCustomNameSubmit = useCallback(() => {
    if (customName.trim()) {
      setSelectedName(customName.trim());
      setIsCustomMode(false);
    }
  }, [customName]);

  const handleRegenerate = useCallback(async () => {
    if (!brandId) return;
    setIsGenerating(true);
    setSelectedName(null);

    try {
      await dispatchMutation.mutateAsync({
        brandId,
        archetype: brand.archetype || undefined,
        traits: brand.values.length > 0 ? brand.values : undefined,
      });
      // In production, the results would come via Socket.io events.
      // For now, simulate with a delay and the same mock data shuffled.
      setTimeout(() => {
        const shuffled = [...MOCK_SUGGESTIONS].sort(() => Math.random() - 0.5);
        setSuggestions(shuffled);
        setIsGenerating(false);
      }, 2000);
    } catch {
      addToast({ type: 'error', title: 'Failed to generate names. Please try again.' });
      setIsGenerating(false);
    }
  }, [brandId, brand.archetype, brand.values, dispatchMutation, addToast]);

  const handleContinue = async () => {
    if (!selectedName) {
      addToast({ type: 'warning', title: 'Please select a brand name to continue.' });
      return;
    }

    setBrand({ name: selectedName });

    if (brandId) {
      try {
        await selectMutation.mutateAsync({
          brandId,
          name: selectedName,
          isCustom: !suggestions.some((s) => s.name === selectedName),
        });
      } catch {
        addToast({ type: 'error', title: 'Failed to save brand name.' });
        return;
      }
    }

    addToast({ type: 'success', title: `"${selectedName}" locked in!` });
    setStep('brand-identity');
    navigate(ROUTES.WIZARD_BRAND_IDENTITY);
  };

  const handleBack = () => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light">
          <Sparkles className="h-7 w-7 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-text">Name Your Brand</h2>
        <p className="mt-2 max-w-lg mx-auto text-text-secondary">
          We generated brand name options based on your social presence and brand personality.
          Select your favorite, or type your own.
        </p>
      </div>

      {/* Generating state */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-accent" />
              <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-accent" />
            </div>
            <p className="text-sm text-text-secondary">Brainstorming creative names...</p>
            <p className="text-xs text-text-muted">Checking domains, social handles, and trademarks</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Name suggestions grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {suggestions.map((suggestion, index) => (
                <BrandNameCard
                  key={suggestion.name}
                  suggestion={suggestion}
                  selected={selectedName === suggestion.name}
                  onSelect={() => handleSelectName(suggestion.name)}
                  rank={index}
                  isTopRecommendation={suggestion.name === topRecommendation}
                />
              ))}
            </div>

            {/* Custom name option */}
            <Card variant="outlined" padding="md">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-text-muted" />
                  <span className="text-sm font-medium text-text">Have your own name in mind?</span>
                </div>

                {isCustomMode ? (
                  <div className="flex gap-2">
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Type your brand name..."
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomNameSubmit()}
                      className="flex-1"
                    />
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleCustomNameSubmit}
                      disabled={!customName.trim()}
                    >
                      Use This Name
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        setIsCustomMode(false);
                        setCustomName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setIsCustomMode(true)}
                    leftIcon={<Type className="h-4 w-4" />}
                    className="self-start"
                  >
                    Type My Own Name
                  </Button>
                )}

                {/* Show custom name as selected if set */}
                {selectedName && !suggestions.some((s) => s.name === selectedName) && (
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-primary bg-primary-light px-4 py-3">
                    <span className="text-sm font-semibold text-text">Using custom name:</span>
                    <span className="text-sm font-bold text-primary">{selectedName}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Regenerate button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                disabled={isGenerating}
              >
                Generate New Names
              </Button>
            </div>

            {/* Disclaimer */}
            <p className="text-center text-xs text-text-muted">
              Domain and social handle availability are estimates. Trademark results are informational
              only and do not constitute legal advice. Verify before finalizing.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
          onClick={handleContinue}
          loading={selectMutation.isPending}
          disabled={!selectedName || isGenerating}
          rightIcon={<ArrowRight className="h-5 w-5" />}
          className="flex-1"
        >
          {selectedName ? `Continue with "${selectedName}"` : 'Select a Name'}
        </Button>
      </div>
    </motion.div>
  );
}
