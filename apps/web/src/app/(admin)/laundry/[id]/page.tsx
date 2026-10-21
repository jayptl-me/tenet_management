'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  User,
  Home,
  FileText,
  Pencil,
  BedDouble,
  Building2,
  Phone,
  CheckCircle,
  XCircle,
  Bell,
  Shirt,
  Info,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { INotification } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET  /laundry-slots/:id          apps/api/src/routes/laundry.ts:233-254
//   GET  /laundry-slots?slotDate=    apps/api/src/routes/laundry.ts:176-230
//   PUT  /laundry-slots/:id          apps/api/src/routes/laundry.ts:351-461
//   POST /laundry-slots/:id/cancel   apps/api/src/routes/laundry.ts:464-554
//   GET  /notifications?type=        apps/api/src/routes/notifications.ts:26-54
//   GET  /audit-logs?resource=       apps/api/src/routes/audit.ts:13-52

interface LaundryTenant {
  _id: string;
  bedId?: string | null;
  user?: { name?: string; phone?: string };
  room?: { roomNumber?: string; floor?: { label?: string } | null };
}

interface LaundrySlotDetail {
  _id: string;
  tenant?: LaundryTenant;
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

interface LaundryListBody {
  success: boolean;
  data: LaundrySlotDetail[];
  meta: { total: number; totalPages?: number };
}

interface NotificationBody {
  success: boolean;
  data: INotification[];
  meta: { total: number };
}

/** One entry of the write trail of a slot. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

// ── The rules the server holds ─────────────────────────────────────────

/**
 * The facility capacity of one slot time.
 *
 * The server refuses a sixth booking at the same date and time with
 * SLOT_FULL (apps/api/src/routes/laundry.ts:274-292).
 */
const CAPACITY = 5;

/** The page size the server clamps every list to (apps/api/src/lib/routeUtils.ts:16). */
const MAX_PAGE_SIZE = 100;

/**
 * The progression of a slot, as the server writes it.
 *
 * The domain has no entry in the shared lifecycle vocabulary
 * (packages/types/src/lifecycle.json), so the shared stepper cannot draw it.
 * This is the same ladder the shared stepper would draw, with the route that
 * moves the record and the role that moves it.
 */
const LADDER = [
  {
    key: 'booked',
    label: 'Booked',
    route: 'POST /laundry-slots',
    who: 'the resident or the office',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    route: 'PUT /laundry-slots/:id',
    who: 'the office',
  },
  {
    key: 'completed',
    label: 'Completed',
    route: 'PUT /laundry-slots/:id',
    who: 'the office',
  },
];

const BRANCH = {
  key: 'cancelled',
  label: 'Cancelled',
  route: 'POST /laundry-slots/:id/cancel',
  who: 'the resident or the office',
};

// ── Helpers ────────────────────────────────────────────────────────────

/** The label of a status, spelled the way the office reads it. */
function statusLabel(status: string): string {
  if (status === '') return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDay(day: string | undefined): string {
  if (!day) return 'unknown';
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStamp(value: string | undefined): string {
  if (!value) return 'no timestamp';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'no timestamp';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The server's own words for a refusal.
 *
 * The shared parser maps every 400 to one generic sentence, and the laundry
 * route puts the reason in the message of the response (a date in the past, a
 * full slot time, a slot that cannot be closed). The office has to read the
 * reason, so the message of the body is read first.
 */
async function serverMessage(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: unknown }).response;
    if (res instanceof Response) {
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        const message = body?.error?.message;
        if (typeof message === 'string' && message.trim() !== '') return message;
      } catch {
        // The body was not a JSON envelope: the shared parser takes over.
      }
    }
  }
  return (await parseApiError(err)).message;
}

/** One line of the write trail of a slot. */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  const status = typeof details.status === 'string' ? details.status : null;
  const day = typeof details.slotDate === 'string' ? details.slotDate : null;
  const time = typeof details.slotTime === 'string' ? details.slotTime : null;
  const when = day && time ? ` on ${day} at ${time}` : day ? ` on ${day}` : '';
  if (entry.action === 'create') {
    return `The slot was booked${when}. The record landed with the status booked and the resident was not told.`;
  }
  if (entry.action === 'delete') {
    return `The slot${when ? ` of ${day} at ${time}` : ''} was removed from the records for good.`;
  }
  if (status === 'cancelled') {
    const by = typeof details.cancelledBy === 'string' ? details.cancelledBy : 'the office';
    return `The slot was given up${when} by ${by}. The resident was not told.`;
  }
  if (status) {
    return `The slot was written${when} and its status set to ${status}.`;
  }
  return `The slot${when ? ` of ${day} at ${time}` : ''} was written.`;
}

