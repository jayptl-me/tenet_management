'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Ban,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Home,
  Info,
  ListChecks,
  MessageCircle,
  Phone,
  User,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormPage } from '@/components/ui/FormPage';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusStepper } from '@/components/ui/StatusStepper';
import { Textarea } from '@/components/ui/Textarea';
import { copyToClipboard, generateWhatsAppUrl } from '@/lib/whatsapp';

// ── Shapes ────────────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET  /leaves/:id                      apps/api/src/routes/leaves.ts:450-494
//   GET  /attendance?tenantId&fromDate    apps/api/src/routes/attendance.ts:296-402
//   GET  /notifications?type=service_update apps/api/src/routes/notifications.ts:26-54
//   GET  /audit-logs?resource=leave_application apps/api/src/routes/audit.ts:13-52
//   GET  /tenants/:id                     apps/api/src/routes/tenants.ts:486-500

interface LeaveTenant {
  _id?: string;
  bedId?: string | null;
  user?: { _id?: string; name?: string; email?: string; phone?: string } | null;
  room?: { _id?: string; roomNumber?: string; floor?: { label?: string } | null } | null;
}

interface LeaveDetail {
  _id: string;
  tenant?: LeaveTenant | null;
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  adminNotes?: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AttendanceRow {
  _id?: string;
  date?: string;
  status?: string;
  method?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string;
  recordedBy?: { _id?: string; name?: string } | null;
}

interface NotificationRow {
  _id?: string;
  id?: string;
  title?: string;
  body?: string;
  type?: string;
  data?: { leaveId?: string; status?: string };
  sentAt?: string;
  createdAt?: string;
  unreadBy?: string[];
  recipientUserIds?: string[];
}

interface NotificationsBody {
  success: boolean;
  data: NotificationRow[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { _id?: string; name?: string; role?: string } | null;
}

interface TenantRow {
  _id: string;
  monthlyRent?: number;
  isActive?: boolean;
  bedId?: string | null;
  room?: { roomNumber?: string; floor?: { label?: string } | null } | null;
  user?: { name?: string; phone?: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The attendance rows the server serves in one page. */
const ATTENDANCE_LIMIT = 100;

/** The service updates the server lists for the notification panel. */
const NOTIFICATION_LIMIT = 100;

/** The first day of the window. */
function fromOf(leave: LeaveDetail): string {
  return leave.fromDate ?? leave.startDate ?? '';
}

/** The last day of the window. */
function toOf(leave: LeaveDetail): string {
  return leave.toDate ?? leave.endDate ?? '';
}

/**
 * The days of the window, counted the way the server counts them: the first
 * day and the last day are both inside the window (leaves.ts:17-26).
 */
function inclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Every day of the window, as the calendar strings the server stores. */
function eachDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShort(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `₹${value.toLocaleString('en-IN')}`;
}

/** The attendance state of one day, as the operator reads it. */
function attendanceTone(status: string | undefined, checkIn: string | null | undefined): string {
  if (status === 'present' && checkIn) {
    return 'border-(--color-success-300) bg-(--color-success-100) text-(--color-success-800)';
  }
  if (status === 'on_leave') {
    return 'border-(--color-brand-300) bg-(--color-brand-100) text-(--color-brand-800)';
  }
  if (status === 'absent' || status === 'not_returned') {
    return 'border-(--color-danger-300) bg-(--color-danger-100) text-(--color-danger-800)';
  }
  return 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary)';
}

/** The word the office uses for an attendance state. */
function attendanceLabel(status: string | undefined): string {
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'on_leave':
      return 'On leave';
    case 'not_returned':
      return 'Not returned';
    default:
      return 'No record';
  }
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function LeaveDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const queryClient = useQueryClient();

