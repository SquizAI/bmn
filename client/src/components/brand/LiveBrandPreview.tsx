import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Tag, Instagram as InstagramIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface LiveBrandPreviewProps {
  brandName: string;
  archetype: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  values: string[];
}

type PreviewMode = 'product-label' | 'social-post';

// ── Google Fonts Loader ──────────────────────────────────────────

function useGoogleFont(fontFamily: string) {
  useEffect(() => {
    if (!fontFamily) return;
    const encoded = fontFamily.replace(/\s+/g, '+');
    const linkId = `gfont-live-${encoded}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);
}

// ── Determine readable text color on a given background ─────────

function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a2e' : '#ffffff';
}

// ── Product Label Preview ────────────────────────────────────────

function ProductLabelLive({
  brandName,
  primaryColor,
  accentColor,
  headingFont,
  bodyFont,
  values,
}: Omit<LiveBrandPreviewProps, 'archetype' | 'backgroundColor' | 'textColor'>) {
  return (
    <div
      className="relative rounded-xl border border-border p-5 text-center shadow-sm overflow-hidden"
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
        className="mt-2 text-lg font-bold tracking-tight"
        style={{ fontFamily: `'${headingFont}', sans-serif`, color: primaryColor }}
      >
        {brandName || 'Brand Name'}
      </h4>

      <div
        className="mx-auto mt-2 h-px w-10"
        style={{ backgroundColor: accentColor }}
      />

      <p
        className="mt-2 text-xs"
        style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#666' }}
      >
        Daily Essentials Blend
      </p>

      {values.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {values.slice(0, 3).map((v) => (
            <span
              key={v}
              className="rounded-full px-2 py-0.5 text-[8px] font-medium uppercase tracking-wide"
              style={{
                backgroundColor: `${primaryColor}15`,
                color: primaryColor,
              }}
            >
              {v}
            </span>
          ))}
        </div>
      )}

      <p
        className="mt-3 text-[10px]"
        style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#aaa' }}
      >
        Net Wt. 90 capsules
      </p>
    </div>
  );
}

// ── Social Post Preview ──────────────────────────────────────────

function SocialPostLive({
  brandName,
  primaryColor,
  accentColor,
  headingFont,
  bodyFont,
}: Omit<LiveBrandPreviewProps, 'archetype' | 'backgroundColor' | 'textColor' | 'values'>) {
  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Post image area */}
      <div
        className="relative flex aspect-[4/3] items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${primaryColor}18, ${accentColor}18)` }}
      >
        <div className="text-center px-4">
          <h4
            className="text-xl font-bold leading-tight"
            style={{ fontFamily: `'${headingFont}', sans-serif`, color: primaryColor }}
          >
            New Collection
          </h4>
          <p
            className="mt-1.5 text-xs"
            style={{ fontFamily: `'${bodyFont}', sans-serif`, color: '#555' }}
          >
            Crafted with intention.
          </p>
        </div>
      </div>

      {/* Post footer */}
      <div className="bg-surface p-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <span
            className="text-[11px] font-semibold text-text"
            style={{ fontFamily: `'${bodyFont}', sans-serif` }}
          >
            {(brandName || 'brand').toLowerCase().replace(/\s+/g, '')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function LiveBrandPreview({
  brandName,
  archetype,
  primaryColor,
  accentColor,
  backgroundColor,
  textColor,
  headingFont,
  bodyFont,
  values,
}: LiveBrandPreviewProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('product-label');

  useGoogleFont(headingFont);
  useGoogleFont(bodyFont);

  const safePrimary = primaryColor || '#6366f1';
  const safeAccent = accentColor || '#B8956A';

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-text">Live Preview</h3>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPreviewMode('product-label')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                previewMode === 'product-label'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-text-secondary hover:bg-surface-hover',
              )}
            >
              <Tag className="h-3 w-3" />
              Label
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('social-post')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                previewMode === 'social-post'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-text-secondary hover:bg-surface-hover',
              )}
            >
              <InstagramIcon className="h-3 w-3" />
              Post
            </button>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          Updates in real-time as you edit
        </p>
      </div>

      {/* Preview area */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={previewMode}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {previewMode === 'product-label' && (
              <ProductLabelLive
                brandName={brandName}
                primaryColor={safePrimary}
                accentColor={safeAccent}
                headingFont={headingFont}
                bodyFont={bodyFont}
                values={values}
              />
            )}
            {previewMode === 'social-post' && (
              <SocialPostLive
                brandName={brandName}
                primaryColor={safePrimary}
                accentColor={safeAccent}
                headingFont={headingFont}
                bodyFont={bodyFont}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Brand identity summary */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded"
              style={{ backgroundColor: safePrimary }}
            />
            <div
              className="h-4 w-4 rounded"
              style={{ backgroundColor: safeAccent }}
            />
            {backgroundColor && (
              <div
                className="h-4 w-4 rounded border border-border"
                style={{ backgroundColor }}
              />
            )}
            <span className="ml-auto text-[10px] text-text-muted">
              {headingFont} + {bodyFont}
            </span>
          </div>
          {archetype && (
            <p className="text-[10px] text-text-muted">
              Archetype: <span className="font-medium text-text-secondary">{archetype}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
