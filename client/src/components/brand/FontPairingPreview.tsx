import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Instagram as InstagramIcon, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface FontPairingPreviewProps {
  headingFont: string;
  bodyFont: string;
  brandName?: string | null;
  primaryColor?: string;
  accentColor?: string;
}

type PreviewContext = 'business-card' | 'social-post' | 'product-label';

// ── Google Fonts Loader ──────────────────────────────────────────

function useGoogleFont(fontFamily: string) {
  useEffect(() => {
    if (!fontFamily) return;
    const encoded = fontFamily.replace(/\s+/g, '+');
    const linkId = `gfont-${encoded}`;

    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);
}

// ── Preview Tab Button ───────────────────────────────────────────

function PreviewTab({
  context,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  context: PreviewContext;
  label: string;
  icon: typeof CreditCard;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-transparent text-text-secondary hover:bg-surface-hover',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Business Card Preview ────────────────────────────────────────

function BusinessCardPreview({
  headingFont,
  bodyFont,
  brandName,
  primaryColor,
}: {
  headingFont: string;
  bodyFont: string;
  brandName: string;
  primaryColor: string;
}) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div
        className="relative aspect-[1.75/1] rounded-xl border border-border p-6 shadow-md overflow-hidden"
        style={{ backgroundColor: '#fafafa' }}
      >
        {/* Accent bar */}
        <div
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ backgroundColor: primaryColor }}
        />

        <div className="flex h-full flex-col justify-between pl-4">
          <div>
            <h4
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: `'${headingFont}', sans-serif`, color: '#111' }}
            >
              {brandName}
            </h4>
            <p
              className="mt-0.5 text-xs"
              style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#666' }}
            >
              Founder & Creative Director
            </p>
          </div>

          <div>
            <p
              className="text-xs"
              style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#888' }}
            >
              hello@{brandName.toLowerCase().replace(/\s+/g, '')}.com
            </p>
            <p
              className="text-xs"
              style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#888' }}
            >
              @{brandName.toLowerCase().replace(/\s+/g, '')}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">Business Card</p>
    </div>
  );
}

// ── Social Post Preview ──────────────────────────────────────────

function SocialPostPreview({
  headingFont,
  bodyFont,
  brandName,
  primaryColor,
  accentColor,
}: {
  headingFont: string;
  bodyFont: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
}) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-xl border border-border overflow-hidden shadow-md">
        {/* Post image area */}
        <div
          className="relative flex aspect-square items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${accentColor}22)` }}
        >
          <div className="text-center px-6">
            <h4
              className="text-2xl font-bold leading-tight"
              style={{ fontFamily: `'${headingFont}', sans-serif`, color: primaryColor }}
            >
              New Collection
            </h4>
            <p
              className="mt-2 text-sm"
              style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#555' }}
            >
              Crafted with intention.
              <br />
              Built to last.
            </p>
          </div>
        </div>

        {/* Post footer */}
        <div className="bg-surface p-3">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            <span
              className="text-xs font-semibold text-text"
              style={{ fontFamily: `'${bodyFont}', sans-serif` }}
            >
              {brandName.toLowerCase().replace(/\s+/g, '')}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">Social Media Post</p>
    </div>
  );
}

// ── Product Label Preview ────────────────────────────────────────

function ProductLabelPreview({
  headingFont,
  bodyFont,
  brandName,
  primaryColor,
  accentColor,
}: {
  headingFont: string;
  bodyFont: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xs">
      <div
        className="relative rounded-xl border border-border p-6 text-center shadow-md"
        style={{ backgroundColor: '#fefefe' }}
      >
        {/* Top accent line */}
        <div
          className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-full"
          style={{ backgroundColor: accentColor }}
        />

        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#999' }}
        >
          Premium Quality
        </p>

        <h4
          className="mt-3 text-lg font-bold tracking-tight"
          style={{ fontFamily: `'${headingFont}', sans-serif`, color: primaryColor }}
        >
          {brandName}
        </h4>

        <div
          className="mx-auto mt-2 h-px w-12"
          style={{ backgroundColor: accentColor }}
        />

        <p
          className="mt-2 text-xs"
          style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#666' }}
        >
          Daily Essentials Blend
        </p>

        <p
          className="mt-3 text-[10px]"
          style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#aaa' }}
        >
          Net Wt. 90 capsules / 30 servings
        </p>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">Product Label</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function FontPairingPreview({
  headingFont,
  bodyFont,
  brandName,
  primaryColor = '#111111',
  accentColor = '#B8956A',
}: FontPairingPreviewProps) {
  const [activeContext, setActiveContext] = useState<PreviewContext>('business-card');
  const name = brandName || 'Brand Name';

  useGoogleFont(headingFont);
  useGoogleFont(bodyFont);

  const tabs: Array<{ key: PreviewContext; label: string; icon: typeof CreditCard }> = [
    { key: 'business-card', label: 'Business Card', icon: CreditCard },
    { key: 'social-post', label: 'Social Post', icon: InstagramIcon },
    { key: 'product-label', label: 'Product Label', icon: Tag },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-bold text-text">Font Pairing Preview</h3>
        <p className="mt-1 text-xs text-text-muted">
          <span className="font-medium">{headingFont}</span> (headings) +{' '}
          <span className="font-medium">{bodyFont}</span> (body)
        </p>
      </div>

      {/* Context tabs */}
      <div className="flex gap-1 border-b border-border px-4 py-2 bg-surface-hover/50">
        {tabs.map((tab) => (
          <PreviewTab
            key={tab.key}
            context={tab.key}
            label={tab.label}
            icon={tab.icon}
            active={activeContext === tab.key}
            onClick={() => setActiveContext(tab.key)}
          />
        ))}
      </div>

      {/* Preview */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeContext}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {activeContext === 'business-card' && (
              <BusinessCardPreview
                headingFont={headingFont}
                bodyFont={bodyFont}
                brandName={name}
                primaryColor={primaryColor}
              />
            )}
            {activeContext === 'social-post' && (
              <SocialPostPreview
                headingFont={headingFont}
                bodyFont={bodyFont}
                brandName={name}
                primaryColor={primaryColor}
                accentColor={accentColor}
              />
            )}
            {activeContext === 'product-label' && (
              <ProductLabelPreview
                headingFont={headingFont}
                bodyFont={bodyFont}
                brandName={name}
                primaryColor={primaryColor}
                accentColor={accentColor}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
