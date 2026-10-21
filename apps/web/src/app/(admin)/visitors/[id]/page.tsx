'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Phone,
  Home,
  Calendar,
  Clock,
  Pencil,
  ListChecks,
  Ticket,
  FileText,
  MessageCircle,
  BedDouble,
  Building2,
  ExternalLink,
  BadgeCheck,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { VisitorLifecycleActions } from '@/components/ui/VisitorLifecycleActions';
import { StatusStepper } from '@/components/ui/StatusStepper';
import { VisitorGatePassCard, visitorPassCode } from '@/components/ui/VisitorGatePassCard';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /visitors/:id        apps/api/src/routes/visitors.ts:254-302
//   POST /visitors/:id/*     apps/api/src/routes/visitors.ts:305-586
//   GET /audit-logs          apps/api/src/routes/audit.ts:13-52

interface VisitorDetail {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: {
    _id?: string;
    bedId?: string;
    user?: { name?: string; email?: string; phone?: string };
    room?: { _id?: string; roomNumber?: string; floor?: { label?: string; floorNumber?: number } };
  };
  expectedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  approvedBy?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

/** One entry of the write trail of a visitor pass. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

/** The answer of a gate write: the record the server returns after the write. */
interface GateWriteResult {
  success: boolean;
  data?: {
    _id?: string;
    status?: string;
    actualArrival?: string;
    actualDeparture?: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rem = minutes % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}

/**
 * Milliseconds on premises.
 *
 * An open visit (no departure recorded) counts up to now; a closed one counts
 * between the two server timestamps.
 */
function visitDurationMs(
  actualArrival: string | null | undefined,
  actualDeparture: string | null | undefined,
): number | null {
  if (!actualArrival) return null;
  const end = actualDeparture ? new Date(actualDeparture).getTime() : Date.now();
  return end - new Date(actualArrival).getTime();
}

/**
 * When the pass is expected, in the words of the gate desk.
 *
 * The hour is the server's (expectedArrival). A pass whose hour has passed
 * without an arrival is overdue: the gate sheet and the day disagree.
 */
function visitWindow(
  expectedArrival?: string,
  status?: string,
): { label: string; overdue: boolean } {
  if (!expectedArrival) return { label: 'Unscheduled', overdue: false };
  if (status === 'arrived') return { label: 'On premises', overdue: false };
  if (status === 'departed') return { label: 'Completed', overdue: false };
  if (status === 'cancelled') return { label: 'Cancelled', overdue: false };
  const target = new Date(expectedArrival);
  if (Number.isNaN(target.getTime())) return { label: 'Unscheduled', overdue: false };
  const now = new Date();
  if (target.getTime() < now.getTime()) {
    return {
      label: `Overdue ${formatDuration(now.getTime() - target.getTime())}`,
      overdue: true,
    };
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', overdue: false };
  if (diffDays === 1) return { label: 'Tomorrow', overdue: false };
  return { label: `In ${diffDays} days`, overdue: false };
}

function statusToDisplayLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

/**
 * One line of the write trail of a pass.
 *
 * The audit entry is the proof of what the office did, and the details the
 * server wrote with it are what the office is told.
 */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  const transition = typeof details.transition === 'string' ? details.transition : null;
  if (entry.action === 'visitor_approve') {
    return 'The pass was put back to expected and the approver was recorded on it.';
  }
  if (transition === 'arrive') {
    return 'The arrival was stamped with the server clock.';
  }
  if (transition === 'depart') {
    return 'The departure was stamped with the server clock.';
  }
  if (transition === 'cancel') {
    return 'The visit was cancelled.';
  }
  if (entry.action === 'create') {
    return 'The pass was registered.';
  }
  if (entry.action === 'delete') {
    return 'The pass was deleted.';
  }
  if (entry.action === 'update') {
    return 'The details of the pass changed (name, phone, purpose or the expected hour).';
  }
  return 'The record was written.';
}

/**
 * What the resident was told, one line per thing that happened to this pass.
 *
 * The server decides what a resident hears, and it decides it per route:
 *   - the registration writes the pass and a create entry in the audit log and
 *     sends nothing (apps/api/src/routes/visitors.ts:156-167);
 *   - the re-approval pushes a service_update to the resident who registered
 *     the visit (apps/api/src/routes/visitors.ts:351-356);
 *   - the arrival pushes one too (apps/api/src/routes/visitors.ts:434-439), and
 *     so does the departure (apps/api/src/routes/visitors.ts:513-518);
 *   - a cancellation writes the entry in the audit log and pushes nothing
 *     (apps/api/src/routes/visitors.ts:577-583);
 *   - a change of the details of the pass pushes nothing either.
 */
interface ResidentLine {
  label: string;
  text: string;
  told: boolean;
}

function residentLinesOf(trail: AuditEntry[]): ResidentLine[] {
  const lines: ResidentLine[] = [];
  for (const entry of trail) {
    const details = entry.details ?? {};
    const transition = typeof details.transition === 'string' ? details.transition : null;
    if (entry.action === 'visitor_approve') {
      lines.push({
        label: 'Re-approved',
        text: 'The server pushed a service_update to the resident who registered this visit: the pass is expected again.',
        told: true,
      });
    } else if (transition === 'arrive') {
      lines.push({
        label: 'Arrived',
        text: 'The server pushed a service_update to the resident who registered this visit when the arrival was stamped.',
        told: true,
      });
    } else if (transition === 'depart') {
      lines.push({
        label: 'Departed',
        text: 'The server pushed a service_update to the resident who registered this visit when the departure was stamped.',
        told: true,
      });
    } else if (transition === 'cancel') {
      lines.push({
        label: 'Cancelled',
        text: 'The server wrote the cancellation in the audit log and sent nothing: the resident still expects the visitor.',
        told: false,
      });
    } else if (entry.action === 'create') {
      lines.push({
        label: 'Registered',
        text: 'The server wrote the pass and a create entry in the audit log. Registration sends no message: a resident who registered the visit themselves in the portal already knows, and when the office registers a pass for them, nobody is told.',
        told: false,
      });
    } else if (entry.action === 'update') {
      lines.push({
        label: 'Details changed',
        text: 'The office changed the details of the pass and the server wrote an update entry in the audit log. No message is sent: the resident sees the new details the next time they open the app.',
        told: false,
      });
    }
  }
  return lines;
}

const VISITOR_KEY = (id: string) => ['visitors', 'detail', id] as const;
const VISITOR_AUDIT_KEY = (id: string) => ['visitors', 'detail', id, 'audit'] as const;

const EMPTY_TRAIL: AuditEntry[] = [];

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');

