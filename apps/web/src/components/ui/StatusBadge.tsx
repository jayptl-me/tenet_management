'use client';

import { clsx } from 'clsx';
import { STATUS_COLOR_MAP, type StatusVariant } from '@pg/types';

const variantStyles: Record<StatusVariant, string> = {
  success:
    'bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)] border-[color:var(--color-success-300)]',
  warning:
    'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)] border-[color:var(--color-warning-300)]',
  danger:
    'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] border-[color:var(--color-danger-300)]',
  info: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)] border-[color:var(--color-brand-300)]',
  neutral:
    'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] border-[color:var(--border-color)]',
};

export interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'font-display inline-flex items-center rounded-[var(--radius-full)] border-[length:var(--bw-default)] px-2.5 py-0.5 text-xs font-semibold shadow-[var(--shadow-xs)]',
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Maps app statuses to badge variants via the shared STATUS_COLOR_MAP.
 */
export function statusToVariant(status: string | null | undefined): StatusVariant {
  if (!status) return 'neutral';
  const key = status.toLowerCase();
  if (key in STATUS_COLOR_MAP) {
    return STATUS_COLOR_MAP[key]!;
  }
  // Legacy aliases not in the central map
  switch (key) {
    case 'completed':
    case 'partially_paid':
    case 'published':
    case 'processing':
    case 'blocked':
      return key === 'completed' || key === 'published'
        ? 'success'
        : key === 'partially_paid' || key === 'processing'
          ? 'warning'
          : 'danger';
    default:
      return 'neutral';
  }
}
