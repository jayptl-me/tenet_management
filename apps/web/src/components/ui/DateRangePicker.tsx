'use client';

import { clsx } from 'clsx';
import { DatePicker } from './DatePicker';

// ── Types ──────────────────────────────────────────────

export interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

// ── Component ──────────────────────────────────────────

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  label,
  className,
  compact = false,
}: DateRangePickerProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && !compact && (
        <span className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      <div className={clsx('flex gap-2', compact ? 'items-center' : 'items-end gap-3')}>
        <div className="flex-1">
          <DatePicker
            value={fromDate}
            onChange={(val: string) => onFromChange(val)}
            label={compact ? undefined : 'From'}
            aria-label="From date"
            placeholder="From"
          />
        </div>
        <span
          className={clsx(
            'shrink-0 text-[13px] font-medium text-[color:var(--color-text-muted)]',
            !compact && 'pb-2',
          )}
        >
          to
        </span>
        <div className="flex-1">
          <DatePicker
            value={toDate}
            onChange={(val: string) => onToChange(val)}
            label={compact ? undefined : 'To'}
            aria-label="To date"
            placeholder="To"
          />
        </div>
      </div>
    </div>
  );
}
