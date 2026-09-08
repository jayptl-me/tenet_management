'use client';

import { clsx } from 'clsx';
import { DatePicker } from './DatePicker';

export interface AttendanceRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPreset?: (fromDate: string, toDate: string) => void;
  onClear?: () => void;
  className?: string;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AttendanceRangeFilter({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onPreset,
  onClear,
  className,
}: AttendanceRangeFilterProps) {
  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date();
    if (preset === 'today') {
      const ymd = toYmd(now);
      onPreset?.(ymd, ymd);
      return;
    }
    if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ymd = toYmd(y);
      onPreset?.(ymd, ymd);
      return;
    }
    if (preset === 'week') {
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      onPreset?.(toYmd(start), toYmd(end));
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    onPreset?.(toYmd(start), toYmd(end));
  };

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <DatePicker
          label="From"
          value={fromDate}
          onChange={(val: string) => onFromChange(val)}
          className="w-full sm:w-[180px]"
        />
        <DatePicker
          label="To"
          value={toDate}
          onChange={(val: string) => onToChange(val)}
          className="w-full sm:w-[180px]"
        />
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset('week')}
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => onClear?.()}
            className="rounded-[var(--radius-md)] border border-transparent bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
          >
            Clear
          </button>
        </div>
      </div>
      {fromDate !== '' && toDate !== '' && fromDate > toDate && (
        <p className="text-xs font-semibold text-[color:var(--color-danger-600)]">
          From date must be on or before To date.
        </p>
      )}
    </div>
  );
}

export default AttendanceRangeFilter;
