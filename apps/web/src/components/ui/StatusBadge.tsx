'use client';

import { clsx } from 'clsx';
import { STATUS_COLOR_MAP, type StatusVariant } from '@pg/types';

/**
 * Tinted semantic pill with an accent dot.
 * Colors resolve through per-mode chip tokens (--badge-*-bg/text/border),
 * so the pill reads correctly on light and dark card surfaces for every
 * theme preset without per-mode overrides.
 */
const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-(--badge-success-bg) text-(--badge-success-text) border-(--badge-success-border)',
  warning: 'bg-(--badge-warning-bg) text-(--badge-warning-text) border-(--badge-warning-border)',
  danger: 'bg-(--badge-danger-bg) text-(--badge-danger-text) border-(--badge-danger-border)',
  info: 'bg-(--badge-info-bg) text-(--badge-info-text) border-(--badge-info-border)',
  neutral: 'bg-(--badge-neutral-bg) text-(--badge-neutral-text) border-(--badge-neutral-border)',
};

const dotStyles: Record<StatusVariant, string> = {
  success: 'bg-(--color-success-500)',
  warning: 'bg-(--color-warning-500)',
  danger: 'bg-(--color-danger-500)',
  info: 'bg-(--color-brand-500)',
  neutral: 'bg-(--color-text-muted)',
};

export interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  /** Render the semantic accent dot (default true). */
  showDot?: boolean;
  /** Compact metrics for dense rows (default 'md'). */
  size?: 'md' | 'xs';
  className?: string;
}

const sizeStyles = {
  md: 'px-2.5 py-1 text-xs font-semibold',
  xs: 'px-2 py-0.5 text-10 font-semibold',
} as const;

export function StatusBadge({
  variant,
  label,
  showDot = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'font-display inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border-[length:var(--bw-default)] whitespace-nowrap',
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={clsx('h-1.5 w-1.5 flex-shrink-0 rounded-full', dotStyles[variant])}
        />
      )}
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
