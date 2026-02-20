import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Instagram, ShoppingBag, Mail, MessageSquareQuote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandDirection } from '@/hooks/use-brand-generation';

// ── Types ────────────────────────────────────────────────────────

interface BrandVoiceSamplesProps {
  direction: BrandDirection;
  brandName?: string | null;
}

type VoiceTab = 'instagram' | 'product' | 'email' | 'taglines';

// ── Mock samples based on voice settings ─────────────────────────

function generateSamples(direction: BrandDirection, brandName: string) {
  const { tone, vocabularyLevel, communicationStyle } = direction.voice;
  const isCasual = vocabularyLevel === 'casual' || vocabularyLevel === 'conversational';
  const isFormal = vocabularyLevel === 'formal' || vocabularyLevel === 'professional';

  // These would be AI-generated in production via the brand-generator skill
  const samples = {
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

  return samples;
}

// ── Tab Button ───────────────────────────────────────────────────

function TabButton({
  tab,
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

export function BrandVoiceSamples({ direction, brandName }: BrandVoiceSamplesProps) {
  const [activeTab, setActiveTab] = useState<VoiceTab>('instagram');
  const name = brandName || 'Your Brand';
  const samples = generateSamples(direction, name);

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
        <h3 className="text-base font-bold text-text">How Your Brand Would Talk</h3>
        <p className="mt-1 text-xs text-text-muted">
          Voice: {direction.voice.tone} / {direction.voice.vocabularyLevel}
        </p>
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
              <div className="rounded-xl border border-border bg-surface-hover/30 p-4">
                <p className="text-sm font-semibold text-text mb-2">Product Description</p>
                <p className="text-sm leading-relaxed text-text-secondary">{samples.product}</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">Sample product description in your brand voice</p>
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
              <div className="rounded-xl border border-border bg-surface-hover/30 p-4">
                <p className="text-xs text-text-muted mb-1">Subject Line:</p>
                <p className="text-sm font-semibold text-text">{samples.email}</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">Sample email subject line in your brand voice</p>
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
              {samples.taglines.map((tagline, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-hover/30 px-4 py-3"
                >
                  <p className="text-sm font-medium text-text">{tagline}</p>
                </div>
              ))}
              <p className="text-xs text-text-muted">Sample tagline options in your brand voice</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
