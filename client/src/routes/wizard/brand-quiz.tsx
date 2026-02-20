import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWizardStore } from '@/stores/wizard-store';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ── Quiz Data ───────────────────────────────────────────────────

interface VibeOption {
  id: string;
  emoji: string;
  label: string;
  archetype: string;
  aesthetic: string;
}

interface AudienceOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
  value: string;
}

interface WordOption {
  id: string;
  label: string;
}

interface ProductOption {
  id: string;
  emoji: string;
  label: string;
  niche: string;
}

interface ColorPaletteOption {
  id: string;
  label: string;
  colors: [string, string, string];
}

const VIBE_OPTIONS: VibeOption[] = [
  { id: 'minimal', emoji: '\u2728', label: 'Minimal & Clean', archetype: 'The Sage', aesthetic: 'minimalist' },
  { id: 'bold', emoji: '\u26a1', label: 'Bold & Energetic', archetype: 'The Hero', aesthetic: 'bold' },
  { id: 'warm', emoji: '\u2615', label: 'Warm & Cozy', archetype: 'The Caregiver', aesthetic: 'warm' },
  { id: 'luxury', emoji: '\ud83d\udc8e', label: 'Luxury & Premium', archetype: 'The Ruler', aesthetic: 'luxury' },
  { id: 'fun', emoji: '\ud83c\udf89', label: 'Fun & Playful', archetype: 'The Jester', aesthetic: 'playful' },
  { id: 'earthy', emoji: '\ud83c\udf3f', label: 'Earthy & Natural', archetype: 'The Explorer', aesthetic: 'organic' },
];

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { id: 'young-professionals', emoji: '\ud83d\udcbc', label: 'Young Professionals', description: 'Ages 25-34, career-driven and style-conscious', value: 'Young professionals aged 25-34 who are career-driven and style-conscious' },
  { id: 'health-parents', emoji: '\ud83d\udc6a', label: 'Health-Conscious Parents', description: 'Family-focused, seeking quality and wellness', value: 'Health-conscious parents who prioritize quality, wellness, and family' },
  { id: 'fitness', emoji: '\ud83d\udcaa', label: 'Fitness Enthusiasts', description: 'Active lifestyle, performance-driven', value: 'Fitness enthusiasts with active lifestyles who value performance and results' },
  { id: 'wellness', emoji: '\ud83e\uddd8', label: 'Wellness Seekers', description: 'Mindful, holistic health-oriented', value: 'Wellness seekers focused on mindful living and holistic health' },
];

const WORD_OPTIONS: WordOption[] = [
  { id: 'trustworthy', label: 'Trustworthy' },
  { id: 'innovative', label: 'Innovative' },
  { id: 'authentic', label: 'Authentic' },
  { id: 'premium', label: 'Premium' },
  { id: 'approachable', label: 'Approachable' },
  { id: 'bold', label: 'Bold' },
  { id: 'sustainable', label: 'Sustainable' },
  { id: 'luxurious', label: 'Luxurious' },
  { id: 'fun', label: 'Fun' },
  { id: 'empowering', label: 'Empowering' },
  { id: 'calm', label: 'Calm' },
  { id: 'energetic', label: 'Energetic' },
];

const PRODUCT_OPTIONS: ProductOption[] = [
  { id: 'supplements', emoji: '\ud83d\udc8a', label: 'Supplements & Nutrition', niche: 'Health & Nutrition' },
  { id: 'apparel', emoji: '\ud83d\udc55', label: 'Apparel & Activewear', niche: 'Fashion & Activewear' },
  { id: 'skincare', emoji: '\u2728', label: 'Skincare & Beauty', niche: 'Beauty & Skincare' },
  { id: 'digital', emoji: '\ud83d\udcf1', label: 'Digital Products', niche: 'Digital Products & Courses' },
  { id: 'home', emoji: '\ud83c\udfe1', label: 'Home & Lifestyle', niche: 'Home & Lifestyle' },
  { id: 'accessories', emoji: '\ud83d\udc5c', label: 'Accessories', niche: 'Accessories & Merchandise' },
];

const COLOR_PALETTE_OPTIONS: ColorPaletteOption[] = [
  { id: 'deep-ocean', label: 'Deep Ocean', colors: ['#1a365d', '#2b6cb0', '#63b3ed'] },
  { id: 'forest', label: 'Forest', colors: ['#2d3748', '#38a169', '#68d391'] },
  { id: 'sunset', label: 'Sunset', colors: ['#744210', '#dd6b20', '#fbd38d'] },
  { id: 'berry', label: 'Berry', colors: ['#553c9a', '#9f7aea', '#d6bcfa'] },
  { id: 'rose-gold', label: 'Rose Gold', colors: ['#97266d', '#ed64a6', '#fed7e2'] },
  { id: 'earth', label: 'Earth', colors: ['#7b341e', '#c05621', '#fbd38d'] },
  { id: 'midnight', label: 'Midnight', colors: ['#1a202c', '#4a5568', '#a0aec0'] },
  { id: 'coral', label: 'Coral', colors: ['#c53030', '#fc8181', '#fff5f5'] },
];

