import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Instagram, ShoppingBag, Mail, MessageSquareQuote, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import type { BrandDirection } from '@/hooks/use-brand-generation';

// ── Types ────────────────────────────────────────────────────────

interface BrandVoiceSamplesProps {
  direction: BrandDirection;
  brandName?: string | null;
  brandId?: string | null;
}

type VoiceTab = 'instagram' | 'product' | 'email' | 'taglines';

interface VoiceSamplesData {
  instagram: string;
  product: string;
  email: string;
  taglines: string[];
}

interface GenerateVoiceSamplesResponse {
  instagram?: string;
  instagramCaption?: string;
  product?: string;
  productDescription?: string;
  email?: string;
  emailSubjectLine?: string;
  taglines?: string[];
}

// ── AI generation hook (inline) ─────────────────────────────────

function useGenerateVoiceSamples() {
  return useMutation({
    mutationFn: ({ brandId, direction }: { brandId: string; direction: BrandDirection }) =>
      apiClient.post<GenerateVoiceSamplesResponse>(
        `/api/v1/wizard/${brandId}/generate-voice-samples`,
        {
          voice: direction.voice,
          archetype: direction.archetype,
          values: direction.values,
          vision: direction.vision,
          narrative: direction.narrative,
        },
      ),
  });
}

// ── Hardcoded fallback samples based on voice settings ──────────

function generateFallbackSamples(direction: BrandDirection, brandName: string): VoiceSamplesData {
  const { vocabularyLevel } = direction.voice;
  const isCasual = vocabularyLevel === 'casual' || vocabularyLevel === 'conversational';

  return {
    instagram: isCasual
      ? `Ok real talk -- we built ${brandName} because nobody was making this stuff the right way. Quality ingredients, clean formulas, zero shortcuts. Drop a comment if you've been looking for exactly this.`
      : `Introducing ${brandName}: where quality meets intention. Every product in our collection has been crafted with the same care and precision that defines our community. Discover the difference.`,

    product: isCasual
      ? `This right here? Our best seller for a reason. Made with premium ingredients you can actually pronounce, designed to fit right into your daily routine. No fillers, no compromises, no BS.`
      : `Meticulously formulated with premium, transparent ingredients, this flagship product represents the ${brandName} standard of excellence. Each component has been selected for maximum efficacy and purity.`,

    email: isCasual
      ? `You're going to love this`
      : `${brandName}: Your exclusive early access begins now`,

    taglines: isCasual
      ? [
          `${brandName} -- Built different.`,
          `Real ingredients. Real results.`,
          `Join the ${brandName} movement.`,
          `Your brand. Your rules.`,
        ]
      : [
          `${brandName} -- Elevate your standard.`,
          `Crafted with purpose. Delivered with precision.`,
          `The ${brandName} distinction.`,
          `Where excellence meets intention.`,
        ],
  };
}

// ── Normalize AI response into VoiceSamplesData ─────────────────

function normalizeAiSamples(raw: GenerateVoiceSamplesResponse, fallback: VoiceSamplesData): VoiceSamplesData {
  return {
    instagram: raw.instagram || raw.instagramCaption || fallback.instagram,
    product: raw.product || raw.productDescription || fallback.product,
    email: raw.email || raw.emailSubjectLine || fallback.email,
    taglines: Array.isArray(raw.taglines) && raw.taglines.length > 0 ? raw.taglines : fallback.taglines,
  };
}

// ── Loading skeleton ────────────────────────────────────────────

function VoiceSampleSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="rounded-xl border border-border bg-surface-hover/30 p-4 space-y-2">
        <div className="h-3 w-1/3 rounded bg-surface-hover" />
        <div className="h-3 w-full rounded bg-surface-hover" />
        <div className="h-3 w-5/6 rounded bg-surface-hover" />
        <div className="h-3 w-2/3 rounded bg-surface-hover" />
      </div>
      <div className="h-3 w-1/2 rounded bg-surface-hover" />
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────────

