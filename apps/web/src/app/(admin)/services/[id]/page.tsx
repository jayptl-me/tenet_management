'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  FileText,
  Pencil,
  Trash2,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /services/:id                      apps/api/src/routes/services.ts:464-477
//   GET /floors/:floorId/rooms             apps/api/src/routes/floors.ts:188-260
//   GET /audit-logs?resource&resourceId    apps/api/src/routes/audit.ts:13-52
//   PUT  /services/:id                     apps/api/src/routes/services.ts:361-461
//   DELETE /services/:id                   apps/api/src/routes/services.ts:572-597

interface ServiceDetail {
  _id: string;
  serviceType: string;
  status: string;
  note?: string;
  floor?: { _id?: string; label?: string; floorNumber?: number };
  lastUpdatedBy?: { name?: string };
  lastUpdatedAt?: string;
  openComplaintCount?: number;
  updatedAt?: string;
}

interface FloorRooms {
  floor?: { _id?: string; label?: string; floorNumber?: number };
  rooms?: Array<{
    _id: string;
    roomNumber: string;
    isActive?: boolean;
    beds?: Array<{
      bedId: string;
      isOccupied: boolean;
      tenantId?: string | null;
      tenantName?: string | null;
    }>;
  }>;
  stats?: {
    activeRooms: number;
    inactiveRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyPct: number;
    potentialRent: number;
  };
}

interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

/** One resident of the floor, as the server holds them. */
interface Resident {
  key: string;
  name: string;
  tenantId: string | null;
  roomNumber: string;
  bedId: string;
}

const SERVICE_KEY = (id: string) => ['services', id] as const;
const SERVICE_FLOOR_KEY = (id: string) => ['services', id, 'floor'] as const;
const SERVICE_AUDIT_KEY = (id: string) => ['services', id, 'audit'] as const;

/** The status vocabulary of the model. */
const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational - it works' },
  { value: 'degraded', label: 'Degraded - it works badly' },
  { value: 'down', label: 'Down - it does not work' },
];

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'not reported';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'not reported';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatServiceType(serviceType: string): string {
  return serviceType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * One line of the write trail of a service.
 *
 * The audit entry is the proof of what the office did, and the details the
 * server wrote with it say whether the state moved, which is the moment the
 * server pushes the residents of the floor.
 */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  const serviceType =
    typeof details.serviceType === 'string' ? formatServiceType(details.serviceType) : 'the service';
  if (entry.action === 'create') {
    const status = typeof details.status === 'string' ? details.status : 'operational';
    return `The row was created for ${serviceType} in state ${status}.`;
  }
  if (entry.action === 'delete') {
    return `The row of ${serviceType} was removed. The floor loses the service until the seed creates it again, and the residents were not told.`;
  }
  const previous = typeof details.previousStatus === 'string' ? details.previousStatus : null;
  const status = typeof details.status === 'string' ? details.status : null;
  const noteChanged = details.noteChanged === true;
  if (previous && status && previous !== status) {
    return `The state moved from ${previous} to ${status}, so the server pushed a service update to the active residents of the floor.${noteChanged ? ' The note changed with it.' : ''}`;
  }
  if (noteChanged) {
    return 'The note changed. The state did not move, so no message went to the residents.';
  }
  return `The row of ${serviceType} was written.`;
}

/**
 * The primary action of the record: set the state of the service.
 *
 * The form state starts from the record, so the panel opens on the state the
 * server holds and not on a default. The parent mounts this with the record
 * id as its key, so a different record starts from its own state.
 */
