'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface StayCalendarEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  subtitle?: string;
}

interface TenantStayCalendarProps {
  moveInDate?: string | null;
  moveOutDate?: string | null;
  isActive?: boolean;
  events?: StayCalendarEvent[];
  className?: string;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseToLocalYmd(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalYmd(d);
}

function eventDotClass(type: string): string {
  if (type === 'payment' || type === 'payment_verified')
    return 'bg-[color:var(--color-success-500)]';
  if (type === 'complaint_filed') return 'bg-[color:var(--color-warning-500)]';
  if (type === 'complaint_resolved') return 'bg-[color:var(--color-success-400)]';
  if (type === 'leave') return 'bg-[color:var(--color-brand-400)]';
  if (type === 'notice') return 'bg-[color:var(--color-info-500)]';
  if (type === 'checkout') return 'bg-[color:var(--color-danger-500)]';
  if (type === 'move_in') return 'bg-[color:var(--color-brand-600)]';
  return 'bg-[color:var(--color-surface-400)]';
}

export function TenantStayCalendar({
  moveInDate,
  moveOutDate,
  isActive = true,
  events = [],
  className,
}: TenantStayCalendarProps) {
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const initial = useMemo(() => {
    const base = moveInDate ? new Date(parseToLocalYmd(moveInDate) + 'T00:00:00') : new Date();
    const safe = Number.isNaN(base.getTime()) ? new Date() : base;
    return { year: safe.getFullYear(), month: safe.getMonth() };
  }, [moveInDate]);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [selected, setSelected] = useState<string | null>(null);

  const moveInYmd = moveInDate ? parseToLocalYmd(moveInDate) : '';
  const moveOutYmd = moveOutDate ? parseToLocalYmd(moveOutDate) : '';
  const stayEndYmd = moveOutYmd || (isActive ? todayYmd : '');

  const eventsByDay = useMemo(() => {
    const map = new Map<string, StayCalendarEvent[]>();
    for (const e of events) {
      const ymd = parseToLocalYmd(e.date);
      if (!ymd) continue;
      const list = map.get(ymd) ?? [];
      list.push(e);
      map.set(ymd, list);
    }
    return map;
  }, [events]);

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

  const goPrev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
    setSelected(null);
  };

  const goNext = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
    setSelected(null);
  };

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(todayYmd);
  };

  const isInStay = (ymd: string): boolean => {
    if (!moveInYmd || !ymd) return false;
    if (ymd < moveInYmd) return false;
    if (stayEndYmd && ymd > stayEndYmd) return false;
    return true;
  };

  const selectedEvents = selected ? (eventsByDay.get(selected) ?? []) : [];

  return (
    <div
      className={clsx(className)}
      role="region"
      aria-label={`Tenancy calendar for ${monthLabel}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
          {monthLabel}
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

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendar days">
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
          const dayEvents = eventsByDay.get(cell.ymd) ?? [];
          const inStay = isInStay(cell.ymd);
          const isToday = cell.ymd === todayYmd;
          const isMoveIn = cell.ymd === moveInYmd;
          const isMoveOut = moveOutYmd !== '' && cell.ymd === moveOutYmd;
          const isSelected = selected === cell.ymd;
          return (
            <button
              key={cell.ymd}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.ymd}${dayEvents.length > 0 ? `, ${dayEvents.length} events` : ''}${isMoveIn ? ', move-in' : ''}${isMoveOut ? ', move-out' : ''}`}
              onClick={() => setSelected(cell.ymd === selected ? null : cell.ymd)}
              className={clsx(
                'flex min-h-11 flex-col items-center justify-start rounded-[var(--radius-md)] border px-1 pt-1 pb-1.5 transition-colors',
                inStay
                  ? 'border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]'
                  : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] hover:bg-[color:var(--color-field-bg)]',
                isSelected && 'ring-2 ring-[color:var(--color-brand-500)] ring-offset-1',
              )}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                  isToday
                    ? 'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)]'
                    : isMoveIn || isMoveOut
                      ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)]'
                      : 'text-[color:var(--color-text-primary)]',
                )}
              >
                {cell.day}
              </span>
              {dayEvents.length > 0 && (
                <span className="mt-1 flex items-center gap-0.5" aria-hidden>
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={clsx('h-1.5 w-1.5 rounded-full', eventDotClass(e.type))}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] font-bold text-[color:var(--color-text-muted)]">
                      +{dayEvents.length - 3}
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
          <span className="h-2 w-2 rounded-sm border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]" />
          In stay
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-brand-500)]" />
          Today
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-500)]" />
          Payment
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning-500)]" />
          Complaint
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-brand-400)]" />
          Leave
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-info-500)]" />
          Notice
        </span>
      </div>

      {selected && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
          <p className="text-xs font-bold text-[color:var(--color-text-primary)]">
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              No events on this day.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {selectedEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', eventDotClass(e.type))}
                  />
                  <span>
                    <span className="font-semibold text-[color:var(--color-text-primary)]">
                      {e.title}
                    </span>
                    {e.subtitle && (
                      <span className="block text-[color:var(--color-text-muted)]">
                        {e.subtitle}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default TenantStayCalendar;
