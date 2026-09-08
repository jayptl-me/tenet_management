'use client';

import { clsx } from 'clsx';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
  amount: number;
}

export interface AgingBarsProps {
  buckets: AgingBucket[];
  totalOutstanding: number;
  isLoading?: boolean;
  onSelect?: (bucket: AgingBucket) => void;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────

function fmt(amount: number): string {
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${Math.round(amount / 1_000)}K`;
  return `₹${Math.round(amount)}`;
}

const BUCKET_TONES: Record<string, string> = {
  current: 'bg-[color:var(--color-brand-500)]',
  days1_30: 'bg-[color:var(--color-warning-500)]',
  days31_60: 'bg-[color:var(--color-warning-600)]',
  days61_90: 'bg-[color:var(--color-danger-400)]',
  days90Plus: 'bg-[color:var(--color-danger-600)]',
};

// ── Component ──────────────────────────────────────────

/** Horizontal aging ladder: one row per bucket, bar width by amount share. */
export function AgingBars({
  buckets,
  totalOutstanding,
  isLoading = false,
  onSelect,
  className,
}: AgingBarsProps) {
  const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <div className={clsx(surfaceCardClass, 'p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Receivables aging
          </h3>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            Outstanding invoice balances by days past due
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-[color:var(--color-text-primary)] tabular-nums">
            {isLoading ? '—' : fmt(totalOutstanding)}
          </p>
          <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
            total outstanding
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {buckets.map((bucket) => {
          const share = totalOutstanding > 0 ? (bucket.amount / maxAmount) * 100 : 0;
          const interactive = !!onSelect && bucket.count > 0 && !isLoading;
          return (
            <button
              key={bucket.key}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onSelect?.(bucket)}
              className={clsx(
                'group grid w-full grid-cols-[92px_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors',
                interactive && 'hover:bg-[color:var(--color-field-bg-hover)]',
                !interactive && 'cursor-default',
              )}
            >
              <span className="text-xs font-semibold text-[color:var(--color-text-secondary)]">
                {bucket.label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="relative h-2 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[color:var(--chart-track)]"
                  role="presentation"
                >
                  <span
                    className={clsx(
                      'absolute inset-y-0 left-0 rounded-[var(--radius-full)] transition-[width] duration-500',
                      BUCKET_TONES[bucket.key] ?? 'bg-[color:var(--color-surface-300)]',
                    )}
                    style={{ width: isLoading ? '0%' : `${Math.max(share, bucket.count > 0 ? 3 : 0)}%` }}
                  />
                </span>
                <span className="w-8 text-right text-[11px] font-semibold text-[color:var(--color-text-muted)] tabular-nums">
                  {bucket.count}
                </span>
              </span>
              <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)] tabular-nums">
                {isLoading ? '—' : fmt(bucket.amount)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
