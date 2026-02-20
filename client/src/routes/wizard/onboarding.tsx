import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '@/lib/constants';
import { useWizardStore } from '@/stores/wizard-store';

/**
 * Wizard Step 1: Onboarding redirect.
 *
 * The onboarding welcome content has been merged into the social-analysis page,
 * so this route simply redirects there immediately.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const setStep = useWizardStore((s) => s.setStep);

  useEffect(() => {
    setStep('social-analysis');
    navigate(ROUTES.WIZARD_SOCIAL_ANALYSIS, { replace: true });
  }, [navigate, setStep]);

  return null;
}