function StatusAction({
  service,
  floorLabel,
  onSaved,
  onFailed,
}: {
  service: ServiceDetail;
  floorLabel: string;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState(service.status);
  const [note, setNote] = useState(service.note ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api
        .put(`services/${service._id}`, {
          json: { status: nextStatus, note },
        })
        .json();
      const moved = service.status !== nextStatus;
      onSaved(
        moved
          ? `${formatServiceType(service.serviceType)} on ${floorLabel} is ${nextStatus} now. The server wrote the status, stamped the record with your name and the time, wrote an update entry in the audit log and pushed a service update to the active residents of ${floorLabel}. A floor with nobody living on it has nobody to tell, and a failed push never undoes the write.`
          : `The note was written. The server stamped the record with your name and the time and wrote an update entry in the audit log. The state did not move, so no message went to the residents.`,
      );
    } catch (err) {
      onFailed((await parseApiError(err)).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailCard
      title={`Set the state of ${formatServiceType(service.serviceType)} on ${floorLabel}`}
      icon={<Wrench />}
      variant={service.status === 'operational' ? 'default' : 'warning'}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="State"
          size="compact"
          options={STATUS_OPTIONS}
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value)}
        />
        <Textarea
          label="Note"
          rows={2}
          maxLength={500}
          placeholder="What is wrong, and until when..."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          helperText="The note goes into the audit entry and into the message the residents of the floor receive."
        />
      </div>
      <p className="text-2xs mt-3 font-medium text-(--color-text-secondary)">
        The server writes the state, stamps the record with your name and the time and writes an
        update entry in the audit log. When the state actually moves it pushes a service update to
        the active residents of {floorLabel}. A note on its own does not reach them, and a failed
        push never undoes the write.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void submit()} disabled={saving} loading={saving}>
          Save the state
        </Button>
        <Link
          href={`/services/${service._id}/edit`}
          className="text-2xs font-semibold text-(--color-brand-600) hover:underline"
        >
          Change the service type or the note on the edit page
        </Link>
      </div>
    </DetailCard>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const {
    data: rawService,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<ServiceDetail>(SERVICE_KEY(id), `services/${id}`, { enabled: Boolean(id) });

  // The server answers with one service object. Anything else is not a service,
  // and the page says so instead of rendering an empty record.
  const service = rawService && !Array.isArray(rawService) ? rawService : null;
  const floorId = service?.floor?._id;

  /**
   * The residents of the floor of this service.
   *
   * A service belongs to a floor, so the residents it reaches are the
   * residents of that floor, read from the rooms the server holds.
   */
  const { data: floorData } = useApiQuery<FloorRooms>(
    SERVICE_FLOOR_KEY(id),
    `floors/${floorId}/rooms`,
    { enabled: Boolean(floorId) },
  );

  /**
   * The write trail of this service.
   *
   * The audit route filters by the record, so this is the trail of this
   * service and not of every service (apps/api/src/routes/audit.ts:19-24). The
   * server keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    SERVICE_AUDIT_KEY(id),
    `audit-logs?resource=service&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  const residents = useMemo<Resident[]>(() => {
    const list: Resident[] = [];
    for (const room of floorData?.rooms ?? []) {
      for (const bed of room.beds ?? []) {
        if (!bed.isOccupied) continue;
        list.push({
          key: `${room._id}-${bed.bedId}`,
          name: bed.tenantName ?? 'A resident',
          tenantId: bed.tenantId ?? null,
          roomNumber: room.roomNumber,
          bedId: bed.bedId,
        });
      }
    }
    return list;
  }, [floorData]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SERVICE_KEY(id) });
    queryClient.invalidateQueries({ queryKey: SERVICE_FLOOR_KEY(id) });
    queryClient.invalidateQueries({ queryKey: SERVICE_AUDIT_KEY(id) });
    queryClient.invalidateQueries({ queryKey: ['services', 'set'] });
    queryClient.invalidateQueries({ queryKey: ['floors', 'overview'] });
  }, [queryClient, id]);

  /**
   * Remove the row of this service.
   *
   * The server deletes the row and writes a delete entry in the audit log. It
   * is a hard delete: the floor loses the service until the seed creates it
   * again, and the residents of the floor are not told.
   */
  const handleRemove = async () => {
    if (!service) return;
    setRemoving(true);
    setError('');
    try {
      await api.delete(`services/${service._id}`).json();
      queryClient.invalidateQueries({ queryKey: ['services', 'set'] });
      queryClient.invalidateQueries({ queryKey: ['floors', 'overview'] });
      router.push('/services');
    } catch (err) {
      setRemoveOpen(false);
      setError((await parseApiError(err)).message);
    } finally {
      setRemoving(false);
    }
  };

  if (!isLoading && (errorMessage(queryError) || !service)) {
    return (
      <FormPage
        title="Service"
        description="The state of one service on one floor"
        backHref="/services"
        error={errorMessage(queryError) || 'The server reports no service for this id.'}
        maxWidth="full"
      />
    );
  }

  const floorLabelText = service?.floor?.label ?? 'No floor';
  const statusVariant = service ? statusToVariant(service.status) : 'neutral';
  const serviceLabel = service ? formatServiceType(service.serviceType) : 'Service';

  return (
    <FormPage
      title={serviceLabel}
      description={
        service
          ? `${floorLabelText}${service.floor?.floorNumber != null ? ` (Floor #${service.floor.floorNumber})` : ''}`
          : 'The state of one service on one floor'
      }
      backHref="/services"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        service ? (
          <StatusBadge variant={statusVariant} label={service.status.replace(/_/g, ' ')} />
        ) : undefined
      }
      actions={
        service ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/services/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Remove the row
            </Button>
          </div>
        ) : undefined
      }
    >
      {service && (
        <ContentFrame
          rail={
            <>
              {/* The floor the service belongs to, and the way into its rooms. */}
              <DetailCard title="The floor" icon={<Building2 />}>
                <DetailList>
                  <DetailRow
                    label="Floor"
                    value={
                      floorId ? (
                        <Link
                          href={`/floors/${floorId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {floorLabelText}
                        </Link>
                      ) : (
                        floorLabelText
                      )
                    }
                  />
                  <DetailRow
                    label="Its rooms"
                    value={
                      floorId ? (
                        <Link
                          href={`/rooms?floorId=${floorId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          every room of {floorLabelText}
                        </Link>
                      ) : (
                        'this service is on no floor'
                      )
                    }
                  />
                  <DetailRow
                    label="Rooms in service"
                    value={
                      floorData?.stats
                        ? `${floorData.stats.activeRooms} of ${floorData.stats.activeRooms + floorData.stats.inactiveRooms}`
                        : 'not reported'
                    }
                  />
                  <DetailRow
                    label="Residents on the floor"
                    value={
                      floorData?.stats
                        ? `${floorData.stats.occupiedBeds} of ${floorData.stats.totalBeds} beds taken`
                        : 'not reported'
                    }
                  />
                  <DetailRow label="Open complaints" value={`${service.openComplaintCount ?? 0}`} />
                </DetailList>
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  A service belongs to a floor, so the residents it reaches are the residents of that
                  floor. The complaint count is the server&apos;s own: the open complaints of the
                  rooms of the floor in the categories mapped to this service.
                </p>
              </DetailCard>

              {/* The record itself. */}
              <DetailCard title="The service" icon={<Wrench />}>
                <DetailList>
                  <DetailRow label="Service" value={serviceLabel} />
                  <DetailRow
                    label="State"
                    value={
                      <StatusBadge variant={statusVariant} label={service.status.replace(/_/g, ' ')} />
                    }
                  />
                  <DetailRow
                    label="Last updated"
                    value={formatDateTime(service.lastUpdatedAt ?? service.updatedAt)}
                  />
                  <DetailRow label="By" value={service.lastUpdatedBy?.name ?? 'the office'} />
                </DetailList>
              </DetailCard>
            </>
          }
        >
          {(error || errorMessage(queryError)) && (
            <ErrorBanner message={error || errorMessage(queryError)} />
          )}

          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {/* The primary action of the record, at the top of the page. */}
          <StatusAction
            key={service._id}
            service={service}
            floorLabel={floorLabelText}
            onSaved={(message) => {
              setWriteResult(message);
              refresh();
            }}
            onFailed={(message) => setError(message)}
          />

          {/* Who this reaches. */}
          <DetailCard
            title="The residents this reaches"
            icon={<Users />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                {residents.length} resident{residents.length === 1 ? '' : 's'} on the floor
              </span>
            }
          >
            {floorId === undefined ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                This service is on no floor, so it reaches nobody.
              </p>
            ) : residents.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server reports no resident on this floor. A floor with nobody living on it has
                nobody to tell, so a state change on it reaches nobody.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {residents.map((resident) => (
                  <li
                    key={resident.key}
                    className="flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2"
                  >
                    <span className="min-w-0">
                      {resident.tenantId ? (
                        <Link
                          href={`/tenants/${resident.tenantId}`}
                          className="block truncate text-xs font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {resident.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs font-semibold text-(--color-text-primary)">
                          {resident.name}
                        </span>
                      )}
                      <span className="text-2xs font-medium text-(--color-text-muted)">
                        Room {resident.roomNumber} · Bed {resident.bedId}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              The server pushes a service update to the active residents of the floor when the state
              moves. The list above is the beds the server reports as taken on that floor; the two
              counts differ when a resident record and a bed disagree, and the reconcile on the rooms
              list reports that as an orphan.
            </p>
          </DetailCard>

          {service.note ? (
            <DetailCard title="The note" icon={<FileText />} variant="warning">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-(--color-text-secondary)">
                {service.note}
              </p>
            </DetailCard>
          ) : null}

          {/* The write trail of this service. */}
          <DetailCard
            title="What the office did to this service"
            icon={<FileText />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditTrail?.length ?? 0} entries
              </span>
            }
          >
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no write entry for this service in the entries it keeps (the entries
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

          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
            A state change reaches the residents of the floor through the server only. If the push
            failed, the record still reads the new state and the residents are still without the
            service: the write trail above says when the state moved, and the office has to tell the
            floor by hand.
          </p>
        </ContentFrame>
      )}

      <ConfirmModal
        open={removeOpen}
        title="Remove this service row"
        message={`The server deletes the row of ${serviceLabel} on ${floorLabelText} and writes a delete entry in the audit log. The floor loses the service until the seed creates it again, and the residents of the floor are not told.`}
        confirmLabel="Remove the row"
        loading={removing}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveOpen(false)}
      />
    </FormPage>
  );
}
