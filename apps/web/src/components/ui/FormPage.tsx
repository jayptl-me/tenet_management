'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
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
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-brand-500)]" />
        <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
          Loading...
        </p>
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
