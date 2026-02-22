import { Link } from 'react-router';
import { Calendar, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';
import { cn, capitalize } from '@/lib/utils';
import type { Brand } from '@/hooks/use-brands';

// ── Status badge ─────────────────────────────────────────────────

const statusStyles: Record<Brand['status'], string> = {
  draft: 'bg-warning-bg text-warning border-warning-border',
  active: 'bg-success-bg text-success border-success-border',
  archived: 'bg-surface-hover text-text-muted border-border',
};

function StatusBadge({ status }: { status: Brand['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {capitalize(status)}
    </span>
  );
}

// ── Format relative date ─────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── BrandCard ────────────────────────────────────────────────────

interface BrandCardProps {
  brand: Brand;
}

export function BrandCard({ brand }: BrandCardProps) {
  return (
    <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)} className="block">
      <Card variant="interactive" padding="none">
        {/* Thumbnail / color fallback */}
        <div
          className="relative h-32 rounded-t-lg bg-surface-hover"
          style={
            brand.primaryColor
              ? { backgroundColor: brand.primaryColor }
              : undefined
          }
        >
          {brand.thumbnailUrl ? (
            <img
              src={brand.thumbnailUrl}
              alt={`${brand.name} thumbnail`}
              className="h-full w-full rounded-t-lg object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Sparkles className="h-10 w-10 text-text-muted opacity-40" />
            </div>
          )}

          {/* Status badge overlay */}
          <div className="absolute right-2 top-2">
            <StatusBadge status={brand.status} />
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <h3 className="truncate text-sm font-semibold text-text">
            {brand.name}
          </h3>

          {brand.tagline && (
            <p className="mt-0.5 truncate text-xs text-text-secondary">
              {brand.tagline}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            {brand.archetype && (
              <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-secondary capitalize">
                {brand.archetype}
              </span>
            )}

            <span className="ml-auto flex items-center gap-1 text-xs text-text-muted">
              <Calendar className="h-3 w-3" />
              {formatRelativeDate(brand.updatedAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
