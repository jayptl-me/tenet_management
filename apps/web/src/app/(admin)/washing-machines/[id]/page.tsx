'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  History,
  Pencil,
  RefreshCw,
  Timer,
  TriangleAlert,
  User,
  WashingMachine,
  Wrench,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormPage } from '@/components/ui/FormPage';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TextSkeleton } from '@/components/ui/Skeleton';
import { Timeline } from '@/components/ui/Timeline';

// -- Shapes -------------------------------------------------------------
// Every field below is read out of the API response, never invented:
//   GET /washing-machines/:id      apps/api/src/routes/washingMachines.ts:199-216
//   GET /audit-logs                 apps/api/src/routes/audit.ts:13-52
//   POST /washing-machines/:id/release  apps/api/src/routes/washingMachines.ts:437-489
//   PUT  /washing-machines/:id      apps/api/src/routes/washingMachines.ts:273-327

interface MachineDetail {
  _id: string;
  machineNumber: number;
  label: string;
  status: string;
  floorId?: string;
  floorLabel?: string;
  floorNumber?: number;
  currentUserId?: string | null;
  currentUser?: { id?: string; name?: string; room?: string } | null;
  claimedAt?: string | null;
  timerDuration?: number;
  timerEndsAt?: string | null;
  lastUsedAt?: string | null;
  notes?: string;
  createdAt?: string;
}

/** One entry of the audit trail of this machine. */
interface AuditEvent {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  timestamp: string;
  userId?: { name?: string; email?: string; role?: string } | null;
}

// -- Vocabulary ---------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  available: 'Free to claim',
  in_use: 'Running',
  under_maintenance: 'In maintenance',
  down: 'Down',
};

/** What each state means, in one line, for the card of the state. */
const STATUS_MEANING: Record<string, string> = {
  available: 'a resident of the floor can claim it right away',
  in_use: 'a resident holds it until the timer on the claim runs out',
  under_maintenance: 'it is being fixed and cannot be claimed',
  down: 'it is broken and cannot be claimed',
};

/** How long the machine is held when a resident claims it. */
const TIMER_MIN = 10;
const TIMER_MAX = 180;

const MACHINE_KEY = (id: string) => ['washing-machines', 'detail', id] as const;
const MACHINE_EVENTS_KEY = (id: string) => ['washing-machines', id, 'audit-logs'] as const;

// -- Helpers ------------------------------------------------------------

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function machineName(machine: MachineDetail): string {
  return machine.label || `Machine ${machine.machineNumber}`;
}

