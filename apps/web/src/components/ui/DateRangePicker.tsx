'use client';

import { clsx } from 'clsx';
import { Input } from './Input';

// ── Types ──────────────────────────────────────────────

export interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  label?: string;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  label,
  className,
}: DateRangePickerProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFromChange(e.target.value)}
            label="From"
          />
        </div>
        <span className="pb-2 text-[13px] font-medium text-[color:var(--color-text-muted)]">
          to
        </span>
        <div className="flex-1">
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onToChange(e.target.value)}
            label="To"
          />
        </div>
      </div>
    </div>
  );
}
