'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hash,
  MapPin,
  Pencil,
  QrCode,
  Smartphone,
  Timer,
  Trash2,
  User,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson, type ApiQueryError } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import {
  AttendanceMonthCalendar,
  type AttendanceDayMap,
} from '@/components/ui/AttendanceMonthCalendar';
import type { IAttendanceSummaryResponse } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of an API response, never invented:
//   GET /attendance/:id     apps/api/src/routes/attendance.ts:564-615
//   GET /attendance         apps/api/src/routes/attendance.ts:296-402
//   GET /attendance/summary apps/api/src/routes/attendance.ts:493-561
//   GET /tenants/:id        apps/api/src/routes/tenants.ts:486-502
//   GET /audit-logs         apps/api/src/routes/audit.ts:13-52
//   GET /leaves             apps/api/src/routes/leaves.ts

interface AttendanceDetail {
  _id: string;
  tenant?: {
    _id?: string;
    user?: { _id?: string; name?: string; email?: string; phone?: string } | null;
    room?: { _id?: string; roomNumber?: string } | null;
  } | null;
  tenantId?: unknown;
  date: string;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  method?: string;
  recordedBy?: { _id?: string; name?: string } | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface TenantRow {
  _id: string;
  user?: { name?: string } | null;
  room?: { roomNumber?: string } | null;
  bedId?: string | null;
  isActive?: boolean;
  moveInDate?: string | null;
  moveOutDate?: string | null;
}

interface AuditEntry {
  _id: string;
  action: string;
  userId?: { name?: string } | null;
  timestamp?: string;
  details?: Record<string, unknown>;
}

// ── Constants ──────────────────────────────────────────────────────────

/** The page size the API allows (parsePagination clamps the limit to 100). */
const PAGE_SIZE = 100;
/** How many days back the pattern of a resident is read. */
const PATTERN_WINDOW_DAYS = 90;

const STATUS_LABELS: Record<string, string> = {
  present: 'present',
  absent: 'absent',
  on_leave: 'on leave',
  not_returned: 'not returned',
};

const ATTENDANCE_DETAIL_KEY = ['attendance', 'detail'] as const;
const ATTENDANCE_HISTORY_KEY = ['attendance', 'history'] as const;
const ATTENDANCE_SUMMARY_KEY = ['attendance', 'summary'] as const;
const ATTENDANCE_AUDIT_KEY = ['attendance', 'audit'] as const;
const LEAVES_BY_TENANT_KEY = ['leaves', 'by-tenant'] as const;

const EMPTY_ROWS: AttendanceDetail[] = [];

// ── Helpers ────────────────────────────────────────────────────────────

/** The id of the resident a record belongs to, in whichever shape it arrives. */
function tenantIdOfRecord(record: AttendanceDetail): string {
  const mapped = record.tenant?._id;
  if (mapped !== undefined && mapped !== '') return mapped;
  const raw = record.tenantId as { _id?: unknown; id?: unknown } | string | null | undefined;
  if (typeof raw === 'string') return raw;
  const id = raw?._id ?? raw?.id;
  return id === undefined || id === null ? '' : String(id);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function durationBetween(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '-';
  try {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    if (Number.isNaN(diff) || diff < 0) return 'Invalid (out before in)';
    const mins = Math.floor(diff / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  } catch {
    return '-';
  }
}

/** A day shifted by a number of days, as the server spells a day. */
function shiftYmd(ymd: string, delta: number): string {
  const date = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + delta);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Every day of a range, as the server spells a day. */
function daysBetween(fromYmd: string, toYmd: string): string[] {
  const days: string[] = [];
  let cursor = fromYmd;
  for (let guard = 0; guard < 400 && cursor <= toYmd; guard += 1) {
    days.push(cursor);
    cursor = shiftYmd(cursor, 1);
  }
  return days;
}

function methodLabel(method: string | undefined): string {
  if (method === 'manual') return 'Manual entry';
  if (method === 'qr') return 'QR scan';
  if (method === 'app') return 'Mobile app';
  return 'Unknown';
}

function checkInOf(row: AttendanceDetail): string | null {
  return row.checkInTime ?? row.checkIn ?? null;
}

function checkOutOf(row: AttendanceDetail): string | null {
  return row.checkOutTime ?? row.checkOut ?? null;
}

/**
 * Walks every page of a list endpoint.
 *
 * The server clamps one page to 100 rows (apps/api/src/lib/routeUtils.ts:16),
 * so a set that is bigger than one page has to be walked.
 */
async function walkPages<T>(
  path: string,
  params: URLSearchParams,
): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = [];
  let total = 0;
  let page = 1;
  for (;;) {
    const pageParams = new URLSearchParams(params.toString());
    pageParams.set('page', String(page));
    pageParams.set('limit', String(PAGE_SIZE));
    const body = await queryJson<{
      success: boolean;
      data: T[];
      meta?: { total?: number; totalPages?: number };
    }>(`${path}?${pageParams.toString()}`);
    const pageRows = body.data ?? [];
    total = body.meta?.total ?? total;
    rows.push(...pageRows);
    const totalPages = body.meta?.totalPages ?? 1;
    if (page >= totalPages || pageRows.length === 0) break;
    page += 1;
  }
  return { rows, total };
}

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const id = params?.id ?? '';

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
  } = useApiQuery<AttendanceDetail>([...ATTENDANCE_DETAIL_KEY, id], `attendance/${id}`, {
    enabled: id !== '',
  });
  const record = data ?? null;

