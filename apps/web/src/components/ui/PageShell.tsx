'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
import { ErrorBanner } from './ErrorBanner';

export interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  error?: string;
  children: ReactNode;
  backButton?: ReactNode;
}

/**
 * Shared page wrapper providing consistent header, error banner,
 * and entrance animation across all admin pages.
 */
export function PageShell({
  title,
  description,
  actions,
  error,
  children,
  backButton,
}: PageShellProps) {
  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={fadeScaleIn}
        className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-3">
          {backButton}
          <div>
            <h2 className="font-[family:var(--font-display)] text-2xl font-extrabold text-[color:var(--color-text-primary)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm font-medium text-[color:var(--color-text-muted)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </motion.div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Content */}
      {children}
    </motion.div>
  );
}
