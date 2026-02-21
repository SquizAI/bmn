import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// ─── Shimmer Overlay ─────────────────────────────────────────────
// Animated gradient sweep for skeleton containers

export function ShimmerOverlay({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        'pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent',
        className,
      )}
      animate={{ translateX: ['calc(-100%)', 'calc(100%)'] }}
      transition={{ repeat: Infinity, duration: 2, ease: 'linear', repeatDelay: 0.8 }}
    />
  );
}

// ─── Skeleton Bar ────────────────────────────────────────────────
// Pulsing rectangular placeholder for text lines, labels, etc.

export function SkeletonBar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('rounded bg-[var(--bmn-color-border)]/30 animate-pulse', className)}
      style={style}
    />
  );
}

// ─── Skeleton Circle ─────────────────────────────────────────────
// Pulsing circular placeholder for avatars, icons, etc.

export function SkeletonCircle({
  size = 'md',
  className,
  style,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20',
  };

  return (
    <div
      className={cn(
        'shrink-0 rounded-full bg-[var(--bmn-color-border)]/30 animate-pulse',
        sizeClasses[size],
        className,
      )}
      style={style}
    />
  );
}

// ─── Skeleton Image ──────────────────────────────────────────────
// Pulsing image placeholder with centered icon hint

export function SkeletonImage({
  aspectRatio = 'square',
  icon,
  className,
  style,
}: {
  aspectRatio?: 'square' | 'video' | '4/3' | '3/2';
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-lg bg-[var(--bmn-color-border)]/15 animate-pulse',
        aspectClasses[aspectRatio],
        className,
      )}
      style={style}
    >
      {icon && <div className="text-[var(--bmn-color-text-muted)]/15">{icon}</div>}
    </div>
  );
}

// ─── Skeleton Card ───────────────────────────────────────────────
// Card container with shimmer overlay — wraps skeleton content

export function SkeletonCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]/50 bg-[var(--bmn-color-surface)]/80 p-5 shadow-sm',
        className,
      )}
    >
      <ShimmerOverlay />
      {children}
    </motion.div>
  );
}

// ─── Skeleton Section Header ─────────────────────────────────────
// Faint section label for skeleton layout structure

export function SkeletonSectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="text-[var(--bmn-color-text-muted)]/40">{icon}</div>
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]/40">
        {label}
      </span>
    </div>
  );
}