function floorName(machine: MachineDetail): string {
  if (machine.floorLabel) return machine.floorLabel;
  if (machine.floorNumber != null) return `Floor ${machine.floorNumber}`;
  return 'No floor';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A string field of the audit details, read without trusting its type. */
function detailString(details: Record<string, unknown> | undefined, key: string): string | null {
  const value = details?.[key];
  return typeof value === 'string' ? value : null;
}

/** A number field of the audit details, read without trusting its type. */
function detailNumber(details: Record<string, unknown> | undefined, key: string): number | null {
  const value = details?.[key];
  return typeof value === 'number' ? value : null;
}

/** The timer of the current claim, in the words of the office. */
function timerLine(machine: MachineDetail): { label: string; overdue: boolean } {
  if (machine.status !== 'in_use') return { label: 'No timer on this machine', overdue: false };
  if (!machine.timerEndsAt) return { label: 'The claim carries no timer', overdue: true };
  const endsAt = new Date(machine.timerEndsAt).getTime();
  if (Number.isNaN(endsAt)) return { label: 'The claim carries no timer', overdue: true };
  const minutes = Math.round((endsAt - Date.now()) / 60000);
  const clock = new Date(machine.timerEndsAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (minutes <= 0) return { label: `The timer ran out (was due at ${clock})`, overdue: true };
  return { label: `Held until ${clock} (${minutes} min left)`, overdue: false };
}

/** One line of the claim history, read out of the audit entry. */
function eventTitle(event: AuditEvent): string {
  const action = detailString(event.details, 'action');
  if (action === 'claim') return 'Claimed by a resident';
  if (action === 'release') return 'The claim was released';
  const status = detailString(event.details, 'status');
  if (status !== null) return `The state was set to ${statusLabel(status)}`;
  if (event.action === 'create') return 'The machine was registered';
  if (event.action === 'delete') return 'The machine was deleted';
  return 'The machine was written';
}

/** The second line of the claim history: who did it and what the server wrote. */
function eventDescription(event: AuditEvent): string {
  const actor = event.userId?.name ?? 'Someone';
  const action = detailString(event.details, 'action');
  const duration = detailNumber(event.details, 'duration');
  if (action === 'claim') {
    const minutes = duration === null ? '' : ` for ${duration} minutes`;
    return `${actor} claimed the machine${minutes}. The server stamped the claim and the timer on it.`;
  }
  if (action === 'release') {
    return `${actor} released the claim. The server set the machine free to claim and cleared the claim.`;
  }
  const status = detailString(event.details, 'status');
  if (status !== null) {
    return `${actor} set the state to ${statusLabel(status)}. The server cleared the claim on the machine.`;
  }
  if (event.action === 'create') {
    return `${actor} registered the machine. The server wrote it on its floor.`;
  }
  if (event.action === 'delete') {
    return `${actor} deleted the machine. The server removed the record.`;
  }
  return `${actor} wrote the machine.`;
}

/** The tone of one entry of the claim history. */
function eventTone(event: AuditEvent): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const action = detailString(event.details, 'action');
  if (action === 'claim') return 'info';
  if (action === 'release') return 'success';
  const status = detailString(event.details, 'status');
  if (status !== null) {
    if (status === 'down') return 'danger';
    if (status === 'under_maintenance') return 'warning';
    if (status === 'available') return 'success';
  }
  if (event.action === 'create') return 'success';
  if (event.action === 'delete') return 'danger';
  return 'neutral';
}

/** The write the office is about to make, and the machine it is about. */
type PendingWrite = 'release' | 'down' | 'available';

export default function WashingMachineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [writing, setWriting] = useState(false);

  const {
    data: machine = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<MachineDetail | null>(MACHINE_KEY(id), `washing-machines/${id}`, {
    enabled: Boolean(id),
  });

  /**
   * The claims of this machine, in order.
   *
   * The record holds the claim that is running now. The history of the claims
   * that came before it lives in the audit trail of the record, and the server
   * keeps that trail for 90 days.
   */
  const { data: eventsData, isPending: eventsLoading } = useApiQuery<AuditEvent[]>(
    MACHINE_EVENTS_KEY(id),
    `audit-logs?resource=washing_machine&resourceId=${id}&limit=25`,
    { enabled: Boolean(id) },
  );
  const events = Array.isArray(eventsData) ? eventsData : [];

  const error = errorMessage(queryError) || actionError;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['washing-machines'] });
  }, [queryClient]);

  /**
   * The write the office asked for.
   *
   * The banner reports the state the SERVER committed, read out of the answer
   * of the route. The page never shows a state it decided on its own.
   */
  const runWrite = async () => {
    if (!pending || !machine) return;
    setWriting(true);
    setActionError('');
    try {
      if (pending === 'release') {
        const res = await api
          .post(`washing-machines/${machine._id}/release`)
          .json<{ success: boolean; data: MachineDetail }>();
        setWriteResult(
          `${machineName(machine)} reads ${statusLabel(res.data.status)} now, the server says. The claim was cleared. The resident was not told: they see the machine free the next time they open the app.`,
        );
      } else {
        const res = await api
          .put(`washing-machines/${machine._id}`, { json: { status: pending } })
          .json<{ success: boolean; data: MachineDetail }>();
        setWriteResult(
          `${machineName(machine)} reads ${statusLabel(res.data.status)} now, the server says. The claim on it was cleared. The residents of the floor were not told: they read the machine list themselves.`,
        );
      }
      setPending(null);
      refresh();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
      setPending(null);
      refresh();
    } finally {
      setWriting(false);
    }
  };

  if (!isLoading && (error || !machine)) {
    return (
      <FormPage
        title="Washing machine"
        description="The machine could not be read"
        backHref="/washing-machines"
        error={error || 'The server has no washing machine with that id.'}
        maxWidth="full"
      />
    );
  }

  const timer = machine ? timerLine(machine) : null;
  const holderId = machine?.currentUser?.id ?? machine?.currentUserId ?? null;
  const isInUse = machine?.status === 'in_use';
  const isOutOfPool = machine?.status === 'under_maintenance' || machine?.status === 'down';

  const confirmCopy = (() => {
    if (!pending || !machine) return null;
    const holder = machine.currentUser?.name;
    if (pending === 'release') {
      return {
        title: 'Release the machine',
        message:
          'The server sets the machine back to free to claim and clears the claim, so a resident of the floor can take it right away. It writes an update entry in the audit log. ' +
          (holder
            ? `The resident who held it (${holder}) is not told: they see the machine free the next time they open the app.`
            : 'The resident who held it is not told: they see the machine free the next time they open the app.'),
        confirmLabel: 'Release it',
        variant: 'warning' as const,
      };
    }
    if (pending === 'down') {
      return {
        title: 'Report the machine as down',
        message:
          'The server writes the state down and clears the claim on the machine, so nobody can claim it until it is brought back. It writes an update entry in the audit log. ' +
          (holder
            ? `The resident holding it (${holder}) loses the machine right away and is not told: they meet the refusal when they try to claim it.`
            : 'The residents of the floor are not told: they meet the refusal when they try to claim it.'),
        confirmLabel: 'Report it down',
        variant: 'danger' as const,
      };
    }
    return {
      title: 'Bring the machine back into the pool',
      message:
        'The server writes the state free to claim and clears any claim on the machine, so a resident of the floor can claim it right away. It writes an update entry in the audit log. The residents of the floor are not told: they read the machine list themselves.',
      confirmLabel: 'Bring it back',
      variant: 'warning' as const,
    };
  })();

  return (
    <FormPage
      title={machine ? machineName(machine) : 'Washing machine'}
      description={machine ? `Machine #${machine.machineNumber} on ${floorName(machine)}` : ''}
      backHref="/washing-machines"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        machine ? (
          <StatusBadge
            variant={statusToVariant(machine.status)}
            label={statusLabel(machine.status)}
          />
        ) : undefined
      }
      actions={
        machine ? (
          <div className="flex flex-wrap items-center gap-2">
            {isInUse && (
              <Button variant="outline" size="sm" onClick={() => setPending('release')}>
                <RefreshCw className="h-4 w-4" />
                Release Machine
              </Button>
            )}
            {machine.status !== 'down' && (
              <Button variant="outline" size="sm" onClick={() => setPending('down')}>
                <TriangleAlert className="h-4 w-4" />
                Report Down
              </Button>
            )}
            {isOutOfPool && (
              <Button variant="outline" size="sm" onClick={() => setPending('available')}>
                <Wrench className="h-4 w-4" />
                Bring Back
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/washing-machines/${machine._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {machine && (
        <ContentFrame
          rail={
            <>
              {/* The machine itself: the numbers the server holds for it. */}
              <DetailCard title="The machine" icon={<WashingMachine />}>
                <DetailList>
                  <DetailRow label="Machine number" value={`#${machine.machineNumber}`} />
                  <DetailRow
                    label="Floor"
                    value={
                      machine.floorId ? (
                        <Link
                          href={`/floors/${machine.floorId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {floorName(machine)}
                        </Link>
                      ) : (
                        floorName(machine)
                      )
                    }
                  />
                  <DetailRow label="Default hold" value={`${machine.timerDuration ?? 0} min`} />
                  <DetailRow
                    label="State"
                    value={
                      <StatusBadge
                        variant={statusToVariant(machine.status)}
                        label={statusLabel(machine.status)}
                        size="xs"
                      />
                    }
                  />
                  <DetailRow label="Last used" value={formatDateTime(machine.lastUsedAt)} />
                  <DetailRow label="Registered" value={formatDateTime(machine.createdAt)} />
                </DetailList>
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  A resident chooses the length of a claim between {TIMER_MIN} and {TIMER_MAX}{' '}
                  minutes, and the machine is held for that window. When the window runs out the
                  server releases the machine on its own, every minute.
                </p>
              </DetailCard>

              {/* Who holds it, named and linked. */}
              <DetailCard title="Who holds it" icon={<User />}>
                {machine.currentUser ? (
                  <DetailList>
                    <DetailRow
                      label="Resident"
                      value={
                        holderId ? (
                          <Link
                            href={`/tenants/${holderId}`}
                            className="font-semibold text-(--color-brand-600) hover:underline"
                          >
                            {machine.currentUser.name ?? 'The resident'}
                          </Link>
                        ) : (
                          (machine.currentUser.name ?? 'The resident')
                        )
                      }
                    />
                    <DetailRow label="Room" value={machine.currentUser.room ?? 'Not recorded'} />
                    <DetailRow label="Claimed at" value={formatDateTime(machine.claimedAt)} />
                    <DetailRow
                      label="Held until"
                      value={
                        timer ? (
                          <span
                            className={clsx(
                              timer.overdue
                                ? 'text-(--color-warning-700)'
                                : 'text-(--color-text-primary)',
                            )}
                          >
                            {timer.label}
                          </span>
                        ) : (
                          'Not recorded'
                        )
                      }
                    />
                  </DetailList>
                ) : (
                  <p className="text-sm font-medium text-(--color-text-secondary)">
                    Nobody holds this machine right now. A resident of the floor claims it from
                    their own machine list, and the server refuses a claim on a machine that is not
                    free to claim.
                  </p>
                )}
              </DetailCard>

              {/* What the residents are told, and what they are not. */}
              <DetailCard title="What the residents are told" icon={<Clock />}>
                <p className="text-2xs leading-relaxed font-medium text-(--color-text-secondary)">
                  Nothing. The server sends no message for a claim, a release or a state change. The
                  residents are pulled, not pushed: they read the machine list of their own floor
                  right before they claim, and a claim on a machine that is not free to claim is
                  refused. That list is the channel of this module.
                </p>
              </DetailCard>

              {/* The office actions of this module, on the page of the machine
                  they act on, with the rule the server applies to each. */}
              <DetailCard title="The office can act here" icon={<Wrench />}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Release a claim that is stuck
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server sets the machine free to claim and clears the claim, whatever the
                      timer says. The resident is not told.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Report a machine as down
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the state down and clears the claim, so the machine leaves
                      the pool a resident claims from. The residents are not told: they meet the
                      refusal.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Bring a machine back
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the state free to claim and clears any claim, so the machine
                      joins the pool again. The residents are not told: they read the list.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Write a claim yourself
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server refuses it. A claim is written by a resident, and only a resident:
                      the claim route answers anyone else with a refusal.
                    </p>
                  </div>
                </div>
              </DetailCard>
            </>
          }
        >
          <div className="space-y-4">
            {writeResult && (
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
                {writeResult}
              </div>
            )}

            {/* The protagonist of this page: the state of the machine, who
                holds it and how long the machine is held for. */}
            <DetailCard
              title="The state of the machine"
              icon={<Timer />}
              variant={
                machine.status === 'down'
                  ? 'danger'
                  : machine.status === 'under_maintenance'
                    ? 'warning'
                    : machine.status === 'in_use'
                      ? 'info'
                      : 'success'
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  variant={statusToVariant(machine.status)}
                  label={statusLabel(machine.status)}
                />
                <p className="text-sm font-medium text-(--color-text-secondary)">
                  {STATUS_MEANING[machine.status] ?? 'the state of the machine is not known'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    The claim on it
                  </p>
                  <p className="text-sm font-semibold text-(--color-text-primary)">
                    {machine.currentUser
                      ? `${machine.currentUser.name ?? 'A resident'}${
                          machine.currentUser.room ? `, room ${machine.currentUser.room}` : ''
                        }`
                      : 'Nobody holds it'}
                  </p>
                  <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                    {machine.currentUser
                      ? 'Claimed at ' + formatDateTime(machine.claimedAt)
                      : 'A resident of the floor claims it from their own machine list.'}
                  </p>
                </div>
                <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    The timer
                  </p>
                  <p
                    className={clsx(
                      'text-sm font-semibold',
                      timer?.overdue ? 'text-(--color-warning-700)' : 'text-(--color-text-primary)',
                    )}
                  >
                    {timer?.label ?? 'Not recorded'}
                  </p>
                  <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                    A claim holds the machine for {machine.timerDuration ?? 0} minutes unless the
                    resident picks a shorter window. The server releases it on its own when the
                    window runs out.
                  </p>
                </div>
              </div>
            </DetailCard>

            {/* The claims of this machine: the one that runs now and the ones
                that came before it. */}
            <DetailCard title="The claims of this machine" icon={<History />}>
              {eventsLoading ? (
                <TextSkeleton lines={3} />
              ) : events.length > 0 ? (
                <Timeline
                  events={events.map((event) => ({
                    id: event._id,
                    date: event.timestamp,
                    title: eventTitle(event),
                    description: eventDescription(event),
                    status: eventTone(event),
                  }))}
                />
              ) : (
                <p className="text-sm font-medium text-(--color-text-muted)">
                  The server holds no entry for this machine yet. A claim, a release and a state
                  change are all written here as they happen.
                </p>
              )}
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The trail is the server&apos;s and it is deleted after 90 days. The record of the
                machine holds the claim that runs now; everything before it is here.
              </p>
            </DetailCard>

            {/* The machine itself. */}
            <DetailCard title="The machine record" icon={<WashingMachine />}>
              <DetailList>
                <DetailRow label="Label" value={machine.label || 'Not named'} />
                <DetailRow label="Machine number" value={`#${machine.machineNumber}`} />
                <DetailRow
                  label="Floor"
                  value={
                    machine.floorId ? (
                      <Link
                        href={`/floors/${machine.floorId}`}
                        className="font-semibold text-(--color-brand-600) hover:underline"
                      >
                        {floorName(machine)}
                      </Link>
                    ) : (
                      floorName(machine)
                    )
                  }
                />
                <DetailRow label="Default hold" value={`${machine.timerDuration ?? 0} min`} />
                <DetailRow label="Last used" value={formatDateTime(machine.lastUsedAt)} />
                <DetailRow label="Registered" value={formatDateTime(machine.createdAt)} />
              </DetailList>
            </DetailCard>

            {machine.notes ? (
              <DetailCard title="Notes" variant="warning">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-(--color-text-secondary)">
                  {machine.notes}
                </p>
              </DetailCard>
            ) : null}

            <p className="text-right text-xs font-semibold text-(--color-text-muted)">
              Last used: {formatDateTime(machine.lastUsedAt)}
            </p>
          </div>
        </ContentFrame>
      )}

      <ConfirmModal
        open={pending !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.confirmLabel ?? 'Confirm'}
        variant={confirmCopy?.variant ?? 'warning'}
        loading={writing}
        onConfirm={() => void runWrite()}
        onCancel={() => setPending(null)}
      />
    </FormPage>
  );
}