  const {
    data: rawVisitor,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<VisitorDetail>(VISITOR_KEY(id), `visitors/${id}`, { enabled: Boolean(id) });

  // The server answers with one record. Anything else is not a pass, and the
  // page says so instead of rendering an empty record.
  const visitor = rawVisitor && !Array.isArray(rawVisitor) ? rawVisitor : null;
  const error = errorMessage(queryError);

  /**
   * The write trail of this pass.
   *
   * The audit route filters by the record, so this is the trail of this pass
   * and not of every pass (apps/api/src/routes/audit.ts:13-52). The server
   * keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    VISITOR_AUDIT_KEY(id),
    `audit-logs?resource=visitor&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: VISITOR_KEY(id) });
    queryClient.invalidateQueries({ queryKey: VISITOR_AUDIT_KEY(id) });
    queryClient.invalidateQueries({ queryKey: ['visitors', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['visitors', 'count'] });
  };

  /**
   * A gate stamp.
   *
   * The server owns the state machine and the clock: it refuses an arrival on
   * a pass that is not expected, a departure on a pass that did not arrive, a
   * cancellation on a pass that already arrived and a re-approval on a pass
   * that is not cancelled. The message after the write says what the server
   * committed and what the resident was told.
   */
  const handleLifecycleAction = async (action: string) => {
    if (!visitor) return;
    setActionError('');
    setWriteResult('');
    try {
      const res = await api
        .post(`visitors/${visitor._id}/${action}`, { json: {} })
        .json<GateWriteResult>();
      const server = res.data ?? {};
      if (action === 'arrive') {
        setWriteResult(
          `${visitor.name} is on site. The server stamped the arrival at ${formatDateTime(server.actualArrival ?? visitor.actualArrival)} with its own clock, wrote an update entry in the audit log and told the resident who registered the pass. The visitor stays on site until the gate stamps the departure.`,
        );
      } else if (action === 'depart') {
        setWriteResult(
          `${visitor.name} has left. The server stamped the departure at ${formatDateTime(server.actualDeparture ?? visitor.actualDeparture)} with its own clock, wrote an update entry in the audit log and told the resident who registered the pass.`,
        );
      } else if (action === 'cancel') {
        setWriteResult(
          `The visit of ${visitor.name} will not happen. The server set the pass to cancelled and wrote an update entry in the audit log. It sends no message: the resident still expects the visitor, and only the gate tells them.`,
        );
      } else {
        setWriteResult(
          `${visitor.name} is expected again. The server put the pass back to expected, recorded who re-approved it, wrote a visitor_approve entry in the audit log and told the resident who registered the pass.`,
        );
      }
      refresh();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    }
  };

  const status = visitor?.status ?? '';
  const visitWindowState = visitWindow(visitor?.expectedArrival, status);
  const durationMs = visitDurationMs(visitor?.actualArrival, visitor?.actualDeparture);
  const hostRoom = visitor?.tenant?.room?.roomNumber;
  const hostBed = visitor?.tenant?.bedId;
  const hostFloor = visitor?.tenant?.room?.floor?.label;
  const hostStay = hostRoom ? `Room ${hostRoom}${hostBed ? ` · Bed ${hostBed}` : ''}` : 'No room';
  const trail = auditTrail ?? EMPTY_TRAIL;
  const residentLines = useMemo(() => residentLinesOf(trail), [trail]);

  if (!isLoading && (error || !visitor)) {
    return (
      <FormPage
        title="Visitor Details"
        description="View visitor information"
        backHref="/visitors"
        error={error || 'The server reports no visitor pass for this id.'}
        maxWidth="full"
      />
    );
  }

  return (
    <FormPage
      title={visitor?.name ?? 'Visitor Details'}
      description={
        visitor
          ? `Gate pass #${visitorPassCode(visitor._id)} · ${statusToDisplayLabel(status)} · ${hostStay}`
          : undefined
      }
      backHref="/visitors"
      isLoading={isLoading}
      maxWidth="full"
      error={actionError}
      actions={
        visitor ? (
          <div className="flex items-center gap-2">
            {status !== 'departed' && (
              <VisitorLifecycleActions
                visitorId={visitor._id}
                status={status}
                onAction={handleLifecycleAction}
                size="sm"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/visitors/${visitor._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
      badge={
        visitor ? (
          <StatusBadge
            variant={statusToVariant(visitor.status)}
            label={statusToDisplayLabel(visitor.status)}
          />
        ) : undefined
      }
    >
      {visitor && (
        <ContentFrame
          rail={
            <>
              {/* What the resident was told. The server decides what a resident
                  hears, and this is the proof of what it did. */}
              <DetailCard title="What the resident was told" icon={<MessageCircle />}>
                {residentLines.length === 0 ? (
                  <p className="text-2xs font-medium text-(--color-text-secondary)">
                    The server holds no write entry for this pass in the entries it keeps (the
                    entries expire after 90 days), so there is nothing to read here yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {residentLines.map((line) => (
                      <li
                        key={line.label}
                        className="border-b border-(--border-color) pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            variant={line.told ? 'success' : 'warning'}
                            label={line.told ? 'Told' : 'Not told'}
                            size="xs"
                          />
                          <span className="text-2xs font-bold text-(--color-text-primary)">
                            {line.label}
                          </span>
                        </div>
                        <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                          {line.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  The resident who registered this visit is the one the server writes to. When the
                  server sends nothing, the resident finds out at the gate.
                </p>
              </DetailCard>

              {/* The write trail of the pass: the proof of what the office did
                  to it, and the only place a change that reached nobody shows
                  up. */}
              <DetailCard
                title="What the office did to this pass"
                icon={<FileText />}
                action={
                  <span className="text-2xs font-semibold text-(--color-text-muted)">
                    the newest {trail.length} entries
                  </span>
                }
              >
                {trail.length === 0 ? (
                  <p className="text-2xs font-medium text-(--color-text-secondary)">
                    The server holds no write entry for this pass in the entries it keeps (the
                    entries expire after 90 days).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {trail.map((entry) => (
                      <li
                        key={entry._id}
                        className="flex flex-col gap-0.5 border-b border-(--border-color) pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            variant={
                              entry.action === 'delete'
                                ? 'danger'
                                : entry.action === 'visitor_approve'
                                  ? 'success'
                                  : 'neutral'
                            }
                            label={entry.action.replace(/_/g, ' ')}
                            size="xs"
                          />
                          <span className="text-2xs font-semibold text-(--color-text-primary)">
                            {entry.userId?.name ?? 'The office'}
                          </span>
                          <span className="text-2xs font-medium text-(--color-text-muted)">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'no timestamp'}
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

              {/* The facts of the record. */}
              <DetailCard title="The record" icon={<FileText />}>
                <DetailList>
                  <DetailRow label="Pass code" value={`#${visitorPassCode(visitor._id)}`} />
                  <DetailRow
                    label="Expected arrival"
                    value={formatDateTime(visitor.expectedArrival)}
                  />
                  <DetailRow label="Checked in" value={formatDateTime(visitor.actualArrival)} />
                  <DetailRow label="Checked out" value={formatDateTime(visitor.actualDeparture)} />
                  <DetailRow
                    label="Time on premises"
                    value={durationMs == null ? '—' : formatDuration(durationMs)}
                  />
                  <DetailRow label="Registered" value={formatDateTime(visitor.createdAt)} />
                  {visitor.updatedAt && (
                    <DetailRow label="Last updated" value={formatDateTime(visitor.updatedAt)} />
                  )}
                  {visitor.approvedBy && (
                    <DetailRow label="Re-approved by" value={String(visitor.approvedBy)} />
                  )}
                  <DetailRow
                    label="Record ID"
                    value={
                      <button
                        type="button"
                        className="font-mono text-xs text-(--color-text-secondary) underline-offset-2 hover:underline"
                        onClick={() => void copyToClipboard(visitor._id)}
                        title="Copy record ID"
                      >
                        {visitor._id}
                      </button>
                    }
                  />
                </DetailList>
              </DetailCard>
            </>
          }
        >
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {(actionError || errorMessage(queryError)) && (
            <ErrorBanner message={actionError || errorMessage(queryError)} />
          )}

          {/* The protagonist of this module: where the pass is in its
              progression, and the clock the gate keeps on it. */}
          <DetailCard
            title="Where this pass is"
            icon={<ListChecks />}
            action={
              <StatusBadge variant={statusToVariant(status)} label={statusToDisplayLabel(status)} />
            }
          >
            <StatusStepper domain="visitor" current={status} />

            <p className="text-2xs mt-3 font-medium text-(--color-text-secondary)">
              {status === 'arrived'
                ? 'The person is on site. The pass stays on this state until the gate stamps the departure.'
                : status === 'departed'
                  ? 'The visit is over. This pass is now the record of it: the arrival, the departure and the times the server stamped.'
                  : status === 'cancelled'
                    ? 'The visit will not happen. An admin can approve the pass again, and the resident who registered it is told when they do.'
                    : 'The pass waits for its hour. The gate stamps the arrival when the person comes, and the departure when they leave.'}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                  Visit window
                </p>
                <p className="text-sm font-bold text-(--color-text-primary)">
                  {visitWindowState.label}
                </p>
              </div>
              <div>
                <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                  Time on premises
                </p>
                <p className="text-sm font-bold text-(--color-text-primary)">
                  {durationMs == null ? '—' : formatDuration(durationMs)}
                </p>
              </div>
              <div>
                <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                  Host stay
                </p>
                <p className="text-sm font-bold text-(--color-text-primary)">{hostStay}</p>
              </div>
            </div>

            {visitWindowState.overdue && (
              <p className="text-2xs mt-3 flex items-start gap-1.5 font-semibold text-(--color-warning-700)">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The hour of this pass has passed and no arrival was stamped. The gate sheet and the
                day disagree until the office stamps the arrival or refuses the visit.
              </p>
            )}
          </DetailCard>

          {/* The artifact of the module: the pass the gate keeps. */}
          <DetailCard title="The gate pass" icon={<Ticket />}>
            <VisitorGatePassCard
              visit={{
                id: visitor._id,
                visitorName: visitor.name,
                visitorPhone: visitor.phone,
                purpose: visitor.purpose,
                expectedArrival: visitor.expectedArrival,
                actualArrival: visitor.actualArrival,
                actualDeparture: visitor.actualDeparture,
                status,
              }}
              host={{
                name: visitor.tenant?.user?.name,
                roomNumber: hostRoom,
                bedId: hostBed,
                floorLabel: hostFloor,
              }}
            />
          </DetailCard>

          {/* The whole visit: who came, who they visit and why they came. */}
          <DetailCard
            title="The visit"
            icon={<User />}
            action={
              visitor.phone ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      generateWhatsAppUrl(
                        visitor.phone,
                        `Hi ${visitor.name}, regarding your visit to our PG...`,
                      ),
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {visitor.name}
                    </span>
                  }
                />
                <DetailRow
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {visitor.phone}
                    </span>
                  }
                />
                <DetailRow
                  label="Purpose"
                  value={<span className="capitalize">{visitor.purpose}</span>}
                />
                <DetailRow
                  label="Expected arrival"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {formatDateTime(visitor.expectedArrival)}
                    </span>
                  }
                />
                <DetailRow
                  label="Checked in"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {formatDateTime(visitor.actualArrival)}
                    </span>
                  }
                />
                <DetailRow
                  label="Checked out"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {formatDateTime(visitor.actualDeparture)}
                    </span>
                  }
                />
              </DetailList>

              <DetailList>
                <DetailRow
                  label="Host resident"
                  value={
                    visitor.tenant?._id ? (
                      <Link
                        href={`/tenants/${visitor.tenant._id}`}
                        className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
                      >
                        <User className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {visitor.tenant.user?.name ?? 'View the resident'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      (visitor.tenant?.user?.name ?? 'N/A')
                    )
                  }
                />
                {visitor.tenant?.user?.phone && (
                  <DetailRow
                    label="Resident phone"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {visitor.tenant.user.phone}
                      </span>
                    }
                  />
                )}
                <DetailRow
                  label="Room"
                  value={
                    visitor.tenant?.room?._id ? (
                      <Link
                        href={`/rooms/${visitor.tenant.room._id}`}
                        className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
                      >
                        <Home className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {hostRoom ?? 'N/A'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Home className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {hostRoom ?? 'N/A'}
                      </span>
                    )
                  }
                />
                <DetailRow
                  label="Bed"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {hostBed ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Floor"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {hostFloor ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Pass code"
                  value={
                    <span className="inline-flex items-center gap-1 font-mono">
                      <BadgeCheck className="h-3.5 w-3.5 text-(--color-brand-600)" />#
                      {visitorPassCode(visitor._id)}
                    </span>
                  }
                />
              </DetailList>
            </div>
          </DetailCard>

          {/* The rest of the gate sheet: the other passes of the same desk. */}
          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <Home className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The whole gate sheet is one click away:{' '}
            <Link
              href="/visitors?status=arrived"
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              the visitors on site right now
            </Link>{' '}
            , filtered on that state in the address bar.
          </p>
        </ContentFrame>
      )}
    </FormPage>
  );
}
