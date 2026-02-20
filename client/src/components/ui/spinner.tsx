import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

function Spinner({ size = 'md', className, fullPage = false }: SpinnerProps) {
  const spinner = (
    <Loader2
      className={cn('animate-spin text-primary', sizeStyles[size], className)}
      aria-label="Loading"
    />
  );

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Full-page loading spinner for Suspense boundaries.
 */
function LoadingSpinner({ fullPage = false }: { fullPage?: boolean }) {
  return <Spinner size="lg" fullPage={fullPage} />;
}

export { Spinner, LoadingSpinner };
export type { SpinnerProps };
