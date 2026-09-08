'use client';

import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight, ArrowRight } from 'lucide-react';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface KpiDelta {
  /** Formatted comparison value, e.g. "₹1.2L last month" */
  label: string;
  /** Signed percent change, null when not computable */
  percent: number | null;
}

export interface KpiHeaderItem {
  label: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface KpiHeaderProps {
  items: KpiHeaderItem[];
  className?: string;
}

// ── Style Maps ─────────────────────────────────────────

const toneAccent: Record<NonNullable<KpiHeaderItem['tone']>, string> = {
  default: 'bg-[color:var(--color-surface-300)]',
  success: 'bg-[color:var(--color-success-500)]',
  warning: 'bg-[color:var(--color-warning-500)]',
  danger: 'bg-[color:var(--color-danger-500)]',
  brand: 'bg-[color:var(--color-brand-500)]',
};

const deltaTone = (percent: number | null): string => {
  if (percent == null) {
    return 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)] border-[color:var(--color-surface-200)]';
  }
  if (percent > 0) {
    return 'bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)] border-[color:var(--color-success-200)]';
  }
  if (percent < 0) {
    return 'bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)] border-[color:var(--color-danger-200)]';
  }
  return 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)] border-[color:var(--color-surface-200)]';
};

// ── Component ──────────────────────────────────────────

/**
 * Stripe-style KPI strip: label, large tabular value, context delta line.
 * A 2px top accent carries tone; no icon-chip decoration.
 */
export function KpiHeader({ items, className }: KpiHeaderProps) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--border-color)] shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
      role="list"
    >
      {items.map((item) => {
        const interactive = !!item.onClick;
        const body = (
          <>
            <span
              aria-hidden
              className={clsx('absolute inset-x-0 top-0 h-0.5', toneAccent[item.tone ?? 'default'])}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold tracking-[0.01em] text-[color:var(--color-text-secondary)]">
                {item.label}
              </p>
              {item.icon && (
                <span className="text-[color:var(--color-text-muted)] [&_svg]:h-4 [&_svg]:w-4">
                  {item.icon}
                </span>
              )}
            </div>
            <p className="font-display mt-2 text-[26px] leading-none font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
              {item.value}
            </p>
            <div className="mt-2.5 flex min-h-5 items-center gap-2">
              {item.delta && (
                <span
                  className={clsx(
                    'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                    deltaTone(item.delta.percent),
                  )}
                >
                  {item.delta.percent == null ? (
                    <ArrowRight className="h-3 w-3" />
                  ) : item.delta.percent > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : item.delta.percent < 0 ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-3 w-3" />
                  )}
                  {item.delta.percent == null
                    ? '—'
                    : `${item.delta.percent > 0 ? '+' : ''}${Math.round(item.delta.percent)}%`}
                </span>
              )}
              {item.delta?.label && (
                <span className="truncate text-[11px] font-medium text-[color:var(--color-text-muted)]">
                  {item.delta.label}
                </span>
              )}
              {!item.delta && item.sub && (
                <span className="truncate text-[11px] font-medium text-[color:var(--color-text-muted)]">
                  {item.sub}
                </span>
              )}
            </div>
          </>
        );

        const shell = clsx(
          'relative bg-[color:var(--color-card-bg)] px-5 py-4',
          interactive && 'cursor-pointer transition-colors hover:bg-[color:var(--color-field-bg-hover)]',
        );

        return interactive ? (
          <button
            key={item.label}
            role="listitem"
            onClick={item.onClick}
            className={clsx(shell, 'w-full text-left')}
          >
            {body}
          </button>
        ) : (
          <div key={item.label} role="listitem" className={shell}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Kept for reference: legacy card style — do not use in new pages. */
export const legacyStatCardClass = surfaceCardClass;