function TabButton({
  tab: _tab,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  tab: VoiceTab;
  label: string;
  icon: typeof Instagram;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-transparent text-text-secondary hover:bg-surface-hover',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function BrandVoiceSamples({ direction, brandName, brandId }: BrandVoiceSamplesProps) {
  const [activeTab, setActiveTab] = useState<VoiceTab>('instagram');
  const [aiSamples, setAiSamples] = useState<VoiceSamplesData | null>(null);
  const name = brandName || 'Your Brand';
  const fallbackSamples = generateFallbackSamples(direction, name);

  const generateMutation = useGenerateVoiceSamples();

  // Auto-trigger AI generation when brandId is available
  useEffect(() => {
    if (brandId && !aiSamples && !generateMutation.isPending && !generateMutation.isError) {
      generateMutation.mutate(
        { brandId, direction },
        {
          onSuccess: (data) => {
            if (data) {
              setAiSamples(normalizeAiSamples(data, fallbackSamples));
            }
          },
        },
      );
    }
    // Only trigger once on mount or when brandId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const handleRegenerate = useCallback(() => {
    if (!brandId || generateMutation.isPending) return;
    setAiSamples(null);
    generateMutation.mutate(
      { brandId, direction },
      {
        onSuccess: (data) => {
          if (data) {
            setAiSamples(normalizeAiSamples(data, fallbackSamples));
          }
        },
      },
    );
  }, [brandId, direction, generateMutation, fallbackSamples]);

  // Use AI samples if available, otherwise fall back to hardcoded templates
  const samples = aiSamples ?? fallbackSamples;
  const isLoading = generateMutation.isPending;

  const tabs: Array<{ key: VoiceTab; label: string; icon: typeof Instagram }> = [
    { key: 'instagram', label: 'Instagram', icon: Instagram },
    { key: 'product', label: 'Product', icon: ShoppingBag },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'taglines', label: 'Taglines', icon: MessageSquareQuote },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text">How Your Brand Would Talk</h3>
            <p className="mt-1 text-xs text-text-muted">
              Voice: {direction.voice.tone} / {direction.voice.vocabularyLevel}
              {aiSamples && (
                <span className="ml-2 inline-flex items-center rounded-full bg-accent-light px-1.5 py-0.5 text-xs font-medium text-accent">
                  AI generated
                </span>
              )}
              {!aiSamples && !isLoading && (
                <span className="ml-2 inline-flex items-center rounded-full bg-surface-hover px-1.5 py-0.5 text-xs font-medium text-text-muted">
                  Template
                </span>
              )}
            </p>
          </div>
          {brandId && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                'text-text-secondary hover:text-primary hover:bg-surface-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{isLoading ? 'Generating...' : 'Regenerate'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-4 py-2 bg-surface-hover/50">
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab.key}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'instagram' && (
            <motion.div
              key="instagram"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading && !aiSamples ? (
                <VoiceSampleSkeleton />
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface-hover/30 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-accent" />
                      <span className="text-sm font-semibold text-text">{name.toLowerCase().replace(/\s+/g, '')}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-text">{samples.instagram}</p>
                    <div className="mt-3 flex gap-4 text-xs text-text-muted">
                      <span>342 likes</span>
                      <span>28 comments</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">Sample Instagram caption in your brand voice</p>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'product' && (
            <motion.div
              key="product"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading && !aiSamples ? (
                <VoiceSampleSkeleton />
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface-hover/30 p-4">
                    <p className="text-sm font-semibold text-text mb-2">Product Description</p>
                    <p className="text-sm leading-relaxed text-text-secondary">{samples.product}</p>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">Sample product description in your brand voice</p>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading && !aiSamples ? (
                <VoiceSampleSkeleton />
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface-hover/30 p-4">
                    <p className="text-xs text-text-muted mb-1">Subject Line:</p>
                    <p className="text-sm font-semibold text-text">{samples.email}</p>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">Sample email subject line in your brand voice</p>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'taglines' && (
            <motion.div
              key="taglines"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {isLoading && !aiSamples ? (
                <VoiceSampleSkeleton />
              ) : (
                <>
                  {samples.taglines.map((tagline, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface-hover/30 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-text">{tagline}</p>
                    </div>
                  ))}
                  <p className="text-xs text-text-muted">Sample tagline options in your brand voice</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
