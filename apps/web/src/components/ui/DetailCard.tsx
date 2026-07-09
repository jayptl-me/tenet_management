'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';
import { surfaceCardClass } from '@/lib/field-styles';

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

const variantStyles: Record<DetailCardVariant, string> = {
  default: clsx(
    'bg-[color:var(--color-card-bg)]',
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
  success: clsx(
    'bg-[color:var(--color-success-50)]',
    'border-[color:var(--color-success-200)]',
  ),
  info: clsx(
    'bg-[color:var(--color-info-50)]',
    'border-[color:var(--color-info-200)]',
  ),
};

const headerBorder: Record<DetailCardVariant, string> = {
  default: 'border-[color:var(--border-color)]',
  warning: 'border-[color:var(--color-warning-200)]',
  danger: 'border-[color:var(--color-danger-200)]',
  success: 'border-[color:var(--color-success-200)]',
  info: 'border-[color:var(--color-info-200)]',
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
      className={clsx(
        surfaceCardClass,
        'overflow-hidden',
        variantStyles[variant],
        className,
      )}
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)] [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </span>
          )}
          <h3 className="truncate text-sm font-bold text-[color:var(--color-text-primary)]">
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
      <dt className="text-xs font-medium text-[color:var(--color-text-muted)]">{label}</dt>
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
  return <dl className={clsx('divide-y-0', className)}>{children}</dl>;
}
