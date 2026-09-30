'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  MapPin,
  Calendar,
  Clock,
  QrCode,
  Smartphone,
  Monitor,
  FileText,
  CheckCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Timer,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import {
  AttendanceMonthCalendar,
  type AttendanceDayMap,
} from '@/components/ui/AttendanceMonthCalendar';
import type { IAttendanceSummaryResponse } from '@pg/types';

interface AttendanceDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { _id: string; name: string; email: string; phone: string };
    room?: { _id: string; roomNumber: string };
  } | null;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkIn?: string;
  checkOut?: string;
  method?: string;
  recordedBy?: { _id: string; name: string } | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface LeaveRow {
  _id?: string;
  id?: string;
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  manual: <User className="h-4 w-4" />,
  qr: <QrCode className="h-4 w-4" />,
  app: <Smartphone className="h-4 w-4" />,
};

const methodLabels: Record<string, string> = {
  manual: 'Manual Entry',
  qr: 'QR Code Scan',
  app: 'Mobile App',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr).toLocaleDateString(
      'en-IN',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      },
    );
  } catch {
    return '—';
  }
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function durationBetween(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string {
  if (!checkIn || !checkOut) return '—';
  try {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    if (Number.isNaN(diff) || diff < 0) return 'Invalid (out < in)';
    const mins = Math.floor(diff / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  } catch {
    return '—';
  }
}

function shiftYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ATTENDANCE_DETAIL_KEY = ['attendance', 'detail'] as const;
const ATTENDANCE_SUMMARY_KEY = ['attendance', 'summary'] as const;
const LEAVES_BY_TENANT_KEY = ['leaves', 'by-tenant'] as const;

/** Query window for `attendance/summary` covering the whole calendar month. */
function attendanceSummaryPath(year: number, month: number, tenantId: string): string {
  const last = new Date(year, month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const params = new URLSearchParams();
  params.set('fromDate', `${year}-${pad(month + 1)}-01`);
  params.set('toDate', `${year}-${pad(month + 1)}-${pad(last)}`);
  if (tenantId) params.set('tenantId', tenantId);
  return `attendance/summary?${params.toString()}`;
}

/** Leave whose range covers the given day, or null when none matches. */
function findCoveringLeave(rows: LeaveRow[], ymd: string): LeaveRow | null {
  return (
    rows.find((l) => {
      const from = (l.fromDate ?? l.startDate ?? '').slice(0, 10);
      const to = (l.toDate ?? l.endDate ?? '').slice(0, 10);
      return from !== '' && to !== '' && from <= ymd && ymd <= to;
    }) ?? null
  );
}

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [error, setError] = useState('');
  const [navError, setNavError] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [summaryNav, setSummaryNav] = useState<{
    id: string;
    year: number;
    month: number;
  } | null>(null);

  const {
    data,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<AttendanceDetail>(
    [...ATTENDANCE_DETAIL_KEY, id ?? ''],
    `attendance/${id ?? ''}`,
    { enabled: !!id },
  );
  const record = data ?? null;

  const recordYmd = record ? record.date.slice(0, 10) : '';
  const recordMonth = record ? new Date(`${recordYmd}T00:00:00`) : new Date();
  const tenantId = record?.tenant?._id ?? '';

  const activeMonth =
    summaryNav && record && summaryNav.id === record._id
      ? { year: summaryNav.year, month: summaryNav.month }
      : { year: recordMonth.getFullYear(), month: recordMonth.getMonth() };

  const summaryQuery = useApiQuery<IAttendanceSummaryResponse>(
    [...ATTENDANCE_SUMMARY_KEY, activeMonth.year, activeMonth.month, tenantId],
    attendanceSummaryPath(activeMonth.year, activeMonth.month, tenantId),
    { enabled: !!record },
  );
  const calendarDays: AttendanceDayMap = summaryQuery.data?.days ?? {};

  const leaveQuery = useApiQuery<LeaveRow[]>(
    [...LEAVES_BY_TENANT_KEY, tenantId],
    `leaves?tenantId=${tenantId}&limit=50`,
    { enabled: tenantId !== '' && record?.status === 'on_leave' },
  );
  const leaveLink =
    record?.status === 'on_leave' && leaveQuery.data
      ? findCoveringLeave(leaveQuery.data, recordYmd)
      : null;

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`attendance/${id}`).json();
      router.push('/attendance');
    } catch (err) {
      setError((await parseApiError(err)).message);
      setIsDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const goToDate = async (target: string) => {
    if (!record) return;
    setNavError('');
    try {
      const params = new URLSearchParams();
      params.set('date', target);
      params.set('limit', '10');
      if (record.tenant?._id) params.set('tenantId', record.tenant._id);
      const res = await api.get(`attendance?${params.toString()}`).json<{
        success: boolean;
        data: Array<{ _id: string }>;
      }>();
      const first = (res.data ?? [])[0];
      if (first) router.push(`/attendance/${first._id}`);
      else setNavError(`No attendance record on ${target}`);
    } catch {
      setNavError('Failed to navigate to adjacent day');
    }
  };

  const goDay = async (delta: number) => {
    if (!record) return;
    await goToDate(shiftYmd(record.date.slice(0, 10), delta));
  };

  const loadError = errorMessage(queryError) || error;

  if (!isLoading && (loadError || !record)) {
    return (
      <FormPage
        title="Attendance Record"
        description="View attendance details"
        backHref="/attendance"
        error={loadError || 'Attendance record not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = record ? statusToVariant(record.status) : 'neutral';
  const tenantName = record?.tenant?.user?.name ?? 'N/A';
  const roomNumber = record?.tenant?.room?.roomNumber ?? 'N/A';
  const checkIn = record?.checkInTime ?? record?.checkIn;
  const checkOut = record?.checkOutTime ?? record?.checkOut;
  const methodIcon = record?.method ? methodIcons[record.method] : <Monitor className="h-4 w-4" />;
  const methodLabel = record?.method ? (methodLabels[record.method] ?? record.method) : 'Unknown';
  const duration = durationBetween(checkIn ?? null, checkOut ?? null);

  return (
    <FormPage
      title="Attendance Record"
      description={record ? `${tenantName} · Room ${roomNumber}` : 'View attendance details'}
      backHref="/attendance"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        record ? (
          <StatusBadge variant={statusVariant} label={record.status.replace(/_/g, ' ')} />
        ) : undefined
      }
      actions={
        record ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goDay(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goDay(1)} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/attendance/${record._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      {record && (
        <div className="space-y-6">
          <ErrorBanner message={navError} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Date"
              value={formatDate(record.date)}
              icon={<Calendar className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Status"
              value={record.status.replace(/_/g, ' ')}
              icon={<CheckCircle className="h-4 w-4" />}
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : 'danger'
              }
            />
            <StatCard
              title="Check-in"
              value={formatTime(checkIn)}
              icon={<Clock className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Check-out"
              value={formatTime(checkOut)}
              icon={<Clock className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Duration"
              value={duration}
              icon={<Timer className="h-4 w-4" />}
              variant="default"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Tenant Information" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {tenantName}
                    </span>
                  }
                />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {roomNumber}
                    </span>
                  }
                />
                <DetailRow
                  label="Date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {formatDate(record.date)}
                    </span>
                  }
                />
                {tenantId && (
                  <DetailRow
                    label="Tenant"
                    value={
                      <button
                        type="button"
                        onClick={() => router.push(`/tenants/${tenantId}`)}
                        className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) hover:underline"
                      >
                        View tenant
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                )}
              </DetailList>
            </DetailCard>

            <DetailCard title="Attendance Details" icon={<Clock />}>
              <DetailList>
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge variant={statusVariant} label={record.status.replace(/_/g, ' ')} />
                  }
                />
                <DetailRow label="Check-in Time" value={formatTime(checkIn)} />
                <DetailRow label="Check-out Time" value={formatTime(checkOut)} />
                <DetailRow label="Duration" value={duration} />
                {record.status === 'on_leave' && (
                  <DetailRow
                    label="Leave"
                    value={
                      leaveLink ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/leaves/${leaveLink._id ?? leaveLink.id ?? ''}`)
                          }
                          className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) hover:underline"
                        >
                          View covering leave ({leaveLink.status ?? 'leave'})
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        'No covering leave found'
                      )
                    }
                  />
                )}
              </DetailList>
            </DetailCard>
          </div>

          <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
            <AttendanceMonthCalendar
              days={calendarDays}
              initialYear={recordMonth.getFullYear()}
              initialMonth={recordMonth.getMonth()}
              selectedDay={recordYmd}
              onSelectDay={(ymd) => {
                if (ymd && ymd !== recordYmd) goToDate(ymd);
              }}
              onMonthChange={(y, m) => setSummaryNav({ id: record._id, year: y, month: m })}
            />
          </div>

          <DetailCard title="Recording Info" icon={<CheckCircle />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <div className="flex items-center gap-3">
                  {methodIcon}
                  <div>
                    <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                      Method
                    </p>
                    <p className="text-13 font-semibold text-(--color-text-primary)">
                      {methodLabel}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-(--color-text-muted)" />
                  <div>
                    <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                      Recorded By
                    </p>
                    <p className="text-13 font-semibold text-(--color-text-primary)">
                      {record.recordedBy?.name ?? 'System'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          {record.notes && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                {record.notes}
              </p>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-(--color-text-muted)">
            Recorded {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)}
          </p>

          <ConfirmModal
            open={confirmDeleteOpen}
            title="Delete Attendance Record"
            message="Are you sure you want to delete this attendance record? This action cannot be undone."
            loading={isDeleting}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDeleteOpen(false)}
          />
        </div>
      )}
    </FormPage>
  );
}
