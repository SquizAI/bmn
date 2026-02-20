import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  PartyPopper,
  Download,
  Share2,
  LayoutDashboard,
  Palette,
  Image as ImageIcon,
  Package,
  TrendingUp,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Confetti } from '@/components/confetti';
import { useWizardStore } from '@/stores/wizard-store';
import { ROUTES } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';

// ------ Component ------

export default function CompletionPage() {
  const navigate = useNavigate();
  const brand = useWizardStore((s) => s.brand);
  const design = useWizardStore((s) => s.design);
  const assets = useWizardStore((s) => s.assets);
  const products = useWizardStore((s) => s.products);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const reset = useWizardStore((s) => s.reset);
  const addToast = useUIStore((s) => s.addToast);

  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

  // Show confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/dashboard/brands/${brandId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast({ type: 'success', title: 'Link copied to clipboard!' });
    } catch {
      addToast({ type: 'error', title: 'Failed to copy link' });
    }
  };

  const handleDownloadAll = () => {
    // Trigger download via API
    if (brandId) {
      window.open(`/api/v1/brands/${brandId}/download`, '_blank');
    }
  };

  const handleGoToDashboard = () => {
    reset();
    navigate(ROUTES.DASHBOARD);
  };

  const approvedMockups = assets.mockups.filter((m) => m.status === 'approved').length;

  return (
    <>
      <Confetti active={showConfetti} particleCount={80} duration={5000} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8"
      >
        {/* Celebration header */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-success/10">
            <PartyPopper className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-3xl font-bold text-text">
            Congratulations!
          </h2>
          <p className="mt-2 text-lg text-text-secondary">
            Your brand <span className="font-semibold text-primary">{brand.name || 'Brand'}</span>{' '}
            has been created successfully.
          </p>
        </motion.div>

        {/* Brand Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-xl"
        >
          <Card variant="elevated" padding="lg">
            <CardTitle className="text-xl">Brand Summary</CardTitle>

            <div className="mt-6 space-y-4">
              {/* Brand Identity */}
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary-light p-2">
                  <Palette className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Brand Identity</p>
                  <p className="text-xs text-text-secondary">
                    {brand.archetype || 'Custom archetype'} -- {brand.values.length} core values
                  </p>
                </div>
              </div>

              {/* Color palette preview */}
              {design.colorPalette.length > 0 && (
                <div className="flex gap-1 pl-11">
                  {design.colorPalette.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full border border-border"
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}

              {/* Logo */}
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <ImageIcon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Logo</p>
                  <p className="text-xs text-text-secondary">
                    {assets.logos.length} generated, 1 selected
                  </p>
                </div>
              </div>

              {/* Products & Mockups */}
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <Package className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Products & Mockups</p>
                  <p className="text-xs text-text-secondary">
                    {products.selectedSkus.length} products -- {approvedMockups} mockups approved
                  </p>
                </div>
              </div>

              {/* Projections */}
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-info/10 p-2">
                  <TrendingUp className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Profit Projections</p>
                  <p className="text-xs text-text-secondary">
                    Revenue models calculated for all tiers
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex w-full max-w-xl flex-col gap-3"
        >
          {/* Primary: Download All */}
          <Button
            size="lg"
            onClick={handleDownloadAll}
            leftIcon={<Download className="h-5 w-5" />}
            fullWidth
          >
            Download All Assets
          </Button>

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              leftIcon={
                copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
              }
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${brand.name} - Brand Me Now`,
                    url: `${window.location.origin}/dashboard/brands/${brandId}`,
                  });
                } else {
                  handleCopyLink();
                }
              }}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              Share
            </Button>
          </div>

          {/* Go to Dashboard */}
          <Button
            variant="secondary"
            size="lg"
            onClick={handleGoToDashboard}
            leftIcon={<LayoutDashboard className="h-5 w-5" />}
            fullWidth
          >
            Go to Dashboard
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
}