const LAUNDRY_SLOT_KEY = (id: string) => ['laundry-slots', id] as const;
const LAUNDRY_DAY_KEY = (day: string) => ['laundry-slots', 'day', day] as const;
const LAUNDRY_TOLD_KEY = (id: string) => ['laundry-slots', 'told', id] as const;
const LAUNDRY_AUDIT_KEY = (id: string) => ['laundry-slots', id, 'audit'] as const;

export default function LaundryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: slot = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<LaundrySlotDetail>(LAUNDRY_SLOT_KEY(id), `laundry-slots/${id}`, {
    enabled: Boolean(id),
  });
  const queryErrorMessage = errorMessage(queryError);

  const slotDay = slot?.slotDate ?? '';

  /**
   * The queue of that slot time.
   *
   * The server has no filter for a slot time, so the day is read and the
   * time is picked from it. The server serves at most 100 rows in one page.
   */
  const { data: dayBody } = useApiBodyQuery<LaundryListBody>(
    LAUNDRY_DAY_KEY(slotDay),
    `laundry-slots?slotDate=${slotDay}&limit=${MAX_PAGE_SIZE}`,
    { enabled: Boolean(slotDay) },
  );

  /**
   * What the resident was told.
   *
   * The admin sees the whole notification history, and the confirmation
   * message carries the id of the slot in its data
   * (apps/api/src/routes/laundry.ts:437-442). The server lists the newest
   * hundred service updates, so a confirmation older than that is not here.
   */
  const { data: toldBody } = useApiBodyQuery<NotificationBody>(
    LAUNDRY_TOLD_KEY(id),
    'notifications?type=service_update&limit=100',
    { enabled: Boolean(id) },
  );

  /**
   * The write trail of this slot.
   *
   * The audit route filters by the record, so this is the trail of this slot
   * and not of every slot (apps/api/src/routes/audit.ts:13-52). The server
   * keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    LAUNDRY_AUDIT_KEY(id),
    `audit-logs?resource=laundry_slot&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  const queue = useMemo(
    () => (dayBody?.data ?? []).filter((row) => row.slotTime === slot?.slotTime),
    [dayBody, slot],
  );

  const placesTaken = useMemo(
    () => queue.filter((row) => row.status !== 'cancelled').length,
    [queue],
  );

  const told = useMemo(() => {
    const list = toldBody?.data ?? [];
    return list.find((note) => note.data?.slotId === id) ?? null;
  }, [toldBody, id]);

  const refresh = () => {
    // The slot, the queue of its day, the message and the write trail all
    // hang off the same prefix, so one invalidation re-reads the lot.
    queryClient.invalidateQueries({ queryKey: ['laundry-slots'] });
  };

  /**
   * Move the slot to the next status and report what the server committed.
   *
   * The screen never claims a state the server did not write: the answer of
   * the write is read back, and the record is re-read from the server after.
   */
  const handleStatusWrite = async (next: 'confirmed' | 'completed') => {
    if (!slot) return;
    setBusy(true);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .put(`laundry-slots/${slot._id}`, { json: { status: next } })
        .json<{ success: boolean; data: LaundrySlotDetail }>();
      const committed = res?.data?.status ?? next;
      const name = slot.tenant?.user?.name ?? 'the resident';
      setWriteResult(
        committed === 'confirmed'
          ? `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to confirmed and pushed a service update to ${name}: "Your laundry slot on ${slot.slotDate} at ${slot.slotTime} is confirmed. Please bring your laundry at that time." A push that fails is logged by the server and never undoes the write.`
          : `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to completed and wrote an update entry in the audit log. It sends no message: the resident is not told that the slot was closed.`,
      );
      refresh();
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Give the place up.
   *
   * The cancel route is the domain route for it: it refuses an already
   * cancelled slot and a completed one, and it frees the place at that time.
   */
  const handleCancel = async () => {
    if (!slot) return;
    setBusy(true);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .post(`laundry-slots/${slot._id}/cancel`, { json: {} })
        .json<{ success: boolean; data: LaundrySlotDetail }>();
      const committed = res?.data?.status ?? 'cancelled';
      const name = slot.tenant?.user?.name ?? 'the resident';
      setWriteResult(
        `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to ${committed} and wrote an update entry in the audit log. It sends no message: the resident is not told, and the place at that time is free again.`,
      );
      setCancelOpen(false);
      refresh();
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !slot)) {
    return (
      <FormPage
        title="Laundry slot"
        description="The booking of a resident at a time"
        backHref="/laundry"
        error={queryErrorMessage || 'The server reports no laundry slot for this id.'}
        maxWidth="full"
      />
    );
  }

  const status = slot?.status ?? 'booked';
  const statusIndex = LADDER.findIndex((step) => step.key === status);
  const onBranch = status === BRANCH.key;
  const residentName = slot?.tenant?.user?.name ?? 'The resident';
  const canConfirm = status === 'booked';
  const canComplete = status === 'confirmed';
  const canCancel = status === 'booked' || status === 'confirmed';

  return (
    <FormPage
      title="Laundry slot"
      description={
        slot
          ? `${residentName} · ${formatDay(slot.slotDate)} at ${slot.slotTime}`
          : 'The booking of a resident at a time'
      }
      backHref="/laundry"
      isLoading={isLoading}
      maxWidth="full"
      badge={<StatusBadge variant={statusToVariant(status)} label={statusLabel(status)} />}
      actions={
        slot ? (
          <div className="flex flex-wrap items-center gap-2">
            {canConfirm && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void handleStatusWrite('confirmed')}
                title="Confirm the slot and tell the resident the time"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void handleStatusWrite('completed')}
                title="Close the slot as used"
              >
                <CheckCircle className="h-4 w-4" />
                Mark as used
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
                title="Give the place up"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/laundry/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {slot && (
        <ContentFrame
          rail={
            <>
              {/* The slot itself: what the record holds and when it was made. */}
              <DetailCard title="The slot" icon={<Calendar />}>
                <DetailList>
                  <DetailRow label="Day" value={formatDay(slot.slotDate)} />
                  <DetailRow
                    label="Time"
                    value={<span className="font-mono">{slot.slotTime}</span>}
                  />
                  <DetailRow label="Items" value={`${slot.items ?? 1}`} />
                  <DetailRow label="Status" value={statusLabel(status)} />
                  <DetailRow label="Booked at" value={formatStamp(slot.createdAt)} />
                </DetailList>
                {slot.notes && (
                  <p className="text-2xs mt-3 font-medium text-(--color-text-secondary)">
                    The note of the resident: {slot.notes}
                  </p>
                )}
              </DetailCard>

              {/* The resident who holds the place. The slot links to the
                  resident record, so the office can act on the person and not
                  only on the booking. */}
              <DetailCard
                title="The resident"
                icon={<User />}
                action={
                  slot.tenant?._id ? (
                    <Link
                      href={`/tenants/${slot.tenant._id}`}
                      className="text-xs font-semibold text-(--color-brand-600) hover:underline"
                    >
                      Open the resident
                    </Link>
                  ) : undefined
                }
              >
                <DetailList>
                  <DetailRow
                    label="Name"
                    value={
                      slot.tenant?._id ? (
                        <Link
                          href={`/tenants/${slot.tenant._id}`}
                          className="font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                        >
                          {residentName}
                        </Link>
                      ) : (
                        residentName
                      )
                    }
                  />
                  <DetailRow
                    label="Room"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Home className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {slot.tenant?.room?.roomNumber ?? 'unknown'}
                      </span>
                    }
                  />
                  {slot.tenant?.bedId && (
                    <DetailRow
                      label="Bed"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {slot.tenant.bedId}
                        </span>
                      }
                    />
                  )}
                  {slot.tenant?.room?.floor?.label && (
                    <DetailRow
                      label="Floor"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {slot.tenant.room.floor.label}
                        </span>
                      }
                    />
                  )}
                  {slot.tenant?.user?.phone && (
                    <DetailRow
                      label="Phone"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {slot.tenant.user.phone}
                        </span>
                      }
                    />
                  )}
                </DetailList>
              </DetailCard>

              {/* What the resident was told. The office has to be able to say
                  whether the message went out, not assume it did. */}
              <DetailCard title="What the resident was told" icon={<Bell />}>
                {told ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-(--color-text-primary)">{told.title}</p>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      {told.body}
                    </p>
                    <p className="text-2xs font-medium text-(--color-text-muted)">
                      Sent {formatStamp(told.sentAt)} to {told.recipientUserIds.length} user(s) as a
                      service update.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      The server holds no message about this slot in the last 100 service updates it
                      lists. The server sends one message only when a slot is confirmed
                      (apps/api/src/routes/laundry.ts:436-443): a slot that was booked and never
                      confirmed leaves the resident with no time to come down.
                    </p>
                    <p className="text-2xs font-medium text-(--color-text-muted)">
                      The resident still sees the slot itself in the portal, with its status. They
                      are not told anything the office does to it.
                    </p>
                  </div>
                )}
              </DetailCard>
            </>
          }
        >
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {(error || queryErrorMessage) && <ErrorBanner message={error || queryErrorMessage} />}

          {/* The progression of the slot, with the route that moves it. */}
          <DetailCard title="Where the slot stands" icon={<Clock />}>
            <ol aria-label="Laundry slot lifecycle" className="flex items-start">
              {LADDER.map((step, index) => {
                const isLast = index === LADDER.length - 1;
                const reached = !onBranch ? index <= statusIndex : index === 0;
                return (
                  <li key={step.key} className={clsx('flex-1', !isLast && 'pr-1')}>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        title={`${step.route} (${step.who})`}
                        className={clsx(
                          'text-2xs flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-default)] font-bold',
                          reached
                            ? 'border-(--color-success-500) bg-(--color-success-500) text-(--color-on-success)'
                            : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-muted)',
                        )}
                      >
                        {index + 1}
                      </span>
                      {!isLast && (
                        <span
                          aria-hidden
                          className={clsx(
                            'h-0.5 min-w-4 flex-1 rounded-full',
                            reached && index < statusIndex
                              ? 'bg-(--color-success-500)'
                              : 'bg-(--border-color)',
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={clsx(
                        'mt-1.5 text-xs font-bold',
                        reached ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)',
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-2xs font-medium text-(--color-text-muted)">
                      {step.route} ({step.who})
                    </p>
                  </li>
                );
              })}
            </ol>

            {onBranch && (
              <div className="mt-3 flex items-start gap-2 rounded-(--radius-md) border border-(--color-danger-200) bg-(--color-danger-50) px-3 py-2">
                <span
                  aria-hidden
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-danger-500)"
                />
                <div>
                  <p className="text-xs font-bold text-(--color-danger-700)">
                    {BRANCH.label} - the slot left the normal path at Booked.
                  </p>
                  <p className="text-2xs mt-0.5 font-semibold text-(--color-danger-700)">
                    {BRANCH.route} ({BRANCH.who})
                  </p>
                </div>
              </div>
            )}

            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              A closed slot can only be reopened to booked: the server refuses every other move out
              of completed or cancelled (apps/api/src/routes/laundry.ts:359-374).
            </p>
          </DetailCard>

          {/* The machine queue of that time: who else holds a place, and how
              many of the five places are free. */}
          <DetailCard
            title="The queue at this time"
            icon={<Shirt />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                {placesTaken} of {CAPACITY} places taken
              </span>
            }
          >
            {queue.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no booking at {slot.slotTime} on {slot.slotDate}.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {queue.map((row) => (
                  <li key={row._id} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-(--color-text-primary)">
                      {row.tenant?._id ? (
                        <Link
                          href={`/tenants/${row.tenant._id}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {row.tenant.user?.name ?? 'A resident'}
                        </Link>
                      ) : (
                        'A resident'
                      )}
                      {row._id === slot._id ? ' (this slot)' : ''}
                    </span>
                    <StatusBadge
                      variant={statusToVariant(row.status)}
                      label={statusLabel(row.status)}
                      size="xs"
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              The record holds no machine: a slot is a place in the queue of that time, and the
              server counts five places per date and time (apps/api/src/routes/laundry.ts:274-292).
              The machines of the house are a separate pool and live on the washing machines page.
            </p>
          </DetailCard>

          {/* The write trail of this slot: the proof of what the office did to
              it, and the only place a change that reached nobody shows up. */}
          <DetailCard
            title="What the office did to this slot"
            icon={<FileText />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditTrail?.length ?? 0} entries
              </span>
            }
          >
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no write entry for this slot in the entries it keeps (the entries
                expire after 90 days).
              </p>
            ) : (
              <ul className="space-y-2">
                {auditTrail.map((entry) => (
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
                        {formatStamp(entry.timestamp)}
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

          {/* The truth about the write the office wants to make. */}
          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Confirming the slot is the one write that reaches the resident. The server refuses to
            write a slot whose day has passed (apps/api/src/routes/laundry.ts:376-381), so a slot of
            yesterday cannot be closed or corrected: move it to today or later first.
          </p>

          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The whole queue of the module is one click away:{' '}
            <Link
              href={`/laundry?slotDate=${slot.slotDate}`}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              every slot of {formatDay(slot.slotDate)}
            </Link>
            , filtered on that day in the address bar.
          </p>
        </ContentFrame>
      )}

      <ConfirmModal
        open={cancelOpen}
        title="Give the place up"
        message={`The server sets the slot of ${residentName} on ${slot?.slotDate ?? ''} at ${slot?.slotTime ?? ''} to cancelled and writes an update entry in the audit log. The place at that time is free again and the resident is not told: tell them at the desk.`}
        confirmLabel="Give the place up"
        loading={busy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelOpen(false)}
      />
    </FormPage>
  );
}
