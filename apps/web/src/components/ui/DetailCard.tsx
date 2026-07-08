'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

export type DetailCardVariant = 'default' | 'warning' | 'danger';

export interface DetailCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: DetailCardVariant;
  className?: string;
}

// ── Style Maps ─────────────────────────────────────────

const variantStyles: Record<DetailCardVariant, string> = {
  default: clsx(
    'bg-[color:var(--color-surface-100)]',
    'border-[color:var(--border-color)]',
  ),
  warning: clsx(
    'bg-[color:var(--color-warning-50)]',
    'border-[color:var(--color-warning-200)]',
  ),
  danger: clsx(
    'bg-[color:var(--color-danger-50)]',
    'border-[color:var(--color-danger-200)]',
  ),
};

// ── Component ──────────────────────────────────────────

export function DetailCard({
  title,
  icon,
  children,
  variant = 'default',
  className,
}: DetailCardProps) {
  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'rounded-xl border shadow-[var(--shadow-card)]',
        variantStyles[variant],
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[color:var(--border-color)] px-5 py-3.5">
        {icon && (
          <span className="text-[color:var(--color-text-muted)]">
            {icon}
          </span>
        )}
        <h3 className="text-sm font-bold text-[color:var(--color-text-primary)]">
          {title}
        </h3>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {children}
      </div>
    </motion.div>
  );
}