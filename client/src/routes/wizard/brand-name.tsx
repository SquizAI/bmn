import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  PenLine,
  Type,
  AlertCircle,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { BrandNameCard } from '@/components/brand/BrandNameCard';
import { ConfettiBurst } from '@/components/animations/ConfettiBurst';
import { useWizardStore } from '@/stores/wizard-store';
import { useUIStore } from '@/stores/ui-store';
import {
  useDispatchNameGeneration,
  useSelectBrandName,
  parseNameGenerationResult,
} from '@/hooks/use-name-generation';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import { ROUTES } from '@/lib/constants';
import type { NameSuggestion } from '@/hooks/use-name-generation';

// ── Component ──────────────────────────────────────────────────

export default function BrandNamePage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const activeJobId = useWizardStore((s) => s.meta.activeJobId);
  const dossier = useWizardStore((s) => s.dossier);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setStep = useWizardStore((s) => s.setStep);
  const setActiveJob = useWizardStore((s) => s.setActiveJob);
  const addToast = useUIStore((s) => s.addToast);

  // Detect brand name from dossier profile (bio or display name)
  const detectedBrandName = useMemo(() => {
    const rawDossier = dossier.rawDossier;
    if (!rawDossier?.profile) return null;

    const displayName = rawDossier.profile.displayName;
    const bio = rawDossier.profile.bio;

    if (!displayName) return null;
    const trimmed = displayName.trim();
    if (!trimmed) return null;

    // Heuristic: detect brand-like names (numbers, special chars, all-caps, trademark symbols)
    const hasNumbers = /\d/.test(trimmed);
    const hasSpecialChars = /[_.|&+@#!]/.test(trimmed);
    const isAllCaps = trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    const hasTrademarkSymbol = /[™®©]/.test(trimmed);

    if (hasNumbers || hasSpecialChars || isAllCaps || hasTrademarkSymbol) {
      return trimmed;
    }

    // Check bio for explicit brand mentions
    if (bio) {
      const brandPatterns = [
        /(?:founder|ceo|creator|owner)\s+(?:of|@)\s+(.+?)(?:\s*[|.,!]|$)/i,
        /(?:brand|company|shop|store):\s*(.+?)(?:\s*[|.,!]|$)/i,
      ];
      for (const pattern of brandPatterns) {
        const match = bio.match(pattern);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    }

    return null;
  }, [dossier.rawDossier]);

  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(brand.name || null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const dispatchMutation = useDispatchNameGeneration();
  const selectMutation = useSelectBrandName();

  // Track the current job's progress via Socket.io
  const generation = useGenerationProgress(activeJobId);
  const isGenerating =
    generation.status === 'pending' || generation.status === 'processing';

  // Track whether we already processed this job's result
  const processedJobRef = useRef<string | null>(null);

  // When the Socket.io job completes, parse the result into suggestions
  useEffect(() => {
    if (
      generation.isComplete &&
      generation.result &&
      activeJobId &&
      processedJobRef.current !== activeJobId
    ) {
      processedJobRef.current = activeJobId;
      const parsed = parseNameGenerationResult(generation.result);
      if (parsed.suggestions.length > 0) {
        setSuggestions(parsed.suggestions);
        setHasGenerated(true);
      } else {
        addToast({
          type: 'warning',
          title: 'No names were generated. Try again with different preferences.',
        });
      }
      // Clear the active job so the progress hook resets
      setActiveJob(null);
    }
  }, [generation.isComplete, generation.result, activeJobId, setActiveJob, addToast]);

  // Handle generation errors
  useEffect(() => {
    if (generation.isError && activeJobId) {
      addToast({
        type: 'error',
        title: generation.error || 'Name generation failed. Please try again.',
      });
      setActiveJob(null);
    }
  }, [generation.isError, generation.error, activeJobId, setActiveJob, addToast]);

  // Auto-trigger generation on first mount if no suggestions exist
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      brandId &&
      !autoTriggeredRef.current &&
      suggestions.length === 0 &&
      !isGenerating &&
      !hasGenerated
    ) {
      autoTriggeredRef.current = true;
      dispatchMutation.mutate(
        {
          brandId,
          archetype: brand.archetype || undefined,
          traits: brand.values.length > 0 ? brand.values : undefined,
        },
        {
          onSuccess: (data) => {
            // Server returned suggestions directly (synchronous Claude call)
            if (data?.suggestions?.length) {
              setSuggestions(data.suggestions);
              setHasGenerated(true);
              return;
            }
            // Fall back to Socket.io tracking if jobId returned
          },
          onError: () => {
            autoTriggeredRef.current = false;
            addToast({ type: 'error', title: 'Failed to generate names. Please try again.' });
          },
        },
      );
    }
  }, [brandId, suggestions.length, isGenerating, hasGenerated, brand.archetype, brand.values, dispatchMutation, addToast]);

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
    setSelectedName(null);
    setSuggestions([]);
    processedJobRef.current = null;
    generation.reset();

    try {
      const data = await dispatchMutation.mutateAsync({
        brandId,
        regenerate: true,
        archetype: brand.archetype || undefined,
        traits: brand.values.length > 0 ? brand.values : undefined,
      });
      // Handle direct results from synchronous Claude call
      if (data?.suggestions?.length) {
        setSuggestions(data.suggestions);
        setHasGenerated(true);
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to generate names. Please try again.' });
    }
  }, [brandId, brand.archetype, brand.values, dispatchMutation, addToast, generation]);

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
    setShowCelebration(true);
    setTimeout(() => {
      setShowCelebration(false);
      setStep('brand-identity');
      navigate(ROUTES.WIZARD_BRAND_IDENTITY);
    }, 1200);
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
      className="relative flex flex-col gap-8"
    >
      {showCelebration && <ConfettiBurst active duration={2000} />}

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

        {/* Detected brand name indicator */}
        {detectedBrandName && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--bmn-color-accent)]/30 bg-[var(--bmn-color-accent)]/10 px-4 py-2"
          >
            <BadgeCheck className="h-4 w-4 text-[var(--bmn-color-accent)]" />
            <span className="text-xs text-text-secondary">
              We detected{' '}
              <button
                type="button"
                onClick={() => handleSelectName(detectedBrandName)}
                className="font-semibold text-[var(--bmn-color-accent)] underline underline-offset-2 transition-colors hover:text-[var(--bmn-color-primary)]"
              >
                "{detectedBrandName}"
              </button>
              {' '}from your profile -- use this or enter a custom name
            </span>
          </motion.div>
        )}
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
            role="status"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-accent" />
              <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-accent" />
            </div>
            <p className="text-sm text-text-secondary">
              {generation.message || 'Brainstorming creative names...'}
            </p>
            <p className="text-xs text-text-muted">Checking domains, social handles, and trademarks</p>
            {generation.progress > 0 && (
              <div className="mt-2 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${generation.progress}%` }}
                  transition={{ duration: 0.3 }}
                  role="progressbar"
                  aria-valuenow={Math.round(generation.progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Name generation progress"
                />
              </div>
            )}
          </motion.div>
        ) : suggestions.length === 0 && hasGenerated ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <AlertCircle className="h-12 w-12 text-text-muted" />
            <p className="text-sm text-text-secondary">
              No suggestions generated yet. Click below to generate names.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleRegenerate}
              leftIcon={<Sparkles className="h-4 w-4" />}
              loading={dispatchMutation.isPending}
            >
              Generate Brand Names
            </Button>
          </motion.div>
        ) : suggestions.length === 0 && !hasGenerated ? (
          <motion.div
            key="initial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16"
            role="status"
            aria-busy="true"
          >
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-accent" />
              <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-accent" />
            </div>
            <p className="text-sm text-text-secondary">Preparing name generation...</p>
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
                      aria-label="Custom brand name"
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
