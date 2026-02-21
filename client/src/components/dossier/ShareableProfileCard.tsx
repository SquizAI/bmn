import { useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  BadgeCheck,
  Download,
  Share2,
  Target,
  Gauge,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DossierPdfExport from './DossierPdfExport';
import type {
  CreatorDossier,
  CreatorProfile,
  PlatformData,
  NicheDetection,
  BrandReadiness,
  AestheticProfile,
  Platform,
} from '@/lib/dossier-types';

interface ShareableProfileCardProps {
  profile: CreatorProfile;
  platforms: PlatformData[];
  niche: NicheDetection | null;
  readiness: BrandReadiness | null;
  aesthetic: AestheticProfile | null;
  /** Pass the full dossier to enable the "Download Full Report" PDF export button. */
  dossier?: CreatorDossier | null;
}

const platformIcons: Record<Platform, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5" />,
  tiktok: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.09V11.1a4.83 4.83 0 01-3.77-1.58V6.69z" />
    </svg>
  ),
  youtube: <Youtube className="h-3.5 w-3.5" />,
  twitter: <Twitter className="h-3.5 w-3.5" />,
  facebook: <Facebook className="h-3.5 w-3.5" />,
};

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const tierColors: Record<string, string> = {
  'prime': '#16a34a',
  'ready': '#B8956A',
  'emerging': '#d97706',
  'not-ready': '#dc2626',
};

export default function ShareableProfileCard({
  profile,
  platforms,
  niche,
  readiness,
  aesthetic,
  dossier,
}: ShareableProfileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      // Dynamic import to avoid bundling html2canvas if not used
      // Fallback: use SVG foreignObject approach
      const element = cardRef.current;
      const { width, height } = element.getBoundingClientRect();

      const canvas = document.createElement('canvas');
      const scale = 2; // 2x for retina
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clone and serialize to SVG foreignObject
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.opacity = '1';

      const serializer = new XMLSerializer();
      const html = serializer.serializeToString(clone);

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((b) => {
          if (!b) return;
          const downloadUrl = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${profile.displayName || 'creator'}-brand-card.png`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
        }, 'image/png');
      };

      img.src = url;
    } catch (err) {
      console.error('Failed to download card:', err);
    }
  }, [profile.displayName]);

  const handleShare = useCallback(async () => {
    const text = `Check out my Creator Brand Profile! ${profile.displayName || 'Creator'} - ${formatFollowers(profile.totalFollowers)} followers across ${platforms.length} platform${platforms.length > 1 ? 's' : ''}${niche ? ` | ${niche.primaryNiche.name}` : ''}${readiness ? ` | Brand Readiness: ${readiness.totalScore}/100` : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Creator Profile', text });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }, [profile, platforms, niche, readiness]);

  const palette = aesthetic?.naturalPalette || aesthetic?.dominantColors.map((c) => c.hex) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      {/* The shareable card */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] shadow-[var(--bmn-shadow-xl)]"
      >
        {/* Header gradient bar */}
        <div
          className="h-2"
          style={{
            background: palette.length >= 3
              ? `linear-gradient(to right, ${palette.slice(0, 4).join(', ')})`
              : 'linear-gradient(to right, var(--bmn-color-accent), var(--bmn-color-primary))',
          }}
        />

        <div className="p-5">
          {/* Profile row */}
          <div className="flex items-center gap-4">
            {profile.profilePicUrl ? (
              <img
                src={profile.profilePicUrl}
                alt={profile.displayName || 'Creator'}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--bmn-color-accent)] ring-offset-2 ring-offset-[var(--bmn-color-surface)]"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bmn-color-primary-light)] text-lg font-bold text-[var(--bmn-color-text)]">
                {(profile.displayName || '?')[0].toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-[var(--bmn-color-text)]">
                  {profile.displayName || 'Creator'}
                </h3>
                {profile.isVerified && (
                  <BadgeCheck className="h-4 w-4 text-[var(--bmn-color-info)]" />
                )}
              </div>
              <p className="text-sm text-[var(--bmn-color-text-muted)]">
                {formatFollowers(profile.totalFollowers)} total followers
              </p>
            </div>

            {/* Readiness badge */}
            {readiness && (
              <div
                className="flex h-12 w-12 flex-col items-center justify-center rounded-xl"
                style={{ backgroundColor: `${tierColors[readiness.tier]}15` }}
              >
                <span
                  className="text-lg font-bold"
                  style={{ color: tierColors[readiness.tier] }}
                >
                  {readiness.totalScore}
                </span>
                <span className="text-[8px] uppercase" style={{ color: tierColors[readiness.tier] }}>
                  Score
                </span>
              </div>
            )}
          </div>

          {/* Platform pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <div
                key={p.platform}
                className="flex items-center gap-1 rounded-full border border-[var(--bmn-color-border)] px-2.5 py-1 text-xs"
              >
                <span className="text-[var(--bmn-color-text-secondary)]">
                  {platformIcons[p.platform]}
                </span>
                <span className="font-medium text-[var(--bmn-color-text)]">
                  {formatFollowers(p.metrics.followers)}
                </span>
                {p.metrics.engagementRate !== null && (
                  <span className="text-[var(--bmn-color-text-muted)]">
                    {(p.metrics.engagementRate * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Info chips row */}
          <div className="mt-3 flex flex-wrap gap-2">
            {niche && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--bmn-color-accent-light)] px-2.5 py-1 text-xs font-medium text-[var(--bmn-color-accent)]">
                <Target className="h-3 w-3" />
                <span className="capitalize">{niche.primaryNiche.name}</span>
              </div>
            )}
            {aesthetic && aesthetic.visualMood.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--bmn-color-primary-light)] px-2.5 py-1 text-xs text-[var(--bmn-color-text-secondary)]">
                <Palette className="h-3 w-3" />
                {aesthetic.visualMood[0]}
              </div>
            )}
            {readiness && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--bmn-color-primary-light)] px-2.5 py-1 text-xs text-[var(--bmn-color-text-secondary)]">
                <Gauge className="h-3 w-3" />
                {readiness.tier === 'prime' ? 'Brand Prime' : readiness.tier === 'ready' ? 'Brand Ready' : readiness.tier === 'emerging' ? 'Emerging' : 'Building'}
              </div>
            )}
          </div>

          {/* Color palette strip */}
          {palette.length > 0 && (
            <div className="mt-3 flex gap-1">
              {palette.slice(0, 6).map((hex) => (
                <div
                  key={hex}
                  className="h-4 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          )}

          {/* Branding footer */}
          <div className="mt-3 flex items-center justify-between border-t border-[var(--bmn-color-border)] pt-2">
            <span className="text-xs text-[var(--bmn-color-text-muted)]">
              Created with Brand Me Now
            </span>
            <span className="text-xs font-medium text-[var(--bmn-color-accent)]">
              brandmenow.com
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="flex-1"
        >
          <Share2 className="mr-1.5 h-4 w-4" />
          Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="flex-1"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Download PNG
        </Button>
        {dossier && <DossierPdfExport dossier={dossier} />}
      </div>
    </motion.div>
  );
}
