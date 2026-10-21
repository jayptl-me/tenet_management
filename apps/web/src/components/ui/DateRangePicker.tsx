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
        <span className="text-13 font-semibold text-(--color-text-primary)">{label}</span>
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
            'text-13 shrink-0 font-medium text-(--color-text-muted)',
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
