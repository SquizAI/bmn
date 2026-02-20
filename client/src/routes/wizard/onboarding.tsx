import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { useWizardStore } from '@/stores/wizard-store';

const steps = [
  { number: '01', title: 'Analyze', desc: 'We scan your social presence for themes, aesthetics, and audience.' },
  { number: '02', title: 'Design', desc: 'AI generates your brand identity — name, colors, typography, logo.' },
  { number: '03', title: 'Produce', desc: 'See your brand on real products with photorealistic mockups.' },
  { number: '04', title: 'Launch', desc: 'Get revenue projections and your full brand kit, ready to sell.' },
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
    <div className="flex flex-col items-center">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[#B8956A]" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-text-muted">
            AI-Powered Brand Studio
          </span>
        </div>

        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text md:text-5xl lg:text-6xl">
          Your brand,
          <br />
          built in minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-text-muted">
          From social media presence to a complete brand identity —
          logo, products, and revenue projections.
        </p>
      </motion.div>

      {/* Steps — editorial timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mb-16 grid w-full max-w-2xl grid-cols-1 gap-0 sm:grid-cols-2"
      >
        {steps.map((step) => (
          <div
            key={step.number}
            className="group relative border-b border-border p-6 sm:border-r sm:last:border-r-0 sm:nth-2:border-r-0 sm:nth-3:border-b-0 sm:nth-4:border-b-0"
          >
            <span className="mb-3 block font-mono text-[11px] text-text-muted">
              {step.number}
            </span>
            <h3 className="text-base font-semibold tracking-tight text-text">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
              {step.desc}
            </p>
            {/* Hover accent line */}
            <div className="absolute bottom-0 left-0 h-px w-0 bg-[#B8956A] transition-all duration-300 group-hover:w-full sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-0 sm:w-px group-hover:sm:h-full group-hover:sm:w-px" />
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex flex-col items-center gap-3"
      >
        <Button
          size="lg"
          onClick={handleStart}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Get Started
        </Button>
        <p className="text-[11px] text-text-muted">
          Takes about 10 minutes &middot; Save and resume anytime
        </p>
      </motion.div>
    </div>
  );
}
