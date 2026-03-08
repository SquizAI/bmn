import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Static fallback node (no access to error/reset). */
  fallback?: ReactNode;
  /** Render function fallback (receives error + reset handler). */
  fallbackRender?: (props: FallbackProps) => ReactNode;
  /** Called when the boundary catches an error. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches render errors.
 * Supports three fallback modes:
 *   1. `fallbackRender` -- render function with error + resetErrorBoundary
 *   2. `fallback` -- static ReactNode
 *   3. Default full-page error screen
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Render-function fallback (per-route usage)
      if (this.props.fallbackRender && this.state.error) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.handleRetry,
        });
      }

      // Static fallback
      if (this.props.fallback) return this.props.fallback;

      // Default full-page fallback
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-bg">
              <AlertTriangle className="h-8 w-8 text-error" />
            </div>
            <h1 className="text-2xl font-bold text-text">Something went wrong</h1>
            <p className="mt-2 text-text-secondary">
              An unexpected error occurred. Please try again or return to the dashboard.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-surface p-3 text-left text-xs text-error">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Compact route-level error fallback.
 * Fits within a page layout (no min-h-screen).
 * Uses the design system Button and Card components.
 */
export function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-error-bg">
          <AlertTriangle className="h-6 w-6 text-error" />
        </div>
        <h2 className="text-lg font-semibold text-text">Something went wrong</h2>
        <p className="mt-1 text-sm text-text-secondary">
          This section encountered an error. The rest of the app is still working.
        </p>
        {import.meta.env.DEV && error && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-background p-2 text-left text-xs text-error">
            {error.message}
          </pre>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={resetErrorBoundary}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