// ── Quiz Answers State ──────────────────────────────────────────

interface QuizAnswers {
  vibe: string | null;
  audience: string | null;
  words: string[];
  product: string | null;
  colors: string[];
}

// ── Mapping helpers ─────────────────────────────────────────────

function mapQuizToDossier(answers: QuizAnswers) {
  const audience = AUDIENCE_OPTIONS.find((a) => a.id === answers.audience);
  const product = PRODUCT_OPTIONS.find((p) => p.id === answers.product);
  const selectedWords = answers.words
    .map((wId) => WORD_OPTIONS.find((w) => w.id === wId)?.label)
    .filter(Boolean) as string[];

  return {
    niche: {
      primary: product?.niche ?? null,
      secondary: selectedWords.slice(0, 2),
      confidence: 0.85,
      marketSize: null,
    },
    contentThemes: selectedWords,
    feedColors: answers.colors.flatMap((cId) => {
      const palette = COLOR_PALETTE_OPTIONS.find((c) => c.id === cId);
      return palette ? [...palette.colors] : [];
    }),
    audienceDemo: audience
      ? { segment: audience.label, description: audience.description }
      : null,
  };
}

function mapQuizToBrand(answers: QuizAnswers) {
  const vibe = VIBE_OPTIONS.find((v) => v.id === answers.vibe);
  const audience = AUDIENCE_OPTIONS.find((a) => a.id === answers.audience);
  const selectedWords = answers.words
    .map((wId) => WORD_OPTIONS.find((w) => w.id === wId)?.label)
    .filter(Boolean) as string[];

  return {
    archetype: vibe?.archetype ?? null,
    values: selectedWords,
    targetAudience: audience?.value ?? null,
  };
}

// ── Slide transition variants ───────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ── Component ───────────────────────────────────────────────────

const TOTAL_QUESTIONS = 5;

