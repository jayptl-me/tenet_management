'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-8 py-12 text-center shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-[color:var(--color-text-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-[color:var(--color-text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[color:var(--color-text-muted)]">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </motion.div>
  );
}