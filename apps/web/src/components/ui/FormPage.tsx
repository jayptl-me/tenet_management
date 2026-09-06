'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
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
  /** Max width of the form content column. Default 2xl for edit forms; use 4xl/full for detail views. */
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
}

const maxWidthMap: Record<NonNullable<FormPageProps['maxWidth']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
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
  maxWidth = '2xl',
}: FormPageProps) {
  if (isLoading) {
    return (
      <div className={clsx(pageStackClass, 'pb-4 sm:pb-6', className)}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-4">
          <div className="space-y-2">
            <HeadingSkeleton className="h-8 w-48" />
            <ShimmerBlock className="h-4 w-72" />
          </div>
          <ShimmerBlock className="h-9 w-24 rounded-lg" />
        </div>

        {/* Content skeleton */}
        <div
          className={clsx(
            'w-full min-w-0',
            maxWidthMap[maxWidth],
            maxWidth !== 'full' && 'mx-auto',
          )}
        >
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
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className={clsx(pageStackClass, 'pb-4 sm:pb-6', className)}
    >
      <PageHeader
        title={title}
        description={description}
        backHref={backHref ?? ''}
        action={actions}
        badge={badge}
      />

      {error && (
        <motion.div variants={fadeScaleIn}>
          <ErrorBanner message={error} />
        </motion.div>
      )}

      {children != null && children !== false && (
        <motion.div
          variants={fadeScaleIn}
          className={clsx(
            'w-full min-w-0',
            maxWidthMap[maxWidth],
            maxWidth !== 'full' && 'mx-auto',
          )}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
