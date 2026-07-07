'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional fallback component — if not provided, uses default error UI */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-[length:var(--bw-strong)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-100)]">
              <AlertTriangle className="h-8 w-8 text-[color:var(--color-danger-600)]" />
            </div>
            <h2 className="font-display mb-2 text-xl font-bold text-[color:var(--color-danger-800)]">
              Something went wrong
            </h2>
            <p className="font-[family:var(--font-body)] mb-6 text-sm leading-relaxed text-[color:var(--color-danger-600)]">
              An unexpected error occurred while rendering this section. You can try refreshing
              the page, or go back to the dashboard.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer font-mono text-xs text-[color:var(--color-danger-500)]">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-3 font-mono text-[11px] leading-relaxed text-[color:var(--color-danger-700)]">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-5 py-2.5 font-display text-sm font-bold text-[color:var(--color-surface-900)] shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:translate-[var(--hover-lift)] active:scale-[var(--active-press-scale)]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-brand-500)] px-5 py-2.5 font-display text-sm font-bold text-white shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:translate-[var(--hover-lift)] active:scale-[var(--active-press-scale)]"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Page-level error boundary with full-page fallback.
 * Wraps individual admin pages to prevent a crash in one page
 * from breaking the entire admin shell.
 */
export function PageErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--color-danger-300)] bg-[color:var(--color-surface-100)] p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-[length:var(--bw-strong)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-100)]">
          <AlertTriangle className="h-8 w-8 text-[color:var(--color-danger-600)]" />
        </div>
        <h2 className="font-display mb-2 text-xl font-bold text-[color:var(--color-surface-900)]">
          Page Error
        </h2>
        <p className="font-[family:var(--font-body)] mb-6 text-sm leading-relaxed text-[color:var(--color-surface-500)]">
          This page encountered an error and could not load. Other sections of the admin panel are
          still working.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-brand-500)] px-5 py-2.5 font-display text-sm font-bold text-white shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
