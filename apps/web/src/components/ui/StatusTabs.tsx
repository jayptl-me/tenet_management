'use client';

import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

export interface StatusTab {
  key: string;
  label: string;
  count: number | null;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
}

export interface StatusTabsProps {
  tabs: StatusTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────

const countTone: Record<NonNullable<StatusTab['tone']>, string> = {
  default: 'text-[color:var(--color-text-muted)]',
  success: 'text-[color:var(--color-success-600)]',
  warning: 'text-[color:var(--color-warning-600)]',
  danger: 'text-[color:var(--color-danger-600)]',
  brand: 'text-[color:var(--color-brand-600)]',
};

// ── Component ──────────────────────────────────────────

/** Underlined tab strip with live counts — one row per status question. */
export function StatusTabs({ tabs, active, onChange, className }: StatusTabsProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 overflow-x-auto border-b border-[color:var(--border-color)]',
        className,
      )}
      role="tablist"
      aria-label="Filter by status"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(tab.key)}
            className={clsx(
              'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] transition-colors',
              selected
                ? 'font-bold text-[color:var(--color-text-primary)]'
                : 'font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={clsx(
                  'rounded-[var(--radius-full)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  selected
                    ? 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]'
                    : countTone[tab.tone ?? 'default'],
                )}
              >
                {tab.count}
              </span>
            )}
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[color:var(--color-brand-500)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