  const tenantId = record ? tenantIdOfRecord(record) : '';
  const recordYmd = record ? record.date.slice(0, 10) : '';
  // Mount-stable clock read (react/purity): the loading fallback must not recompute per render.
  const [fallbackNow] = useState(() => new Date());
  const recordMonth = record ? new Date(`${recordYmd}T00:00:00`) : fallbackNow;

  const activeMonth =
    summaryNav && record && summaryNav.id === record._id
      ? { year: summaryNav.year, month: summaryNav.month }
      : { year: recordMonth.getFullYear(), month: recordMonth.getMonth() };

  const summaryQuery = useApiQuery<IAttendanceSummaryResponse>(
    [...ATTENDANCE_SUMMARY_KEY, activeMonth.year, activeMonth.month, tenantId],
    (() => {
      const last = new Date(activeMonth.year, activeMonth.month + 1, 0).getDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      const from = `${activeMonth.year}-${pad(activeMonth.month + 1)}-01`;
      const to = `${activeMonth.year}-${pad(activeMonth.month + 1)}-${pad(last)}`;
      const params = new URLSearchParams({ fromDate: from, toDate: to });
      if (tenantId !== '') params.set('tenantId', tenantId);
      return `attendance/summary?${params.toString()}`;
    })(),
    { enabled: tenantId !== '' },
  );
  const calendarDays: AttendanceDayMap = summaryQuery.data?.days ?? {};

  /**
   * The resident, read for the stay the pattern sits in.
   *
   * A resident who moved in halfway through the window did not miss the days
   * before they arrived, so the window starts at their move-in date.
   */
  const tenantQuery = useApiQuery<TenantRow>(
    ['tenants', 'attendance-resident', tenantId],
    `tenants/${tenantId}`,
    { enabled: tenantId !== '' },
  );
  const resident = tenantQuery.data ?? null;
  // The day the resident moved in, read once so the pattern below does not depend on the
  // record object, which is a new object on every read.
  const residentMoveIn = resident?.moveInDate ?? '';

