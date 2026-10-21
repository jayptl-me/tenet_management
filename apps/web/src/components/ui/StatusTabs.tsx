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
  default: 'text-(--color-text-muted)',
  success: 'text-(--color-success-600)',
  warning: 'text-(--color-warning-600)',
  danger: 'text-(--color-danger-600)',
  brand: 'text-(--color-brand-600)',
};

// ── Component ──────────────────────────────────────────

/** Underlined tab strip with live counts — one row per status question. */
export function StatusTabs({ tabs, active, onChange, className }: StatusTabsProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 overflow-x-auto border-b border-(--border-color)',
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
              'text-13 relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 transition-colors',
              selected
                ? 'font-bold text-(--color-text-primary)'
                : 'font-medium text-(--color-text-secondary) hover:text-(--color-text-primary)',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={clsx(
                  'text-10 rounded-[var(--radius-full)] px-1.5 py-0.5 font-bold tabular-nums',
                  selected
                    ? 'bg-(--color-brand-100) text-(--color-brand-700)'
                    : countTone[tab.tone ?? 'default'],
                )}
              >
                {tab.count}
              </span>
            )}
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-(--color-brand-500)"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