  const [actionBusy, setActionBusy] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  /**
   * The leave itself.
   *
   * The payload is read with the shared query stack, and the record is re-read
   * from the server after every write, so the page shows what the server
   * holds and not what the office believes it wrote.
   */
  const {
    data: rawLeave,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<LeaveDetail>(['leaves', 'detail', id], `leaves/${id}`, { enabled: !!id });

  const leave: LeaveDetail | null =
    rawLeave && typeof rawLeave === 'object' && !Array.isArray(rawLeave) ? rawLeave : null;

  const from = leave ? fromOf(leave) : '';
  const to = leave ? toOf(leave) : '';
  const days = leave ? inclusiveDays(from, to) : 0;
  const tenantId = leave?.tenant?._id ?? '';
  const residentUserId = leave?.tenant?.user?._id ?? '';
  const status = leave?.status ?? '';
  const isPending = status === 'pending';
  const windowDays = useMemo(() => (from && to ? eachDateInclusive(from, to) : []), [from, to]);
  /**
   * The attendance records of the window.
   *
   * These are the records the leave wrote: the server marks each day of an
   * approved leave as on_leave, and a day with a real on-site check-in is kept
   * (leaves.ts:33-79).
   */
  const {
    data: attendance,
    isPending: attendancePending,
    isFetching: attendanceFetching,
  } = useApiQuery<AttendanceRow[]>(
    ['leaves', 'attendance', tenantId, from, to],
    `attendance?tenantId=${encodeURIComponent(tenantId)}&fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}&limit=${ATTENDANCE_LIMIT}`,
    { enabled: !!tenantId && !!from && !!to },
  );

  // A query that never ran is not a query that is loading.
  const attendanceLoading = attendancePending && attendanceFetching;

  /**
   * The notification the resident received.
   *
   * The API pushes a service_update notification on every decision and carries
   * the reason in the body (leaves.ts:180-219). The admin can read the
   * notification the server holds, so the office can see whether the resident
   * was told at all.
   */
  const { data: notifications } = useApiBodyQuery<NotificationsBody>(
    ['leaves', 'notifications', id],
    `notifications?type=service_update&limit=${NOTIFICATION_LIMIT}`,
    { enabled: !!id && !isPending },
  );

  const notificationTotal = notifications?.meta?.total ?? 0;

  const notification = useMemo(() => {
    const rows = notifications?.data;
    if (!Array.isArray(rows)) return null;
    return rows.find((row) => row?.data?.leaveId === id) ?? null;
  }, [notifications, id]);

  /** The write trail of this leave. The server keeps the entries for 90 days. */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    ['leaves', 'audit', id],
    `audit-logs?resource=leave_application&resourceId=${encodeURIComponent(id)}&limit=20`,
    { enabled: !!id },
  );

  /** The resident on the record: the rent is raised from this record. */
  const { data: tenant } = useApiQuery<TenantRow>(
    ['leaves', 'tenant', tenantId],
    `tenants/${tenantId}`,
    {
      enabled: !!tenantId,
    },
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leaves'] });
  };

  const runDecision = async (action: 'approve' | 'reject' | 'cancel') => {
    if (!leave) return;
    setActionBusy(action);
    setActionError('');
    try {
      if (action === 'approve') {
        const res = await api
          .put(`leaves/${leave._id}/approve`, { json: {} })
          .json<{ success: boolean; data: LeaveDetail }>();
        setWriteResult(
          `Approved. The server set the status to approved${
            res.data?.approvedByName ? ` by ${res.data.approvedByName}` : ''
          }${res.data?.approvedAt ? ` on ${formatDate(res.data.approvedAt)}` : ''} and marked the days of the window as on leave on the attendance board. A service_update notification was pushed to the resident.`,
        );
      } else if (action === 'reject') {
        await api
          .put(`leaves/${leave._id}/reject`, { json: { adminNotes: rejectNotes.trim() } })
          .json<{ success: boolean; data: LeaveDetail }>();
        setWriteResult(
          `Rejected. The server set the status to rejected, kept the reason in the office notes and pushed a service_update notification to the resident: the reason travels in the body of that message.`,
        );
        setShowReject(false);
        setRejectNotes('');
      } else {
        await api.post(`leaves/${leave._id}/cancel`, { json: {} }).json();
        setWriteResult(
          'Cancelled. The server set the status to cancelled, wrote the entry in the audit log and pushed a service_update notification to the resident: the body says the leave was cancelled by the PG office.',
        );
      }
      refresh();
    } catch (err) {
      // The server's answer is the one that matters: it refuses with
      // LEAVE_NOT_PENDING or OVERLAPPING_LEAVE.
      setActionError((await parseApiError(err)).message);
    } finally {
      setActionBusy(null);
      setConfirmCancel(false);
    }
  };

  if (!isLoading && (queryError || !leave)) {
    return (
      <FormPage
        title="Leave request"
        description="One leave application"
        backHref="/leaves"
        error={errorMessage(queryError) || 'The server reports no leave for this id.'}
        maxWidth="full"
      />
    );
  }

