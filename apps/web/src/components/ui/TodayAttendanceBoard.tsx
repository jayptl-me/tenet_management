'use client';

import { useEffect, useState } from 'react';
import { Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';

interface TodaySummary {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  notReturned: number;
}

interface TodayAttendanceResponse {
  date: string;
  summary: TodaySummary;
  records: unknown[];
}

export function TodayAttendanceBoard() {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('attendance/today')
      .json<{ success: boolean; data: TodayAttendanceResponse }>()
      .then((res) => {
        if (!cancelled) {
          setSummary(res.data.summary);
          setDate(res.data.date);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[88px] animate-pulse rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]"
          />
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] px-4 py-3 text-sm text-[color:var(--color-danger-800)]">
        Failed to load today&apos;s attendance summary.
      </div>
    );
  }

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-3">
      {formattedDate && (
        <p className="text-[13px] font-semibold text-[color:var(--color-text-muted)]">
          Today&apos;s attendance — {formattedDate}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Active Tenants"
          value={summary.total}
          icon={<Users className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard
          title="Present"
          value={summary.present}
          icon={<CheckCircle className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          title="Absent"
          value={summary.absent}
          icon={<XCircle className="h-4 w-4" />}
          variant="danger"
        />
        <StatCard
          title="Not Marked"
          value={summary.notReturned}
          icon={<Clock className="h-4 w-4" />}
          variant="warning"
        />
      </div>
    </div>
  );
}
