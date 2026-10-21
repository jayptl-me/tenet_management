'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface PageBandMetric {
  /** Metric name, e.g. "Collected · 2026-10". */
  label: string;
  /** Formatted value, e.g. "Rs 4,20,000". */
  value: string;
  /** Context line under the value (comparison, percentage, hint). */
  hint?: string;
  /** Small cue next to the value (a direction arrow, for instance). */
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  /** When set the metric becomes a button that runs this action. */
  onClick?: () => void;
}

export interface PageBandProps {
  /** Slim metric row at the top of the band. */
  metrics?: PageBandMetric[];
  /** Controls row: status tabs, filters, search. */
  children?: ReactNode;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────

const metricTone: Record<NonNullable<PageBandMetric['tone']>, string> = {
  default: 'text-(--color-text-primary)',
  success: 'text-(--color-success-600)',
  warning: 'text-(--color-warning-600)',
  danger: 'text-(--color-danger-600)',
  brand: 'text-(--color-brand-600)',
};

// ── Component ──────────────────────────────────────────

/**
 * The compact band that sits above a list: the numbers, the status tabs and
 * the filters in one surface, so the first data row is reachable without
 * scrolling past half a screen of chrome.
 *
 * Theme-agnostic: every colour comes from a CSS variable.
 */
export function PageBand({ metrics, children, className }: PageBandProps) {
  const hasMetrics = Array.isArray(metrics) && metrics.length > 0;

  return (
    <div className={clsx(surfaceCardClass, 'overflow-hidden', className)}>
      {hasMetrics && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 py-2.5">
          {metrics.map((metric) => {
            const body = (
              <>
                <span className="tracking-label text-xs font-semibold text-(--color-text-muted) uppercase">
                  {metric.label}
                </span>
                <span className="flex items-baseline gap-2">
                  {metric.icon && (
                    <span className="text-(--color-text-muted) [&_svg]:h-3.5 [&_svg]:w-3.5">
                      {metric.icon}
                    </span>
                  )}
                  <span
                    className={clsx(
                      'font-display text-15 font-bold tracking-tight tabular-nums',
                      metricTone[metric.tone ?? 'default'],
                    )}
                  >
                    {metric.value}
                  </span>
                  {metric.hint && (
                    <span className="text-2xs font-medium text-(--color-text-muted)">
                      {metric.hint}
                    </span>
                  )}
                </span>
              </>
            );

            if (metric.onClick) {
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={metric.onClick}
                  className="flex min-w-0 cursor-pointer flex-col gap-0.5 text-left transition-opacity hover:opacity-80"
                >
                  {body}
                </button>
              );
            }

            return (
              <div key={metric.label} className="flex min-w-0 flex-col gap-0.5">
                {body}
              </div>
            );
          })}
        </div>
      )}

      {children && (
        <div className={clsx(hasMetrics && 'border-t border-(--border-color)', 'px-4 py-2')}>
          {children}
        </div>
      )}
    </div>
  );
}