export default function BrandQuizPage() {
  const navigate = useNavigate();
  const setDossier = useWizardStore((s) => s.setDossier);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setStep = useWizardStore((s) => s.setStep);

  const [step, setQuizStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({
    vibe: null,
    audience: null,
    words: [],
    product: null,
    colors: [],
  });

  // ── Navigation ────────────────────────────────────────────────

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 0: return answers.vibe !== null;
      case 1: return answers.audience !== null;
      case 2: return answers.words.length === 3;
      case 3: return answers.product !== null;
      case 4: return answers.colors.length >= 2 && answers.colors.length <= 3;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (!canAdvance()) return;

    if (step === TOTAL_QUESTIONS - 1) {
      // Quiz complete -- map answers to store data
      const dossierData = mapQuizToDossier(answers);
      const brandData = mapQuizToBrand(answers);

      setDossier(dossierData);
      setBrand(brandData);
      setStep('brand-name');
      navigate(ROUTES.WIZARD_BRAND_NAME);
      return;
    }

    setDirection(1);
    setQuizStep((s) => s + 1);
  }, [step, canAdvance, answers, setDossier, setBrand, setStep, navigate]);

  const handleBack = useCallback(() => {
    if (step === 0) {
      navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
      return;
    }
    setDirection(-1);
    setQuizStep((s) => s - 1);
  }, [step, navigate]);

  // ── Answer handlers ───────────────────────────────────────────

  const selectVibe = useCallback((id: string) => {
    setAnswers((prev) => ({ ...prev, vibe: id }));
  }, []);

  const selectAudience = useCallback((id: string) => {
    setAnswers((prev) => ({ ...prev, audience: id }));
  }, []);

  const toggleWord = useCallback((id: string) => {
    setAnswers((prev) => {
      const isSelected = prev.words.includes(id);
      if (isSelected) {
        return { ...prev, words: prev.words.filter((w) => w !== id) };
      }
      if (prev.words.length >= 3) return prev;
      return { ...prev, words: [...prev.words, id] };
    });
  }, []);

  const selectProduct = useCallback((id: string) => {
    setAnswers((prev) => ({ ...prev, product: id }));
  }, []);

  const toggleColor = useCallback((id: string) => {
    setAnswers((prev) => {
      const isSelected = prev.colors.includes(id);
      if (isSelected) {
        return { ...prev, colors: prev.colors.filter((c) => c !== id) };
      }
      if (prev.colors.length >= 3) return prev;
      return { ...prev, colors: [...prev.colors, id] };
    });
  }, []);

  // ── Render helpers ────────────────────────────────────────────

  const renderQuestion = () => {
    switch (step) {
      case 0:
        return (
          <QuestionVibe selected={answers.vibe} onSelect={selectVibe} />
        );
      case 1:
        return (
          <QuestionAudience selected={answers.audience} onSelect={selectAudience} />
        );
      case 2:
        return (
          <QuestionWords selected={answers.words} onToggle={toggleWord} />
        );
      case 3:
        return (
          <QuestionProduct selected={answers.product} onSelect={selectProduct} />
        );
      case 4:
        return (
          <QuestionColors selected={answers.colors} onToggle={toggleColor} />
        );
      default:
        return null;
    }
  };

  const questionTitles = [
    "What's your vibe?",
    'Who is your dream customer?',
    'Pick 3 words that describe your ideal brand',
    'What type of products interest you most?',
    'What colors speak to you?',
  ];

  const questionSubtitles = [
    'Choose the mood that resonates with your brand vision.',
    'Select the audience you want to connect with most.',
    'These will shape your brand personality and voice.',
    'This helps us recommend the right product categories.',
    'Pick 2-3 palettes that feel right for your brand.',
  ];

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
        <h2 className="text-2xl font-bold text-text">Brand Personality Quiz</h2>
        <p className="mt-2 max-w-lg mx-auto text-text-secondary">
          Answer 5 quick questions to build your brand profile.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mx-auto w-full max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>Question {step + 1} of {TOTAL_QUESTIONS}</span>
          <span>{Math.round(((step + 1) / TOTAL_QUESTIONS) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / TOTAL_QUESTIONS) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Question content */}
      <div className="min-h-[420px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex flex-col gap-6"
          >
            {/* Question title */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-text">
                {questionTitles[step]}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {questionSubtitles[step]}
              </p>
            </div>

            {/* Question body */}
            {renderQuestion()}
          </motion.div>
        </AnimatePresence>
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
          onClick={handleNext}
          disabled={!canAdvance()}
          rightIcon={
            step === TOTAL_QUESTIONS - 1 ? (
              <Sparkles className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )
          }
          className="flex-1"
        >
          {step === TOTAL_QUESTIONS - 1 ? 'Build My Brand' : 'Next'}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Q1: Vibe ────────────────────────────────────────────────────

function QuestionVibe({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {VIBE_OPTIONS.map((option) => (
        <Card
          key={option.id}
          variant="interactive"
          padding="md"
          className={cn(
            'flex flex-col items-center gap-3 text-center transition-all duration-200',
            selected === option.id
              ? 'border-primary bg-primary-light ring-2 ring-primary/30'
              : 'hover:border-border-hover',
          )}
          onClick={() => onSelect(option.id)}
        >
          <span className="text-3xl">{option.emoji}</span>
          <span className="text-sm font-medium text-text">{option.label}</span>
          {selected === option.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Q2: Audience ────────────────────────────────────────────────

function QuestionAudience({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {AUDIENCE_OPTIONS.map((option) => (
        <Card
          key={option.id}
          variant="interactive"
          padding="md"
          className={cn(
            'flex items-start gap-4 transition-all duration-200',
            selected === option.id
              ? 'border-primary bg-primary-light ring-2 ring-primary/30'
              : 'hover:border-border-hover',
          )}
          onClick={() => onSelect(option.id)}
        >
          <span className="mt-0.5 text-2xl">{option.emoji}</span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-text">{option.label}</span>
            <span className="text-xs text-text-secondary">{option.description}</span>
          </div>
          {selected === option.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Q3: Words (multi-select, max 3) ────────────────────────────

function QuestionWords({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        {WORD_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id);
          const isDisabled = !isSelected && selected.length >= 3;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(option.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isDisabled
                    ? 'cursor-not-allowed border-border bg-surface text-text-muted opacity-50'
                    : 'border-border bg-surface text-text hover:border-border-hover hover:bg-surface-hover',
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">
        {selected.length}/3 selected
      </p>
    </div>
  );
}

// ── Q4: Products ────────────────────────────────────────────────

function QuestionProduct({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PRODUCT_OPTIONS.map((option) => (
        <Card
          key={option.id}
          variant="interactive"
          padding="md"
          className={cn(
            'flex flex-col items-center gap-3 text-center transition-all duration-200',
            selected === option.id
              ? 'border-primary bg-primary-light ring-2 ring-primary/30'
              : 'hover:border-border-hover',
          )}
          onClick={() => onSelect(option.id)}
        >
          <span className="text-3xl">{option.emoji}</span>
          <span className="text-sm font-medium text-text">{option.label}</span>
          {selected === option.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Q5: Colors (multi-select, 2-3) ─────────────────────────────

function QuestionColors({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COLOR_PALETTE_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id);
          const isDisabled = !isSelected && selected.length >= 3;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(option.id)}
              className={cn(
                'group flex flex-col items-center gap-2 rounded-lg border p-4 transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isSelected
                  ? 'border-primary bg-primary-light ring-2 ring-primary/30'
                  : isDisabled
                    ? 'cursor-not-allowed border-border opacity-50'
                    : 'border-border hover:border-border-hover hover:bg-surface-hover',
              )}
            >
              {/* Color swatch */}
              <div className="flex h-10 w-full overflow-hidden rounded-md">
                {option.colors.map((color, i) => (
                  <div
                    key={i}
                    className="h-full flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-text">{option.label}</span>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">
        {selected.length}/3 selected (pick 2-3)
      </p>
    </div>
  );
}
