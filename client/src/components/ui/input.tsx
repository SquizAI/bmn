import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helpText,
    leftAddon,
    rightAddon,
    required = false,
    className,
    id: providedId,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && (
          <span className="absolute left-3 text-text-muted">{leftAddon}</span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          className={cn(
            'h-11 sm:h-9 w-full rounded-md border bg-surface px-3 text-base sm:text-[13px] text-text transition-colors duration-150',
            'placeholder:text-text-muted',
            'hover:border-border-hover',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-border',
            leftAddon && 'pl-10',
            rightAddon && 'pr-10',
            className,
          )}
          {...props}
        />
        {rightAddon && (
          <span className="absolute right-3 text-text-muted">{rightAddon}</span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={helpId} className="text-xs text-text-muted">
          {helpText}
        </p>
      )}
    </div>
  );
});

export { Input };
export type { InputProps };
