'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';

export interface LeaveAttendanceImpactProps {
  tenantId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  /** Current leave status; preview copy adapts for approved vs pending. */
  status?: string | null;
  className?: string;
}

interface AttendanceDay {
  date: string;
  status?: string;
  checkIn?: string | null;
}

function eachDateInclusive(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatShort(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Attendance impact preview for a leave window.
 *
 * Reads GET /attendance?tenantId&fromDate&toDate and renders one chip per
 * leave day: days already checked in on-site are preserved on approval,
 * every other day is (or was) marked on leave. Read-only; leaves flow only.
 */
export function LeaveAttendanceImpact({
  tenantId,
  fromDate,
  toDate,
  status,
  className,
}: LeaveAttendanceImpactProps) {
  const [days, setDays] = useState<Record<string, AttendanceDay>>({});
  const [loading, setLoading] = useState(false);

  const window = fromDate && toDate ? eachDateInclusive(fromDate, toDate) : [];
  const approved = (status ?? '').toLowerCase() === 'approved';

  useEffect(() => {
    if (!tenantId || window.length === 0) {
      setDays({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('tenantId', tenantId);
    params.set('fromDate', fromDate ?? '');
    params.set('toDate', toDate ?? '');
    params.set('limit', '62');
    api
      .get(`attendance?${params.toString()}`)
      .json<{ success: boolean; data: AttendanceDay[] }>()
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, AttendanceDay> = {};
        for (const row of res.data ?? []) {
          if (row?.date) map[row.date] = row;
        }
        setDays(map);
      })
      .catch(() => {
        if (!cancelled) setDays({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // window is derived from fromDate/toDate; depend on the raw inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, fromDate, toDate]);

  if (window.length === 0) return null;

  const preserved = window.filter((d) => days[d]?.status === 'present' && days[d]?.checkIn);
  const toMark = window.length - preserved.length;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[color:var(--color-text-muted)]" />
        <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
          {approved
            ? `${toMark} day${toMark === 1 ? '' : 's'} marked on leave`
            : `Approval marks ${toMark} day${toMark === 1 ? '' : 's'} on leave`}
          {preserved.length > 0 && (
            <span className="font-semibold text-[color:var(--color-text-muted)]">
              {' '}
              · {preserved.length} on-site check-in{preserved.length === 1 ? '' : 's'} preserved
            </span>
          )}
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Leave window days">
        {window.map((d) => {
          const record = days[d];
          const kept = record?.status === 'present' && record?.checkIn;
          return (
            <span
              key={d}
              title={
                kept
                  ? `${d}: on-site check-in preserved`
                  : record?.status
                    ? `${d}: currently ${record.status}`
                    : `${d}: no record yet`
              }
              className={clsx(
                'rounded-full border px-2.5 py-1 text-[11px] font-bold',
                kept
                  ? 'border-[color:var(--color-success-300)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)]'
                  : record?.status === 'on_leave'
                    ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]'
                    : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]',
              )}
            >
              {formatShort(d)}
            </span>
          );
        })}
      </div>
      {loading && (
        <p className="mt-2 text-[11px] font-semibold text-[color:var(--color-text-muted)]">
          Loading attendance rows…
        </p>
      )}
    </div>
  );
}
