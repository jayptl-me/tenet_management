'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

export type DetailCardVariant = 'default' | 'warning' | 'danger' | 'success' | 'info';

export interface DetailCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: DetailCardVariant;
  className?: string;
  /** Optional trailing header content (actions, badges). */
  action?: React.ReactNode;
  /** Compact padding for dense detail grids. */
  compact?: boolean;
}

// ── Style Maps ─────────────────────────────────────────

/** Full surface + semantic tint. Avoid stacking surfaceCardClass + bg override (Tailwind conflict). */
const variantStyles: Record<DetailCardVariant, string> = {
  default: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--border-color)]',
    'bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)]',
  ),
  warning: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--color-warning-200)]',
    'bg-[color:var(--color-warning-50)] shadow-[var(--shadow-card)]',
  ),
  danger: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--color-danger-200)]',
    'bg-[color:var(--color-danger-50)] shadow-[var(--shadow-card)]',
  ),
  success: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--color-success-200)]',
    'bg-[color:var(--color-success-50)] shadow-[var(--shadow-card)]',
  ),
  info: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--color-info-200)]',
    'bg-[color:var(--color-info-50)] shadow-[var(--shadow-card)]',
  ),
};

const headerBorder: Record<DetailCardVariant, string> = {
  default: 'border-[color:var(--border-color)]',
  warning: 'border-[color:var(--color-warning-200)]',
  danger: 'border-[color:var(--color-danger-200)]',
  success: 'border-[color:var(--color-success-200)]',
  info: 'border-[color:var(--color-info-200)]',
};

const iconTone: Record<DetailCardVariant, string> = {
  default: 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]',
  warning: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
  danger: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
  success: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]',
  info: 'bg-[color:var(--color-info-100)] text-[color:var(--color-info-700)]',
};

// ── Component ──────────────────────────────────────────

export function DetailCard({
  title,
  icon,
  children,
  variant = 'default',
  className,
  action,
  compact = false,
}: DetailCardProps) {
  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(variantStyles[variant], 'overflow-hidden', className)}
    >
      <div
        className={clsx(
          'flex items-center justify-between gap-3 border-b',
          headerBorder[variant],
          compact ? 'px-4 py-3' : 'px-5 py-3.5',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] [&_svg]:h-4 [&_svg]:w-4',
                iconTone[variant],
              )}
            >
              {icon}
            </span>
          )}
          <h3 className="truncate text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {title}
          </h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={clsx(compact ? 'px-4 py-3' : 'px-5 py-4')}>{children}</div>
    </motion.div>
  );
}

/** Key/value row for detail views. */
export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-0.5 border-b border-[color:var(--border-color)] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className,
      )}
    >
      <dt className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm font-semibold text-[color:var(--color-text-primary)] sm:text-right">
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function DetailList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dl className={clsx(className)}>{children}</dl>;
}