  const tenantName = leave?.tenant?.user?.name ?? 'Unknown resident';
  const roomNumber = leave?.tenant?.room?.roomNumber ?? 'No room';
  const bedId = leave?.tenant?.bedId ?? null;
  const floorLabel = leave?.tenant?.room?.floor?.label ?? null;
  const tenantPhone = leave?.tenant?.user?.phone;
  const attendanceRows = Array.isArray(attendance) ? attendance : [];
  const residentHasNotRead =
    notification !== null && residentUserId !== ''
      ? (notification.unreadBy ?? []).includes(residentUserId)
      : false;
  const markedOnLeave = attendanceRows.filter((row) => row.status === 'on_leave').length;
  const preservedCheckIns = attendanceRows.filter(
    (row) => row.status === 'present' && (row.checkIn ?? row.checkInTime),
  ).length;

  return (
    <FormPage
      title="Leave request"
      description={
        leave
          ? `${tenantName} · Room ${roomNumber}${bedId ? ` · Bed ${bedId}` : ''} · ${days} day${days === 1 ? '' : 's'}`
          : 'One leave application'
      }
      backHref="/leaves"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        leave ? (
          <StatusBadge variant={statusToVariant(status)} label={status.replace(/_/g, ' ')} />
        ) : undefined
      }
      actions={
        leave && isPending ? (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={actionBusy === 'approve'}
              disabled={actionBusy !== null}
              onClick={() => void runDecision('approve')}
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionBusy !== null}
              onClick={() => {
                setShowReject(true);
                setActionError('');
              }}
            >
              <X className="h-4 w-4" />
              Reject with a reason
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionBusy !== null}
              onClick={() => setConfirmCancel(true)}
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : leave ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/leaves/${leave._id}/edit`)}
          >
            <FileText className="h-4 w-4" />
            Open the review
          </Button>
        ) : undefined
      }
    >
      {leave && (
        <ContentFrame
          rail={
            <>
              <DetailCard title="The resident" icon={<User />}>
                <DetailList>
                  <DetailRow
                    label="Name"
                    value={
                      tenantId ? (
                        <Link
                          href={`/tenants/${tenantId}`}
                          className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
                        >
                          {tenantName}
                          <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        </Link>
                      ) : (
                        tenantName
                      )
                    }
                  />
                  <DetailRow
                    label="Room"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Home className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {roomNumber}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Bed"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {bedId ?? 'No bed'}
                      </span>
                    }
                  />
                  {floorLabel && (
                    <DetailRow
                      label="Floor"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {floorLabel}
                        </span>
                      }
                    />
                  )}
                  {tenantPhone && (
                    <DetailRow
                      label="Phone"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {tenantPhone}
                        </span>
                      }
                    />
                  )}
                  <DetailRow
                    label="Rent of the record"
                    value={
                      tenant && typeof tenant.monthlyRent === 'number'
                        ? `${fmtMoney(tenant.monthlyRent)}/mo`
                        : 'not reported'
                    }
                  />
                </DetailList>
                {tenantPhone && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-(--border-color) pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(
                          generateWhatsAppUrl(
                            tenantPhone,
                            `Hi ${tenantName}, your leave from ${from} to ${to} is ${status.replace(
                              /_/g,
                              ' ',
                            )}.`,
                          ),
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                      title="Opens a chat you have to send yourself. The server tells the resident through the portal notification above."
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message by hand
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void copyToClipboard(
                          `${tenantName} | Room ${roomNumber}${bedId ? ` Bed ${bedId}` : ''} | Leave ${from} to ${to} | ${status}${leave.adminNotes ? ` | ${leave.adminNotes}` : ''}`,
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                      Copy the summary
                    </Button>
                  </div>
                )}
              </DetailCard>

              <DetailCard
                title="What the resident was told"
                icon={<MessageCircle />}
                variant={notification ? 'success' : 'warning'}
              >
                {notification ? (
                  <>
                    <p className="text-sm font-bold text-(--color-text-primary)">
                      {notification.title ?? 'A service update'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-(--color-text-secondary)">
                      {notification.body ?? ''}
                    </p>
                    <p className="text-2xs mt-2 font-semibold text-(--color-text-muted)">
                      Pushed {formatDateTime(notification.sentAt ?? notification.createdAt)} ·{' '}
                      {residentHasNotRead
                        ? 'the resident has not opened it yet'
                        : 'the resident has opened it'}
                    </p>
                  </>
                ) : isPending ? (
                  <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                    Nothing yet: the request is waiting for an answer. The server pushes a
                    service_update notification to the resident on every decision, and the reason
                    travels in the body of that message.
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                    The server holds no notification for this leave among the {NOTIFICATION_LIMIT}{' '}
                    most recent service updates it lists
                    {notificationTotal > NOTIFICATION_LIMIT
                      ? ` (it lists ${notificationTotal} in total)`
                      : ''}
                    . The decision was recorded and the resident was not reached: tell them by hand.
                  </p>
                )}
              </DetailCard>

              <DetailCard title="The write trail" icon={<ListChecks />}>
                {auditTrail && auditTrail.length > 0 ? (
                  <ol className="space-y-2">
                    {auditTrail.map((entry) => (
                      <li
                        key={entry._id}
                        className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2"
                      >
                        <p className="text-xs font-bold text-(--color-text-primary)">
                          {entry.action} · {entry.userId?.name ?? 'the office'}
                        </p>
                        <p className="text-2xs font-medium text-(--color-text-muted)">
                          {formatDateTime(entry.timestamp)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm font-medium text-(--color-text-secondary)">
                    No entry for this leave in the audit log.
                  </p>
                )}
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The server keeps the entries of the audit log for 90 days and then drops them.
                </p>
              </DetailCard>
            </>
          }
        >
          <div className="space-y-4">
            {writeResult && (
              <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
                {writeResult}
              </div>
            )}

            {actionError && (
              <div className="rounded-(--radius-lg) border border-(--color-danger-200) bg-(--color-danger-50) px-4 py-3 text-xs font-semibold text-(--color-danger-800)">
                {actionError}
              </div>
            )}

            {/* The protagonist: what the decision did, or what it would do. */}
            <DetailCard
              title={isPending ? 'What this decision does' : 'What the server committed'}
              icon={isPending ? <CalendarDays /> : <Check />}
              variant={isPending ? 'info' : 'success'}
            >
              {isPending ? (
                <>
                  <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                    Approving marks each of the {days} day{days === 1 ? '' : 's'} of the window as
                    an on-leave record on the attendance board. A day with a real on-site check-in
                    is kept as it is. The rent does not change: the monthly bill is raised from the
                    resident&apos;s own record, so a leave is not a deduction.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-(--color-text-secondary)">
                    The resident is told either way: the server pushes a service_update notification
                    with the outcome. A rejection carries the reason of the office in the body of
                    that message; an approval cannot carry one, because the server takes no body on
                    that route.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                    The server set the status to {status.replace(/_/g, ' ')}
                    {leave.approvedByName ? `, decided by ${leave.approvedByName}` : ''}
                    {leave.approvedAt ? ` on ${formatDate(leave.approvedAt)}` : ''}.
                    {status === 'approved'
                      ? ` The days of the window now carry the on-leave state on the attendance board: ${markedOnLeave} day${
                          markedOnLeave === 1 ? '' : 's'
                        }${
                          preservedCheckIns > 0
                            ? `, and ${preservedCheckIns} on-site check-in${
                                preservedCheckIns === 1 ? '' : 's'
                              } kept its own record`
                            : ''
                        }.`
                      : ' It did not touch the attendance board.'}
                  </p>
                  {leave.adminNotes && (
                    <p className="mt-2 text-sm leading-relaxed text-(--color-text-secondary)">
                      The reason the office wrote:{' '}
                      <span className="font-semibold text-(--color-text-primary)">
                        {leave.adminNotes}
                      </span>
                    </p>
                  )}
                </>
              )}
            </DetailCard>

            {showReject && isPending && (
              <DetailCard title="Reject with a reason" icon={<X />} variant="danger">
                <Textarea
                  label="Reason for the rejection"
                  rows={3}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Why the leave is refused..."
                  helperText="The reason travels to the resident in the notification: the portal leave card does not show the office notes."
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    loading={actionBusy === 'reject'}
                    disabled={actionBusy !== null || rejectNotes.trim().length === 0}
                    onClick={() => void runDecision('reject')}
                  >
                    <X className="h-4 w-4" />
                    Reject with this reason
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionBusy !== null}
                    onClick={() => {
                      setShowReject(false);
                      setRejectNotes('');
                    }}
                  >
                    Keep the request open
                  </Button>
                </div>
              </DetailCard>
            )}

            <DetailCard title="Lifecycle progress" icon={<ListChecks />}>
              <StatusStepper domain="leave" current={status} />
            </DetailCard>

            <DetailCard title="The leave" icon={<CalendarDays />}>
              <DetailList>
                <DetailRow label="From" value={formatDate(from)} />
                <DetailRow label="To" value={formatDate(to)} />
                <DetailRow label="Days" value={`${days} day${days === 1 ? '' : 's'}`} />
                <DetailRow label="Status" value={status.replace(/_/g, ' ')} />
                <DetailRow label="Applied" value={`${formatDateTime(leave.createdAt)}`} />
                <DetailRow label="Last change" value={`${formatDateTime(leave.updatedAt)}`} />
              </DetailList>
              <p className="mt-3 text-sm leading-relaxed text-(--color-text-secondary)">
                <span className="text-2xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                  The reason the resident gave
                </span>
                <br />
                {leave.reason ? (
                  leave.reason
                ) : (
                  <span className="text-(--color-text-muted) italic">No reason was given</span>
                )}
              </p>
            </DetailCard>

            <DetailCard title="The days it covers" icon={<CalendarDays />}>
              <div className="flex flex-wrap gap-1.5" aria-label="The days of the leave window">
                {windowDays.map((date) => {
                  const record = attendanceRows.find((row) => row.date === date);
                  const checkIn = record?.checkIn ?? record?.checkInTime ?? null;
                  return (
                    <span
                      key={date}
                      title={
                        record
                          ? `${date}: ${attendanceLabel(record.status)}`
                          : `${date}: no attendance record yet`
                      }
                      className={clsx(
                        'text-2xs rounded-full border px-2.5 py-1 font-bold',
                        attendanceTone(record?.status, checkIn),
                      )}
                    >
                      {formatShort(date)}
                    </span>
                  );
                })}
              </div>
              <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                {attendanceLoading
                  ? 'Reading the attendance rows of the window...'
                  : `${attendanceRows.length} attendance row${attendanceRows.length === 1 ? '' : 's'} in the window${
                      days > ATTENDANCE_LIMIT
                        ? `, the server serves at most ${ATTENDANCE_LIMIT} in one page`
                        : ''
                    }.`}
              </p>
            </DetailCard>

            <DetailCard title="The attendance records it wrote" icon={<CalendarDays />}>
              {attendanceRows.length === 0 ? (
                <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                  {attendanceLoading
                    ? 'The server is answering with the rows of these days.'
                    : 'The server holds no attendance row for these days. An approval writes one row per day of the window.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-(--border-color)">
                        <th className="text-2xs px-3 py-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                          Day
                        </th>
                        <th className="text-2xs px-3 py-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                          State
                        </th>
                        <th className="text-2xs px-3 py-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                          Check in
                        </th>
                        <th className="text-2xs px-3 py-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                          How it was recorded
                        </th>
                        <th className="text-2xs px-3 py-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((row) => (
                        <tr key={row._id ?? row.date} className="border-b border-(--border-color)">
                          <td className="px-3 py-2 text-xs font-semibold text-(--color-text-primary)">
                            {row.date ? formatShort(row.date) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-(--color-text-primary)">
                            {attendanceLabel(row.status)}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-(--color-text-secondary)">
                            {formatTime(row.checkIn ?? row.checkInTime)}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-(--color-text-secondary)">
                            {row.method ?? '-'}
                            {row.recordedBy?.name ? ` · ${row.recordedBy.name}` : ''}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-(--color-text-secondary)">
                            {row.notes ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-2xs mt-3 flex items-start gap-1.5 font-medium text-(--color-text-secondary)">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                An approved leave writes the row itself: the state becomes on leave, the method is
                manual, the note reads Leave approved and the office is the one recorded. A day with
                a real on-site check-in keeps its own row.
              </p>
            </DetailCard>
          </div>
        </ContentFrame>
      )}

      <ConfirmModal
        open={confirmCancel}
        title="Cancel this request"
        message="The server sets the status to cancelled, writes the entry in the audit log and pushes a service_update notification to the resident: the body says the leave was cancelled by the PG office. The attendance board is not touched, and the request cannot be answered afterwards."
        confirmLabel="Cancel the request"
        cancelLabel="Keep it open"
        variant="warning"
        loading={actionBusy === 'cancel'}
        onConfirm={() => void runDecision('cancel')}
        onCancel={() => setConfirmCancel(false)}
      />
    </FormPage>
  );
}
