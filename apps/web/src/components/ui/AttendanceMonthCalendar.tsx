'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { IAttendanceDayCounts } from '@pg/types';

export type AttendanceDayMap = Record<string, IAttendanceDayCounts>;

interface AttendanceMonthCalendarProps {
  days?: AttendanceDayMap;
  initialYear?: number;
  initialMonth?: number;
  selectedDay?: string | null;
  onSelectDay?: (ymd: string | null) => void;
  onMonthChange?: (year: number, month: number) => void;
  isLoading?: boolean;
  className?: string;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRange(year: number, month: number): { fromDate: string; toDate: string } {
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { fromDate, toDate };
}

function dominantStatus(counts: IAttendanceDayCounts): string {
  if (counts.absent > 0) return 'absent';
  if (counts.not_returned > 0) return 'not_returned';
  if (counts.on_leave > 0) return 'on_leave';
  if (counts.present > 0) return 'present';
  return 'unmarked';
}

function dayCellClass(status: string, isSelected: boolean): string {
  const base =
    'flex min-h-11 flex-col items-center justify-start rounded-[var(--radius-md)] border px-1 pt-1 pb-1.5 transition-colors';
  const selected = isSelected ? ' ring-2 ring-[color:var(--color-brand-500)] ring-offset-1' : '';
  switch (status) {
    case 'present':
      return clsx(
        base,
        'border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] hover:bg-[color:var(--color-success-100)]',
        selected,
      );
    case 'absent':
      return clsx(
        base,
        'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] hover:bg-[color:var(--color-danger-100)]',
        selected,
      );
    case 'on_leave':
      return clsx(
        base,
        'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-50)] hover:bg-[color:var(--color-brand-100)]',
        selected,
      );
    case 'not_returned':
      return clsx(
        base,
        'border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] hover:bg-[color:var(--color-warning-100)]',
        selected,
      );
    default:
      return clsx(
        base,
        'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] hover:bg-[color:var(--color-field-bg)]',
        selected,
      );
  }
}

function statusDotClass(status: string): string {
  if (status === 'present') return 'bg-[color:var(--color-success-500)]';
  if (status === 'absent') return 'bg-[color:var(--color-danger-500)]';
  if (status === 'on_leave') return 'bg-[color:var(--color-brand-500)]';
  if (status === 'not_returned') return 'bg-[color:var(--color-warning-500)]';
  return 'bg-[color:var(--color-surface-400)]';
}

export function AttendanceMonthCalendar({
  days = {},
  initialYear,
  initialMonth,
  selectedDay = null,
  onSelectDay,
  onMonthChange,
  isLoading = false,
  className,
}: AttendanceMonthCalendarProps) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    let startDow = first.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startDow; i++) list.push({ ymd: '', day: -1, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({ ymd, day: d, inMonth: true });
    }
    while (list.length % 7 !== 0) list.push({ ymd: '', day: -1, inMonth: false });
    return list;
  }, [year, month]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const changeMonth = (nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonth(nextMonth);
    onSelectDay?.(null);
    onMonthChange?.(nextYear, nextMonth);
  };

  const goPrev = () => {
    if (month === 0) changeMonth(year - 1, 11);
    else changeMonth(year, month - 1);
  };

  const goNext = () => {
    if (month === 11) changeMonth(year + 1, 0);
    else changeMonth(year, month + 1);
  };

  const goToday = () => {
    const t = new Date();
    changeMonth(t.getFullYear(), t.getMonth());
    onSelectDay?.(todayYmd);
  };

  return (
    <div
      className={clsx(className)}
      role="region"
      aria-label={`Attendance calendar for ${monthLabel}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
          {monthLabel}
          {isLoading && (
            <span className="ml-2 text-xs font-semibold text-[color:var(--color-text-muted)]">
              Loading...
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1.5 text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1.5 text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Attendance days">
        {DAY_NAMES.map((d) => (
          <p
            key={d}
            className="pb-1 text-center text-[10px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase"
          >
            {d}
          </p>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.inMonth) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-11 rounded-[var(--radius-md)] border border-transparent bg-transparent"
              />
            );
          }
          const counts = days[cell.ymd];
          const status = counts ? dominantStatus(counts) : 'unmarked';
          const isToday = cell.ymd === todayYmd;
          const isSelected = selectedDay === cell.ymd;
          const dots: string[] = [];
          if (counts) {
            if (counts.present > 0) dots.push('present');
            if (counts.absent > 0) dots.push('absent');
            if (counts.on_leave > 0) dots.push('on_leave');
            if (counts.not_returned > 0) dots.push('not_returned');
          }
          return (
            <button
              key={cell.ymd}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.ymd}${counts ? `, ${counts.total} records` : ', no records'}`}
              onClick={() => onSelectDay?.(isSelected ? null : cell.ymd)}
              className={dayCellClass(status, isSelected)}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                  isToday
                    ? 'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)]'
                    : 'text-[color:var(--color-text-primary)]',
                )}
              >
                {cell.day}
              </span>
              {dots.length > 0 && (
                <span className="mt-1 flex items-center gap-0.5" aria-hidden>
                  {dots.slice(0, 3).map((s) => (
                    <span key={s} className={clsx('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />
                  ))}
                  {counts && counts.total > 1 && (
                    <span className="text-[8px] font-bold text-[color:var(--color-text-muted)]">
                      {counts.total}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-500)]" />
          Present
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-danger-500)]" />
          Absent
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-brand-500)]" />
          On leave
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning-500)]" />
          Not returned
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-brand-500)]" />
          Today
        </span>
      </div>
    </div>
  );
}

export function attendanceMonthRange(
  year: number,
  month: number,
): { fromDate: string; toDate: string } {
  return monthRange(year, month);
}

export default AttendanceMonthCalendar;
