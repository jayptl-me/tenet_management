'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
import { ErrorBanner } from './ErrorBanner';
import { pageStackClass } from '@/lib/field-styles';

export interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  error?: string;
  children: ReactNode;
  backButton?: ReactNode;
  className?: string;
}

/**
 * Shared page wrapper for list/detail admin pages.
 * Aligns with FormPage / PageHeader hierarchy and design tokens.
 */
export function PageShell({
  title,
  description,
  actions,
  error,
  children,
  backButton,
  className,
}: PageShellProps) {
  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className={clsx(pageStackClass, className)}
    >
      <motion.div
        variants={fadeScaleIn}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 items-start gap-3">
          {backButton && <div className="shrink-0 pt-0.5">{backButton}</div>}
          <div className="min-w-0">
            <h1 className="font-[family:var(--font-display)] text-balance text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-[color:var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </motion.div>

      {error && <ErrorBanner message={error} />}

      {children}
    </motion.div>
  );
}
