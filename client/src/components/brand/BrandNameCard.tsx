import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Globe,
  Instagram,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NameSuggestion } from '@/hooks/use-name-generation';

// ── Availability Badge ─────────────────────────────────────────

type AvailabilityStatus = 'available' | 'taken' | 'unchecked';

function AvailabilityDot({ status }: { status: AvailabilityStatus }) {
  const colors: Record<AvailabilityStatus, string> = {
    available: 'bg-success',
    taken: 'bg-error',
    unchecked: 'bg-text-muted',
  };

  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', colors[status])}
      title={status}
    />
  );
}

// ── Trademark Risk Badge ───────────────────────────────────────

function TrademarkBadge({ risk }: { risk: string }) {
  const config: Record<string, { icon: typeof ShieldCheck; label: string; className: string }> = {
    low: { icon: ShieldCheck, label: 'Low Risk', className: 'text-success bg-success-bg border-success-border' },
    medium: { icon: ShieldAlert, label: 'Medium Risk', className: 'text-warning bg-warning-bg border-warning-border' },
    high: { icon: Shield, label: 'High Risk', className: 'text-error bg-error-bg border-error-border' },
    unchecked: { icon: ShieldQuestion, label: 'Unchecked', className: 'text-text-muted bg-surface border-border' },
  };

  const { icon: Icon, label, className } = config[risk] || config.unchecked;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Social Handle Row ──────────────────────────────────────────

function SocialHandleRow({
  platform,
  handle,
  status,
}: {
  platform: string;
  handle: string;
  status: AvailabilityStatus;
}) {
  const icons: Record<string, typeof Instagram> = {
    instagram: Instagram,
    tiktok: Globe,
    youtube: Globe,
  };
  const Icon = icons[platform] || Globe;
  const labels: Record<string, string> = {
    instagram: '@',
    tiktok: '@',
    youtube: '@',
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 text-text-secondary">
        <Icon className="h-3 w-3" />
        <span>{labels[platform]}{handle}</span>
      </div>
      <div className="flex items-center gap-1">
        <AvailabilityDot status={status} />
        <span className={cn(
          'text-xs',
          status === 'available' ? 'text-success' : status === 'taken' ? 'text-error' : 'text-text-muted',
        )}>
          {status === 'available' ? 'Available' : status === 'taken' ? 'Taken' : 'Unknown'}
        </span>
      </div>
    </div>
  );
}

// ── Main BrandNameCard ─────────────────────────────────────────

interface BrandNameCardProps {
  suggestion: NameSuggestion;
  selected: boolean;
  onSelect: () => void;
  rank: number;
  isTopRecommendation: boolean;
}

export function BrandNameCard({
  suggestion,
  selected,
  onSelect,
  rank,
  isTopRecommendation,
}: BrandNameCardProps) {
  const [expanded, setExpanded] = useState(false);

  const cleanHandle = suggestion.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const domainBest = suggestion.domain.bestAvailable;
  const comAvailable = suggestion.domain.com === 'available';

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.3 }}
      className={cn(
        'group relative w-full rounded-xl border-2 p-5 text-left transition-all duration-200',
        'hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'border-primary bg-primary-light shadow-md'
          : 'border-border bg-surface hover:border-border-hover',
      )}
    >
      {/* Top recommendation badge */}
      {isTopRecommendation && (
        <div className="absolute -top-3 left-4 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
          Top Pick
        </div>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Name */}
      <h3 className="text-xl font-bold tracking-tight text-text">
        {suggestion.name}
      </h3>

      {/* Technique tag + scores */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-secondary capitalize">
          {suggestion.technique}
        </span>
        <span className="text-xs text-text-muted">
          {suggestion.scores.memorability}/10 memorable
        </span>
        <span className="text-xs text-text-muted">
          {suggestion.scores.brandability}/10 brandable
        </span>
      </div>

      {/* Domain availability quick view */}
      <div className="mt-3 flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-text-muted" />
        {comAvailable ? (
          <span className="text-sm font-medium text-success">{cleanHandle}.com available</span>
        ) : domainBest ? (
          <span className="text-sm text-text-secondary">{domainBest}</span>
        ) : (
          <span className="text-sm text-text-muted">.com taken</span>
        )}
        <AvailabilityDot status={suggestion.domain.com} />
      </div>

      {/* Social handles quick summary */}
      {suggestion.socialHandles && (
        <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <AvailabilityDot status={suggestion.socialHandles.instagram} /> IG
          </span>
          <span className="flex items-center gap-1">
            <AvailabilityDot status={suggestion.socialHandles.tiktok} /> TikTok
          </span>
          <span className="flex items-center gap-1">
            <AvailabilityDot status={suggestion.socialHandles.youtube} /> YouTube
          </span>
        </div>
      )}

      {/* Trademark risk */}
      <div className="mt-3">
        <TrademarkBadge risk={suggestion.trademark.risk} />
      </div>

      {/* Rationale */}
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        {suggestion.rationale}
      </p>

      {/* Expand/collapse for more details */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-text-muted hover:text-primary"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Less details' : 'More details'}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 space-y-3 border-t border-border pt-3"
        >
          {/* Domain details */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Domains</p>
            <div className="space-y-1">
              {(['com', 'co', 'io'] as const).map((tld) => (
                <div key={tld} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{cleanHandle}.{tld}</span>
                  <div className="flex items-center gap-1">
                    <AvailabilityDot status={suggestion.domain[tld]} />
                    <span className={cn(
                      suggestion.domain[tld] === 'available' ? 'text-success'
                        : suggestion.domain[tld] === 'taken' ? 'text-error'
                        : 'text-text-muted',
                    )}>
                      {suggestion.domain[tld] === 'available' ? 'Available'
                        : suggestion.domain[tld] === 'taken' ? 'Taken'
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social handles details */}
          {suggestion.socialHandles && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Social Handles</p>
              <div className="space-y-1">
                <SocialHandleRow platform="instagram" handle={cleanHandle} status={suggestion.socialHandles.instagram} />
                <SocialHandleRow platform="tiktok" handle={cleanHandle} status={suggestion.socialHandles.tiktok} />
                <SocialHandleRow platform="youtube" handle={cleanHandle} status={suggestion.socialHandles.youtube} />
              </div>
            </div>
          )}

          {/* Trademark notes */}
          {suggestion.trademark.notes && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Trademark Notes</p>
              <p className="text-xs text-text-secondary">{suggestion.trademark.notes}</p>
            </div>
          )}

          {/* Pronunciation */}
          {suggestion.pronunciation && (
            <div className="text-xs text-text-muted">
              Pronunciation: <span className="font-mono">{suggestion.pronunciation}</span>
            </div>
          )}
        </motion.div>
      )}
    </motion.button>
  );
}
