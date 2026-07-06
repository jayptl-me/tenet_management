'use client';

import { clsx } from 'clsx';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-success-100 text-success-800 border-success-300',
  warning: 'bg-warning-100 text-warning-800 border-warning-300',
  danger: 'bg-danger-100 text-danger-800 border-danger-300',
  info: 'bg-brand-100 text-brand-800 border-brand-300',
  neutral: 'bg-surface-100 text-surface-700 border-surface-300',
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
        'font-display inline-flex items-center rounded-[var(--radius-full)] border-[length:var(--bw-default)] px-2.5 py-0.5 text-xs font-semibold',
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Maps common app statuses to badge variants.
 */
export function statusToVariant(status: string | null | undefined): StatusVariant {
  if (!status) return 'neutral';
  switch (status.toLowerCase()) {
    case 'active':
    case 'paid':
    case 'completed':
    case 'approved':
    case 'present':
    case 'resolved':
    case 'available':
    case 'open':
    case 'published':
      return 'success';
    case 'pending':
    case 'in_progress':
    case 'processing':
    case 'partially_paid':
      return 'warning';
    case 'overdue':
    case 'rejected':
    case 'cancelled':
    case 'absent':
    case 'blocked':
    case 'maintenance':
    case 'closed':
      return 'danger';
    case 'occupied':
    case 'draft':
    case 'on_leave':
    case 'sent':
      return 'info';
    default:
      return 'neutral';
  }
}
