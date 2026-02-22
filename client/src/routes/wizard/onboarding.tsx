import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ScanSearch,
  Sparkles,
  Palette,
  Package,
  TrendingUp,
  ArrowRight,
  Instagram,
  PencilRuler,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/stores/wizard-store';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const EXPECTATIONS = [
  {
    icon: ScanSearch,
    title: 'Analyze your presence',
    description: 'We scan your social media for themes, audience, and aesthetic.',
  },
  {
    icon: Palette,
    title: 'Design your identity',
    description: 'AI generates your brand name, colors, typography, and logo.',
  },
  {
    icon: Package,
    title: 'Create product mockups',
    description: 'See your brand on real products with photorealistic mockups.',
  },
  {
    icon: TrendingUp,
    title: 'Project your revenue',
    description: 'Get revenue estimates and your full brand kit, ready to sell.',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setStep = useWizardStore((s) => s.setStep);

  const handleSocialPath = () => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
  };

  const handleQuizPath = () => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_BRAND_QUIZ);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-10"
    >
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-accent"
        >
          <Sparkles className="h-8 w-8 text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold tracking-tight text-text">
          Let's Build Your Brand
        </h1>
        <p className="mt-3 max-w-lg mx-auto text-text-secondary">
          In just a few minutes, AI will create your complete brand identity
          — name, logo, colors, products, and revenue projections.
        </p>
      </div>

      {/* Two-path choice */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            variant="interactive"
            padding="lg"
            className={cn(
              'flex flex-col items-center gap-4 text-center',
              'border-primary/20 hover:border-primary hover:bg-primary-light transition-all duration-200',
              'cursor-pointer',
            )}
            onClick={handleSocialPath}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Instagram className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">I have social media</h3>
              <p className="mt-1 text-sm text-text-secondary">
                We'll analyze your content to build a brand that matches your audience.
              </p>
            </div>
            <Button
              size="sm"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="mt-auto"
            >
              Start with socials
            </Button>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card
            variant="interactive"
            padding="lg"
            className={cn(
              'flex flex-col items-center gap-4 text-center',
              'border-accent/20 hover:border-accent hover:bg-accent-light transition-all duration-200',
              'cursor-pointer',
            )}
            onClick={handleQuizPath}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <PencilRuler className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">I don't have social media</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Take a quick quiz and we'll build your brand from your vision and style.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="mt-auto"
            >
              Take the quiz
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* What to expect */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-2xl"
      >
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-text-muted">
          What to expect
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPECTATIONS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-text">{item.title}</span>
              <span className="text-[11px] leading-tight text-text-muted">
                {item.description}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
