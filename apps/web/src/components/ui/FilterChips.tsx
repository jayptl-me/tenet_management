'use client';

import { clsx } from 'clsx';
import { X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

export interface FilterChip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────

/** Removable active-filter chips row; renders nothing when empty. */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div
      className={clsx('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] py-1 pr-1.5 pl-2.5 text-xs font-semibold text-[color:var(--color-brand-800)]"
        >
          <span className="text-[color:var(--color-brand-600)]">{chip.label}:</span>
          <span className="max-w-[180px] truncate">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded-full p-0.5 transition-colors hover:bg-[color:var(--color-brand-100)]"
            aria-label={`Remove filter ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-semibold text-[color:var(--color-text-secondary)] underline-offset-2 hover:text-[color:var(--color-text-primary)] hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
