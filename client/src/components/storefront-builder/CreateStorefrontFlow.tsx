import { useState, useEffect } from 'react';
import { useBrands } from '@/hooks/use-brands';
import { useGenerateStorefront } from '@/hooks/use-storefront';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Zap, BookOpen, TrendingUp, Sparkles, Loader2, Check, Store,
  ArrowRight, ShieldCheck, BarChart3, MessageSquare,
} from 'lucide-react';

type TemplateId = 'bold' | 'story' | 'conversion';

interface Template {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  accentFrom: string;
  accentTo: string;
  sections: string[];
  bestFor: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'bold',
    name: 'Bold & Direct',
    tagline: 'Products speak louder than words',
    description: 'Hero → Products → Social proof. Minimal copy, maximum impact. Gets straight to what you sell.',
    icon: Zap,
    accentFrom: '#D4A574',
    accentTo: '#E8C9A0',
    sections: ['Hero', 'Trust Bar', 'Products', 'Steps', 'Quality', 'Testimonials', 'FAQ', 'Contact'],
    bestFor: 'Performance & Fitness Brands',
  },
  {
    id: 'story',
    name: 'Story-Driven',
    tagline: 'Lead with your brand, sell with trust',
    description: 'Brand narrative first, then products. Builds emotional connection before asking for the sale.',
    icon: BookOpen,
    accentFrom: '#7C9A6E',
    accentTo: '#A3C293',
    sections: ['Hero', 'Welcome', 'About', 'Bundles', 'Why Bundles', 'Testimonials', 'Quality', 'FAQ', 'Products', 'Contact'],
    bestFor: 'Wellness & Lifestyle Brands',
  },
  {
    id: 'conversion',
    name: 'Conversion Machine',
    tagline: 'Full funnel, maximum revenue',
    description: 'Trust → Desire → Action. Every section engineered to move visitors toward checkout.',
    icon: TrendingUp,
    accentFrom: '#6B7FD7',
    accentTo: '#9BA8E8',
    sections: ['Hero', 'Trust Bar', 'Bundles', 'Steps', 'Stack Finder', 'Why Bundles', 'Quality', 'Testimonials', 'Products', 'FAQ', 'About', 'Contact'],
    bestFor: 'DTC & E-Commerce Brands',
  },
];

const GENERATING_STEPS = [
  { label: 'Analyzing your brand identity...', icon: Sparkles },
  { label: 'Generating page sections...', icon: Store },
  { label: 'Writing product-aware copy...', icon: MessageSquare },
  { label: 'Creating testimonials & FAQs...', icon: ShieldCheck },
  { label: 'Publishing your storefront...', icon: BarChart3 },
];

