'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { fadeScaleIn } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────

export interface ErrorStateProps {
  title: string;
  description?: string;
  errorCode?: string;
  onRetry?: () => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function ErrorState({
  title,
  description,
  errorCode,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'rounded-xl border border-[color:var(--color-danger-200)] border-l-[4px] border-l-[color:var(--color-danger-500)] bg-[color:var(--color-danger-50)] px-6 py-8 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-6 w-6 text-[color:var(--color-danger-500)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[color:var(--color-danger-700)]">
            {title}
          </h3>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-danger-600)]">
              {description}
            </p>
          )}
          {errorCode && (
            <p className="mt-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-danger-400)]">
              {errorCode}
            </p>
          )}
          {onRetry && (
            <div className="mt-5">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}