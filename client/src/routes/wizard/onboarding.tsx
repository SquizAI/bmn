import { useNavigate } from 'react-router';
import { ArrowRight, Sparkles, Palette, Package, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';
import { useWizardStore } from '@/stores/wizard-store';

const features = [
  {
    icon: <Sparkles className="h-6 w-6 text-primary" />,
    title: 'AI Brand Identity',
    description: 'Generate a complete brand vision, values, and archetype from your social presence.',
  },
  {
    icon: <Palette className="h-6 w-6 text-accent" />,
    title: 'Logo & Design',
    description: 'Create stunning logos and visual identity with AI-powered design tools.',
  },
  {
    icon: <Package className="h-6 w-6 text-success" />,
    title: 'Product Mockups',
    description: 'See your brand on real products with photorealistic mockup generation.',
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-info" />,
    title: 'Revenue Projections',
    description: 'Get data-driven profit calculations and pricing recommendations.',
  },
];

/**
 * Wizard Step 1: Welcome / Onboarding page.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const setStep = useWizardStore((s) => s.setStep);

  const handleStart = () => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS);
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-text md:text-5xl">
          Build Your Brand
          <br />
          <span className="text-primary">in Minutes</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-text-secondary">
          Our AI wizard transforms your social media presence into a complete, sellable brand --
          identity, logos, product mockups, and revenue projections.
        </p>
      </div>

      {/* Feature cards */}
      <div className="mb-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title} variant="outlined" padding="md">
            <CardContent>
              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 rounded-lg bg-surface-hover p-2">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-text">{feature.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <Button
        size="lg"
        onClick={handleStart}
        rightIcon={<ArrowRight className="h-5 w-5" />}
      >
        Get Started
      </Button>

      <p className="mt-4 text-xs text-text-muted">
        Takes about 10-15 minutes. You can save and resume anytime.
      </p>
    </div>
  );
}