export function CreateStorefrontFlow() {
  const { data: brands, isLoading: brandsLoading } = useBrands();
  const generateMutation = useGenerateStorefront();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // Auto-select brand if only one exists
  const brand = brands?.items?.[0];
  const hasBrand = !!brand;

  // Animate through generating steps
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setGeneratingStep((prev) => {
        if (prev >= GENERATING_STEPS.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = (templateId: TemplateId) => {
    if (!brand) return;
    setSelectedTemplate(templateId);
    setIsGenerating(true);
    setGeneratingStep(0);

    generateMutation.mutate(
      { brandId: brand.id, template: templateId },
      {
        onSuccess: () => {
          setIsDone(true);
          setTimeout(() => window.location.reload(), 1500);
        },
        onError: () => {
          setIsGenerating(false);
          setGeneratingStep(0);
        },
      },
    );
  };

  // Loading state
  if (brandsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // No brand created yet
  if (!hasBrand) {
    return (
      <Card variant="elevated" className="max-w-lg mx-auto p-8 text-center border-accent/10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
          <Store className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2">Create a Brand First</h2>
        <p className="text-text-muted mb-6">
          You need a brand before we can build your storefront. Start the Brand Wizard to get going.
        </p>
        <a href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </a>
      </Card>
    );
  }

  // Generating state — full-screen animation
  if (isGenerating) {
    const selectedTpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto text-center"
      >
        <Card variant="elevated" className="p-10 border-accent/10 overflow-hidden relative">
          {/* Gradient accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(to right, ${selectedTpl?.accentFrom}, ${selectedTpl?.accentTo})` }}
          />

          {/* Pulsing icon */}
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: `linear-gradient(135deg, ${selectedTpl?.accentFrom}30, ${selectedTpl?.accentTo}15)` }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isDone ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="h-10 w-10 text-success" />
              </motion.div>
            ) : (
              <Sparkles className="h-10 w-10 text-accent" />
            )}
          </motion.div>

          <h2 className="text-2xl font-bold text-text mb-2">
            {isDone ? 'Your Store is Live!' : 'Building Your Storefront'}
          </h2>
          <p className="text-text-muted mb-8">
            {isDone
              ? `${brand.name}'s store is published and ready for visitors.`
              : `AI is generating a ${selectedTpl?.name} store for ${brand.name}...`
            }
          </p>

          {/* Step progress */}
          <div className="space-y-3 text-left max-w-sm mx-auto">
            {GENERATING_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === generatingStep && !isDone;
              const isComplete = i < generatingStep || isDone;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    'flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300',
                    isActive && 'bg-accent/5',
                    isComplete && 'opacity-100',
                    !isActive && !isComplete && 'opacity-40',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 shrink-0',
                    isComplete ? 'bg-success/15 text-success' : isActive ? 'bg-accent/15 text-accent' : 'bg-surface-elevated text-text-muted',
                  )}>
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium transition-colors',
                    isComplete ? 'text-text' : isActive ? 'text-text' : 'text-text-muted',
                  )}>
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Error state */}
          {generateMutation.isError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-sm text-error"
            >
              Something went wrong. Please try again.
            </motion.p>
          )}
        </Card>
      </motion.div>
    );
  }

  // Main state — template picker
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto w-full px-4"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-accent/20 to-accent/5 shadow-glow-accent mb-4"
        >
          <Sparkles className="h-8 w-8 text-accent" />
        </motion.div>
        <h1 className="text-3xl font-bold text-text mb-2">
          Build Your Store in One Click
        </h1>
        <p className="text-text-muted text-lg max-w-xl mx-auto">
          We'll use <strong className="text-text">{brand.name}</strong>'s brand identity, products, and colors to generate a complete storefront. Just pick a style.
        </p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <AnimatePresence>
          {TEMPLATES.map((tpl, i) => {
            const Icon = tpl.icon;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <button
                  type="button"
                  onClick={() => handleGenerate(tpl.id)}
                  disabled={isGenerating}
                  className={cn(
                    'w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden group',
                    'border-border/30 hover:border-accent/40 hover:shadow-xl',
                    'disabled:opacity-50 disabled:pointer-events-none',
                  )}
                >
                  {/* Gradient header */}
                  <div
                    className="h-24 flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${tpl.accentFrom}, ${tpl.accentTo})` }}
                  >
                    <Icon className="h-10 w-10 text-white/90 transition-transform duration-300 group-hover:scale-110" />
                    {/* Section count badge */}
                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {tpl.sections.length} sections
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-text mb-0.5">{tpl.name}</h3>
                    <p className="text-sm text-accent font-medium mb-2">{tpl.tagline}</p>
                    <p className="text-sm text-text-muted leading-relaxed mb-4">
                      {tpl.description}
                    </p>

                    {/* Section pills */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tpl.sections.slice(0, 6).map((s) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted font-medium">
                          {s}
                        </span>
                      ))}
                      {tpl.sections.length > 6 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted font-medium">
                          +{tpl.sections.length - 6} more
                        </span>
                      )}
                    </div>

                    {/* Best for label */}
                    <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-3">
                      Best for: {tpl.bestFor}
                    </p>

                    {/* CTA */}
                    <div
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all group-hover:shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${tpl.accentFrom}, ${tpl.accentTo})` }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate This Store
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-sm text-text-muted mt-8"
      >
        You can customize everything after generation. Sections, copy, images — all editable.
      </motion.p>
    </motion.div>
  );
}
