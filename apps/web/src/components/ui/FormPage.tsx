'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { HeadingSkeleton, ShimmerBlock, FormFieldSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { pageStackClass } from '@/lib/field-styles';

export interface FormPageProps {
  title: string;
  description?: string;
  /** When set (including empty string for browser back), shows back button. */
  backHref?: string;
  error?: string;
  isLoading?: boolean;
  /** Optional right-side header actions (outside the form). */
  actions?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
  /**
   * Width of the page. The header and the body take the SAME width, so a page
   * never shows a wide header over a narrow body.
   *
   * - 'full' (the default): the whole shell band. Read pages (detail, ledger)
   *   and every page with a context rail - the rail gets the remaining width.
   * - 'form': the form measure - a form whose fields must stay a column a
   *   person can read a label and a value in.
   * - the numeric sizes stay available for a caller that needs another width.
   */
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'form' | 'full';
}

const maxWidthMap: Record<NonNullable<FormPageProps['maxWidth']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  /** The form measure: a readable column, one step below the whole band. */
  form: 'max-w-4xl',
  full: 'max-w-none',
};

/**
 * Canonical shell for create/edit admin pages.
 * Provides header, loading state, error banner, and content width.
 * Theme-agnostic: all colors come from CSS variables.
 */
export function FormPage({
  title,
  description,
  backHref,
  error,
  isLoading = false,
  actions,
  badge,
  children,
  className,
  maxWidth = 'full',
}: FormPageProps) {
  // One width for the whole page: the header and the body share it.
  const widthClass = clsx(
    'w-full min-w-0',
    maxWidthMap[maxWidth],
    maxWidth !== 'full' && 'mx-auto',
  );

  if (isLoading) {
    return (
      <div className={clsx(pageStackClass, 'pb-4 sm:pb-6', widthClass, className)}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-4">
          <div className="space-y-2">
            <HeadingSkeleton className="h-8 w-48" />
            <ShimmerBlock className="h-4 w-72" />
          </div>
          <ShimmerBlock className="h-9 w-24 rounded-lg" />
        </div>

        {/* Content skeleton */}
        <div className="w-full min-w-0">
          <div className="space-y-6 rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
            <ShimmerBlock className="h-5 w-36" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
            </div>
            <div className="flex justify-end gap-3 border-t border-[color:var(--border-color)] pt-4">
              <ShimmerBlock className="h-9 w-20 rounded-lg" />
              <ShimmerBlock className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(pageStackClass, 'pb-4 sm:pb-6', widthClass, className)}>
      <PageHeader
        title={title}
        description={description}
        backHref={backHref || undefined}
        action={actions}
        badge={badge}
      />

      {error && <ErrorBanner message={error} />}

      {children != null && children !== false && <div className="w-full min-w-0">{children}</div>}
    </div>
  );
}
