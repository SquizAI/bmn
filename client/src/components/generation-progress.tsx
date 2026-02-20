import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ------ Types ------

type ProgressStatus = 'idle' | 'pending' | 'processing' | 'complete' | 'error';

interface GenerationProgressProps {
  progress: number;
  status: ProgressStatus;
  message: string;
  error?: string | null;
  className?: string;
}

// ------ Status Icon ------

function StatusIcon({ status }: { status: ProgressStatus }) {
  switch (status) {
    case 'idle':
      return null;
    case 'pending':
      return <Loader2 className="h-5 w-5 animate-spin text-text-muted" />;
    case 'processing':
      return <Zap className="h-5 w-5 text-primary" />;
    case 'complete':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-error" />;
  }
}

// ------ Component ------

function GenerationProgress({
  progress,
  status,
  message,
  error,
  className,
}: GenerationProgressProps) {
  if (status === 'idle') return null;

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-xl border bg-surface p-6',
          status === 'error' ? 'border-error/30 bg-error-bg' : 'border-border',
          className,
        )}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <StatusIcon status={status} />
          <div className="flex-1">
            <p className="text-sm font-medium text-text">
              {status === 'pending' && 'Starting generation...'}
              {status === 'processing' && 'Generating...'}
              {status === 'complete' && 'Generation complete!'}
              {status === 'error' && 'Generation failed'}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">{message}</p>
          </div>
          {status === 'processing' && (
            <span className="text-sm font-semibold text-primary">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {(status === 'pending' || status === 'processing') && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
            {status === 'pending' ? (
              <motion.div
                className="h-full w-1/4 rounded-full bg-primary/50"
                animate={{ x: ['0%', '300%', '0%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : (
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${clampedProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            )}
          </div>
        )}

        {/* Complete indicator */}
        {status === 'complete' && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-success/20">
            <div className="h-full w-full rounded-full bg-success" />
          </div>
        )}

        {/* Error message */}
        {status === 'error' && error && (
          <p className="mt-2 text-sm text-error">{error}</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export { GenerationProgress };
export type { GenerationProgressProps, ProgressStatus };