  /**
   * The days of this resident in the window.
   *
   * The window is the ninety days up to and including the day of the record,
   * and the server is asked for the records of that resident and that window.
   */
  const historyQuery = useQuery<{ rows: AttendanceDetail[]; total: number }, ApiQueryError>({
    queryKey: [...ATTENDANCE_HISTORY_KEY, tenantId, recordYmd],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('fromDate', shiftYmd(recordYmd, -(PATTERN_WINDOW_DAYS - 1)));
      params.set('toDate', recordYmd);
      return walkPages<AttendanceDetail>('attendance', params);
    },
    enabled: tenantId !== '' && recordYmd !== '',
  });
  const historyRows = useMemo(() => historyQuery.data?.rows ?? EMPTY_ROWS, [historyQuery.data]);

  /**
   * The write trail of this record.
   *
   * The audit route filters by the record (apps/api/src/routes/audit.ts:19-24),
   * so this is the trail of this record and not of every record. The server
   * keeps the entries for ninety days.
   */
  const auditQuery = useApiQuery<AuditEntry[]>(
    [...ATTENDANCE_AUDIT_KEY, id],
    `audit-logs?resource=attendance&resourceId=${id}&limit=20`,
    { enabled: id !== '' },
  );

  const leaveQuery = useApiQuery<LeaveRow[]>(
    [...LEAVES_BY_TENANT_KEY, tenantId],
    `leaves?tenantId=${tenantId}&limit=50`,
    { enabled: tenantId !== '' && record?.status === 'on_leave' },
  );
  const leaveLink =
    record?.status === 'on_leave' && leaveQuery.data
      ? findCoveringLeave(leaveQuery.data, recordYmd)
      : null;

  /**
   * The pattern of this resident.
   *
   * The counts are the server's rows over the window. The days with no record
   * are the days of the window the server holds nothing for, so they are read
   * out of the same window.
   */
  // The pattern of the resident's days over the window. It is a few filters
  // over the rows the server holds, so it is computed rather than memoised.
  const pattern = (() => {
    const windowEnd = recordYmd;
    const windowStart = shiftYmd(recordYmd, -(PATTERN_WINDOW_DAYS - 1));
    const moveIn = residentMoveIn ? residentMoveIn.slice(0, 10) : '';
    const stayStart = moveIn !== '' && moveIn > windowStart ? moveIn : windowStart;

    const rows = historyRows;
    const present = rows.filter((row) => row.status === 'present');
    const absences = rows.filter((row) => row.status === 'absent');
    const leaveDays = rows.filter((row) => row.status === 'on_leave');
    const notReturned = rows.filter((row) => row.status === 'not_returned');
    // The resident came back but the day still says they did not.
    const cameBack = notReturned.filter(
      (row) => checkInOf(row) !== null || checkOutOf(row) !== null,
    );
    // The day was never finished: the resident signed in and nobody signed them out.
    const openDays = present.filter((row) => checkInOf(row) !== null && checkOutOf(row) === null);

    const marked = new Set(rows.map((row) => row.date.slice(0, 10)));
    const unmarked = daysBetween(stayStart, windowEnd).filter((day) => !marked.has(day));

    return {
      windowStart: stayStart,
      windowEnd,
      windowDays: daysBetween(stayStart, windowEnd).length,
      total: rows.length,
      present,
      absences,
      leaveDays,
      notReturned,
      cameBack,
      openDays,
      unmarked,
    };
  })();

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`attendance/${id}`).json();
      // The day, the month calendar and the resident history all lose the day.
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
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
      if (tenantId !== '') params.set('tenantId', tenantId);
      const res = await api.get(`attendance?${params.toString()}`).json<{
        success: boolean;
        data: Array<{ _id: string }>;
      }>();
      const first = (res.data ?? [])[0];
      if (first) router.push(`/attendance/${first._id}`);
      else setNavError(`This resident has no attendance record on ${formatShortDate(target)}.`);
    } catch {
      setNavError('Failed to navigate to the adjacent day.');
    }
  };

  const goDay = async (delta: number) => {
    if (!record) return;
    await goToDate(shiftYmd(recordYmd, delta));
  };

  const loadError = errorMessage(queryError) || error;

  if (!isLoading && (loadError !== '' || !record)) {
    return (
      <FormPage
        title="Attendance record"
        description="View attendance details"
        backHref="/attendance"
        error={loadError !== '' ? loadError : 'The server holds no attendance record with this id.'}
        maxWidth="full"
      />
    );
  }

  const statusVariant = record ? statusToVariant(record.status) : 'neutral';
  const tenantName = record?.tenant?.user?.name ?? resident?.user?.name ?? 'Unknown resident';
  const roomNumber = record?.tenant?.room?.roomNumber ?? resident?.room?.roomNumber ?? 'no room';
  const bedId = resident?.bedId ?? '';
  const checkIn = record ? checkInOf(record) : null;
  const checkOut = record ? checkOutOf(record) : null;
  const duration = durationBetween(checkIn, checkOut);

  return (
    <FormPage
      title="Attendance record"
      description={record ? `${tenantName} · Room ${roomNumber}` : 'View attendance details'}
      backHref="/attendance"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        record ? (
          <StatusBadge
            variant={statusVariant}
            label={STATUS_LABELS[record.status] ?? record.status}
          />
        ) : undefined
      }
      actions={
        record ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void goDay(-1)}
              aria-label="The previous day of this resident"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void goDay(1)}
              aria-label="The next day of this resident"
            >
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

          {/* The record itself: the protagonist of this page. */}
          <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  The day
                </p>
                <h2 className="font-display text-xl font-bold tracking-tight text-(--color-text-primary)">
                  {formatDate(record.date)}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-(--color-text-secondary)">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {tenantId !== '' ? (
                      <Link
                        href={`/tenants/${tenantId}`}
                        className="font-semibold text-(--color-brand-600) hover:underline"
                      >
                        {tenantName}
                      </Link>
                    ) : (
                      tenantName
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    Room {roomNumber}
                  </span>
                  {bedId !== '' && (
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      Bed {bedId}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge
                  variant={statusVariant}
                  label={STATUS_LABELS[record.status] ?? record.status}
                />
                <span className="text-2xs font-medium text-(--color-text-muted)">
                  {methodLabel(record.method)}
                </span>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Check in
                </dt>
                <dd className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {formatTime(checkIn)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Check out
                </dt>
                <dd className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {formatTime(checkOut)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Duration
                </dt>
                <dd className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {duration}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Recorded by
                </dt>
                <dd className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {record.recordedBy?.name ?? 'The gate (the resident checked in)'}
                </dd>
              </div>
            </dl>

            {record.notes !== undefined && record.notes !== '' && (
              <p className="text-13 mt-4 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2 font-medium text-(--color-text-secondary)">
                <FileText className="mr-1 inline h-3.5 w-3.5" />
                {record.notes}
              </p>
            )}

            {record.status === 'on_leave' && (
              <p className="text-2xs mt-4 font-medium text-(--color-text-secondary)">
                {leaveLink ? (
                  <>
                    A leave covers this day.{' '}
                    <Link
                      href={`/leaves/${leaveLink._id ?? leaveLink.id ?? ''}`}
                      className="font-bold text-(--color-brand-600) hover:underline"
                    >
                      Open the leave ({leaveLink.status ?? 'leave'})
                    </Link>
                    . Approving a leave is what wrote this row: the server marks every day of the
                    range as on leave unless the resident was on site that day.
                  </>
                ) : (
                  'No leave covers this day. The server writes an on-leave row when a leave is approved, so this row was written by hand: the notes should say which leave it belongs to.'
                )}
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* The pattern of the resident: what the days mean. */}
            <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
              <h2 className="font-display flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
                <UserRound className="h-4 w-4 text-(--color-brand-600)" />
                The days of this resident
              </h2>
              <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                The {pattern.windowDays} days from {formatShortDate(pattern.windowStart)} to{' '}
                {formatShortDate(pattern.windowEnd)}
                {resident?.moveInDate
                  ? `, the stay of the resident. The server holds ${pattern.total} record${
                      pattern.total === 1 ? '' : 's'
                    } for them in that window.`
                  : '. The server holds the records it holds.'}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PatternCount label="Present" value={pattern.present.length} tone="success" />
                <PatternCount label="Absent" value={pattern.absences.length} tone="danger" />
                <PatternCount label="On leave" value={pattern.leaveDays.length} tone="brand" />
                <PatternCount
                  label="Not returned"
                  value={pattern.notReturned.length}
                  tone="warning"
                />
              </dl>

              <div className="mt-5 space-y-4">
                <PatternGroup
                  title="The days the resident was absent"
                  empty="The resident has no absent day in this window."
                  rows={pattern.absences.map((row) => ({
                    key: row._id,
                    date: row.date,
                    detail:
                      row.notes !== undefined && row.notes !== ''
                        ? row.notes
                        : 'no note on the record',
                    href: `/attendance/${row._id}`,
                  }))}
                />
                <PatternGroup
                  title="The days the resident did not come back"
                  empty="The resident has no not-returned day in this window."
                  rows={pattern.notReturned.map((row) => {
                    const checkIn = checkInOf(row);
                    const checkOut = checkOutOf(row);
                    const cameBack = checkIn !== null || checkOut !== null;
                    return {
                      key: row._id,
                      date: row.date,
                      detail: cameBack
                        ? `the resident ${checkOut !== null ? `signed out at ${formatTime(checkOut)}` : `signed in at ${formatTime(checkIn)}`} - the mark and the times disagree`
                        : 'nobody signed the resident in or out',
                      href: `/attendance/${row._id}`,
                      warning: cameBack,
                    };
                  })}
                />
                {pattern.cameBack.length > 0 && (
                  <p className="text-2xs -mt-2 font-semibold text-(--color-warning-700)">
                    {pattern.cameBack.length} of these days carry a sign-in or a sign-out: the
                    resident came back and the mark still says they did not.
                  </p>
                )}
                <PatternGroup
                  title="The days the resident was on leave"
                  empty="The resident has no leave day in this window."
                  rows={pattern.leaveDays.map((row) => ({
                    key: row._id,
                    date: row.date,
                    detail:
                      row.notes !== undefined && row.notes !== ''
                        ? row.notes
                        : 'written by a leave approval',
                    href: `/attendance/${row._id}`,
                  }))}
                />
                <PatternGroup
                  title="The days with a sign-in and no sign-out"
                  empty="Every day of the window the resident signed in on was signed out on."
                  rows={pattern.openDays.map((row) => ({
                    key: row._id,
                    date: row.date,
                    detail: `in at ${formatTime(checkInOf(row))}, no sign out`,
                    href: `/attendance/${row._id}`,
                    warning: true,
                  }))}
                />
                <PatternGroup
                  title="The days nobody marked for this resident"
                  empty="Every day of the window holds a record for this resident."
                  rows={pattern.unmarked.map((day) => ({
                    key: day,
                    date: day,
                    detail: 'no record at all for this resident',
                    href: `/attendance/new?tenantId=${tenantId}&date=${day}`,
                  }))}
                  limit={8}
                />
              </div>

              <div className="text-2xs mt-5 space-y-1 border-t border-(--border-color) pt-3 font-medium text-(--color-text-muted)">
                <p>
                  <strong className="text-(--color-text-secondary)">What these days mean.</strong> A
                  mark is a statement about one day of one resident. Nothing in the server reads an
                  attendance mark when it raises a bill: what a resident owes comes from the rent on
                  their own record (apps/api/src/services/invoice.service.ts:97). An absent day
                  therefore changes no charge.
                </p>
                <p>
                  <strong className="text-(--color-text-secondary)">The resident sees this.</strong>{' '}
                  The portal reads the same records, so the resident finds the mark in their own
                  history the next time they open the app. No message is sent: the server writes an
                  audit entry and stops there.
                </p>
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
                <AttendanceMonthCalendar
                  days={calendarDays}
                  initialYear={recordMonth.getFullYear()}
                  initialMonth={recordMonth.getMonth()}
                  selectedDay={recordYmd}
                  onSelectDay={(ymd) => {
                    if (ymd && ymd !== recordYmd) void goToDate(ymd);
                  }}
                  onMonthChange={(year, month) => setSummaryNav({ id: record._id, year, month })}
                />
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The month of this resident. A day you pick opens their record for that day.
                </p>
              </section>

              <DetailCard title="This record on the server" icon={<Clock />} compact>
                <ul className="text-2xs space-y-1 font-medium text-(--color-text-secondary)">
                  <li>Written {formatDateTime(record.createdAt)}</li>
                  <li>Last changed {formatDateTime(record.updatedAt)}</li>
                  <li>
                    Method: {methodLabel(record.method)}
                    {record.method === 'qr' ? (
                      <QrCode className="ml-1 inline h-3 w-3" />
                    ) : record.method === 'app' ? (
                      <Smartphone className="ml-1 inline h-3 w-3" />
                    ) : null}
                  </li>
                </ul>
              </DetailCard>
            </div>
          </div>

          {/* The write trail of this record: the proof of what the office did. */}
          <DetailCard
            title="What the office did to this record"
            icon={<FileText />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditQuery.data?.length ?? 0} entries
              </span>
            }
          >
            {!auditQuery.data || auditQuery.data.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no write entry for this record in the entries it keeps (the entries
                expire after 90 days).
              </p>
            ) : (
              <ul className="space-y-2">
                {auditQuery.data.map((entry) => (
                  <li
                    key={entry._id}
                    className="flex flex-col gap-0.5 border-b border-(--border-color) pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={
                          entry.action === 'delete'
                            ? 'danger'
                            : entry.action === 'create'
                              ? 'success'
                              : 'neutral'
                        }
                        label={entry.action.replace(/_/g, ' ')}
                      />
                      <span className="text-2xs font-semibold text-(--color-text-primary)">
                        {entry.userId?.name ?? 'The office'}
                      </span>
                      <span className="text-2xs font-medium text-(--color-text-muted)">
                        {formatDateTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      {auditSummary(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>

          <p className="text-right text-xs font-semibold text-(--color-text-muted)">
            <Timer className="mr-1 inline h-3.5 w-3.5" />
            The portal shows this day to the resident as it is. Nothing in this module sends them a
            message.
          </p>

          <ConfirmModal
            open={confirmDeleteOpen}
            title="Delete the attendance record"
            message={`The server removes the record of ${tenantName} for ${formatShortDate(record.date)}, writes a delete entry in the audit log and sends no message. The day disappears from the resident history and from the day count at once. It cannot be undone.`}
            confirmLabel="Delete the record"
            loading={isDeleting}
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmDeleteOpen(false)}
          />
        </div>
      )}
    </FormPage>
  );
}

// ── Small parts ────────────────────────────────────────────────────────

interface PatternCountProps {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'warning' | 'brand';
}

const patternTone: Record<PatternCountProps['tone'], string> = {
  success: 'text-(--color-success-600)',
  danger: 'text-(--color-danger-600)',
  warning: 'text-(--color-warning-600)',
  brand: 'text-(--color-brand-600)',
};

function PatternCount({ label, value, tone }: PatternCountProps) {
  return (
    <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2">
      <dt className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
        {label}
      </dt>
      <dd className={`font-display text-15 mt-0.5 font-bold tabular-nums ${patternTone[tone]}`}>
        {value}
      </dd>
    </div>
  );
}

interface PatternRow {
  key: string;
  date: string;
  detail: string;
  href: string;
  warning?: boolean;
}

interface PatternGroupProps {
  title: string;
  empty: string;
  rows: PatternRow[];
  limit?: number;
}

/**
 * One group of days: the days themselves and what is wrong with them.
 *
 * The link is the next step for the office: the record of the day, or the
 * form that writes the day that is missing.
 */
function PatternGroup({ title, empty, rows, limit }: PatternGroupProps) {
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <div>
      <p className="text-13 font-bold text-(--color-text-primary)">
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">{empty}</p>
      ) : (
        <>
          <ul className="mt-1.5 space-y-1">
            {shown.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-1.5"
              >
                <span className="text-2xs font-semibold text-(--color-text-primary)">
                  {formatShortDate(row.date)}
                </span>
                <span
                  className={`text-2xs font-medium ${
                    row.warning === true
                      ? 'text-(--color-warning-700)'
                      : 'text-(--color-text-secondary)'
                  }`}
                >
                  {row.detail}
                </span>
                <Link
                  href={row.href}
                  className="text-2xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                >
                  {row.href.includes('/new') ? 'Mark the day' : 'Open the record'}
                </Link>
              </li>
            ))}
          </ul>
          {shown.length < rows.length && (
            <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
              {rows.length - shown.length} more day(s) of the same kind are in the window.
            </p>
          )}
        </>
      )}
    </div>
  );
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

/** Leave whose range covers the given day, or null when none matches. */
function findCoveringLeave(rows: LeaveRow[], ymd: string): LeaveRow | null {
  return (
    rows.find((row) => {
      const from = (row.fromDate ?? row.startDate ?? '').slice(0, 10);
      const to = (row.toDate ?? row.endDate ?? '').slice(0, 10);
      return from !== '' && to !== '' && from <= ymd && ymd <= to;
    }) ?? null
  );
}

/** What one write entry of the audit log says. */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  const status = typeof details.status === 'string' ? details.status : '';
  const date = typeof details.date === 'string' ? details.date : '';
  if (entry.action === 'create') {
    return `A record was written${status !== '' ? ` with the status ${status}` : ''}${
      date !== '' ? ` for ${date}` : ''
    }. The server sent no message to the resident.`;
  }
  if (entry.action === 'update') {
    return `The record was corrected${status !== '' ? ` to the status ${status}` : ''}${
      date !== '' ? ` for ${date}` : ''
    }. The server sent no message to the resident.`;
  }
  if (entry.action === 'delete') {
    return `The record was deleted${date !== '' ? ` for ${date}` : ''}. The server sent no message to the resident.`;
  }
  return 'The office wrote this record. The server sent no message to the resident.';
}
