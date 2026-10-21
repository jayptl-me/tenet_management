'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  BedDouble,
  Building2,
  DoorOpen,
  History,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
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
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { FormPage } from '@/components/ui/FormPage';
import { OccupancyBar } from '@/components/ui/BedMiniGrid';
import { PageBand } from '@/components/ui/PageBand';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';
import type { IAppConfig } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /floors/:id                       apps/api/src/routes/floors.ts:175-183
//   GET /floors/:id/rooms                 apps/api/src/routes/floors.ts:188-260
//   GET /services/floor/:floorId/with-complaints  apps/api/src/routes/services.ts:256-276
//   GET /audit-logs?resource=floor        apps/api/src/routes/audit.ts:13-52
//   GET /washing-machines?floorId=        apps/api/src/routes/washingMachines.ts:94-98
//   DELETE /rooms/:id                     apps/api/src/routes/rooms.ts:799-845
//   POST /services                        apps/api/src/routes/services.ts:279-358

interface FloorRecord {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
  createdAt?: string;
}

interface FloorBed {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
}

interface FloorRoom {
  _id: string;
  roomNumber: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  beds?: FloorBed[];
}

interface FloorRoomStats {
  activeRooms: number;
  inactiveRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  potentialRent: number;
}

interface FloorRoomsBody {
  floor: FloorRecord;
  rooms: FloorRoom[];
  stats: FloorRoomStats;
}

interface FloorServiceRow {
  _id?: string;
  serviceType: string;
  status: 'operational' | 'degraded' | 'down';
  note?: string;
  openComplaintCount?: number;
  lastUpdatedAt?: string;
}

interface FloorServicesBody {
  services: FloorServiceRow[];
  totalRooms: number;
}

interface MachineListing {
  _id: string;
  machineNumber: number;
  label?: string;
  status: string;
}

/** One entry of the write trail of a floor. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'not reported';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'not reported';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The label of an amenity key, when the app config does not carry one. */
function amenityLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** The label the office knows a service by, with a readable fallback. */
function serviceLabel(key: string, label?: string): string {
  return label !== undefined && label.trim() !== '' ? label : amenityLabel(key);
}

/**
 * One line of the write trail of a floor.
 *
 * The audit entry is the proof of what the office did. The details the server
 * wrote with it are what the office is told.
 */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  if (entry.action === 'create') {
    const level = typeof details.floorNumber === 'number' ? details.floorNumber : null;
    const rooms = typeof details.totalRooms === 'number' ? details.totalRooms : null;
    return `The floor was created${level !== null ? ` as level ${level}` : ''}${
      rooms !== null ? ` with a room count of ${rooms}` : ''
    }. The server seeded a service status for every per-floor amenity definition it holds.`;
  }
  if (entry.action === 'update') {
    const fields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
    const reseeded = details.reseededServices === true;
    if (reseeded) {
      const touched = typeof details.floorsTouched === 'number' ? details.floorsTouched : 0;
      const created = typeof details.rowsCreated === 'number' ? details.rowsCreated : 0;
      return `The server seeded the missing service rows of the building: ${created} row(s) across ${touched} floor(s). It writes this entry against every floor, not against one.`;
    }
    return `The floor was updated. The server wrote an update entry with the fields that moved${
      fields.length > 0 ? `: ${fields.join(', ')}` : ''
    }. It recounts the rooms of the floors that moved.`;
  }
  if (entry.action === 'delete') {
    return 'The floor was deleted. The server removed the floor row and the service rows that belonged to it.';
  }
  return `The server wrote a ${entry.action} entry for this floor.`;
}

const FLOOR_KEY = (id: string) => ['floors', id] as const;
const FLOOR_ROOMS_KEY = (id: string) => ['floors', id, 'rooms'] as const;
const FLOOR_SERVICES_KEY = (id: string) => ['floors', id, 'services'] as const;
const FLOOR_AUDIT_KEY = (id: string) => ['floors', id, 'audit'] as const;
const MACHINES_KEY = (id: string) => ['washing-machines', 'by-floor', id] as const;
const APP_CONFIG_KEY = ['app-config'] as const;

/** A stable empty fallback, so the memos that read it do not churn. */
const EMPTY_ROOMS: FloorRoom[] = [];
const EMPTY_SERVICES: FloorServiceRow[] = [];
const EMPTY_AUDIT: AuditEntry[] = [];
const EMPTY_MACHINES: MachineListing[] = [];

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [outOfServiceTarget, setOutOfServiceTarget] = useState<FloorRoom | null>(null);
  const [outOfServiceBusy, setOutOfServiceBusy] = useState(false);
  const [provisioningKey, setProvisioningKey] = useState<string>('');
  /**
   * The key of the shared service grid.
   *
   * The grid reads the service rows itself, so a write on this page does not
   * reach it. The key remounts it after a write, and the grid reads the rows
   * the server holds again.
   */
  const [servicesEpoch, setServicesEpoch] = useState(0);

  const {
    data: floor = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<FloorRecord>(FLOOR_KEY(id), `floors/${id}`, { enabled: Boolean(id) });

  const { data: roomsData } = useApiQuery<FloorRoomsBody>(
    FLOOR_ROOMS_KEY(id),
    `floors/${id}/rooms`,
    { enabled: Boolean(id) },
  );

  /**
   * The service rows of this floor.
   *
   * The shared FloorServiceGrid reads the same endpoint for the health it
   * draws. This read is what tells the office which per-floor amenity has no
   * row on this floor at all, which is a gap in the record and not a healthy
   * service.
   */
  const { data: servicesData } = useApiQuery<FloorServicesBody>(
    FLOOR_SERVICES_KEY(id),
    `services/floor/${id}/with-complaints`,
    { enabled: Boolean(id) },
  );

  const { data: auditEntries } = useApiQuery<AuditEntry[]>(
    FLOOR_AUDIT_KEY(id),
    `audit-logs?resource=floor&resourceId=${encodeURIComponent(id)}&limit=20`,
    { enabled: Boolean(id) },
  );

  const { data: machines } = useApiQuery<MachineListing[]>(
    MACHINES_KEY(id),
    `washing-machines?floorId=${encodeURIComponent(id)}`,
    { enabled: Boolean(id) },
  );

  const { data: appConfig } = useApiQuery<IAppConfig>(APP_CONFIG_KEY, 'app-config');

  const rooms = roomsData?.rooms ?? EMPTY_ROOMS;
  const services = servicesData?.services ?? EMPTY_SERVICES;
  const audit = auditEntries ?? EMPTY_AUDIT;
  const machineList = machines ?? EMPTY_MACHINES;

  const queryErrorMessage = errorMessage(queryError);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: FLOOR_KEY(id) });
    void queryClient.invalidateQueries({ queryKey: FLOOR_ROOMS_KEY(id) });
    void queryClient.invalidateQueries({ queryKey: FLOOR_SERVICES_KEY(id) });
    void queryClient.invalidateQueries({ queryKey: FLOOR_AUDIT_KEY(id) });
    void queryClient.invalidateQueries({ queryKey: ['floors', 'overview'] });
    void queryClient.invalidateQueries({ queryKey: MACHINES_KEY(id) });
  }, [queryClient, id]);

  /**
   * The floor, as the server holds it.
   *
   * The room count comes from the server: the room hooks recount the active
   * rooms of the floor on every room save and retire, so the number the floor
   * carries and the number of rooms on the screen are the same number.
   */
  const stats = roomsData?.stats ?? null;
  const activeRooms = rooms.filter((room) => room.isActive !== false);
  const inactiveRooms = rooms.filter((room) => room.isActive === false);
  const bedsOfActiveRooms = activeRooms.flatMap((room) => room.beds ?? []);
  const occupiedBeds = bedsOfActiveRooms.filter((bed) => bed.isOccupied).length;

  /** The per floor amenity definitions the app config holds. */
  const perFloorDefinitions = useMemo(
    () => (appConfig?.amenityDefinitions ?? []).filter((definition) => definition.isPerFloor),
    [appConfig],
  );

  /** The definitions this floor has no service row for. */
  const missingServices = useMemo(() => {
    const held = new Set(services.map((service) => service.serviceType));
    return perFloorDefinitions.filter((definition) => !held.has(definition.key));
  }, [perFloorDefinitions, services]);

  /** The health of the services of this floor, worst state first. */
  const serviceHealth = useMemo(() => {
    const down = services.filter((service) => service.status === 'down').length;
    const degraded = services.filter((service) => service.status === 'degraded').length;
    const operational = services.filter((service) => service.status === 'operational').length;
    if (services.length === 0) {
      return {
        label: 'No services set up',
        variant: 'neutral' as const,
        down,
        degraded,
        operational,
      };
    }
    if (down > 0) {
      return {
        label: `${down} service${down === 1 ? '' : 's'} down`,
        variant: 'danger' as const,
        down,
        degraded,
        operational,
      };
    }
    if (degraded > 0) {
      return {
        label: `${degraded} service${degraded === 1 ? '' : 's'} degraded`,
        variant: 'warning' as const,
        down,
        degraded,
        operational,
      };
    }
    return {
      label: 'Every service works',
      variant: 'success' as const,
      down,
      degraded,
      operational,
    };
  }, [services]);

  /**
   * Provision one service on this floor.
   *
   * The server writes the row with the status operational, stamps it with the
   * office and the time, and writes a create entry in the audit log under the
   * service. It tells nobody: a row that was missing is a row nobody had
   * reported.
   */
  const handleProvision = async (serviceType: string, label: string) => {
    setProvisioningKey(serviceType);
    setError('');
    setWriteResult('');
    try {
      await api
        .post('services', {
          json: { floorId: id, serviceType, status: 'operational' },
        })
        .json();
      setWriteResult(
        `${label} is now tracked on this floor. The server created the service row with the status ` +
          `operational, stamped it with the office and the time and wrote a create entry in the ` +
          `audit log under the service. It tells nobody: a row that was missing is a row nobody had ` +
          `reported.`,
      );
      refresh();
      setServicesEpoch((epoch) => epoch + 1);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setProvisioningKey('');
    }
  };

  /**
   * Take a room of this floor out of service.
   *
   * The server keeps the room record and sets its active flag to false, so
   * the room leaves the lists a new resident is picked from, and it recounts
   * the rooms of this floor. It refuses while a resident still occupies the
   * room.
   */
  const handleOutOfService = async () => {
    if (!outOfServiceTarget) return;
    setOutOfServiceBusy(true);
    setError('');
    try {
      await api.delete(`rooms/${outOfServiceTarget._id}`).json();
      setWriteResult(
        `Room ${outOfServiceTarget.roomNumber} is out of service. The server kept the record, set ` +
          `the active flag to false, recounted the rooms of this floor and wrote a delete entry in ` +
          `the audit log. It pushes a service update to the residents of the room, but it refuses ` +
          `the retire while a resident still occupies it, so there is nobody left to tell.`,
      );
      setOutOfServiceTarget(null);
      refresh();
    } catch (err) {
      setError((await parseApiError(err)).message);
      setOutOfServiceTarget(null);
    } finally {
      setOutOfServiceBusy(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !floor)) {
    return (
      <FormPage
        title="Floor"
        description="The level of the building"
        backHref="/floors"
        error={queryErrorMessage || 'The server reports no floor for this id.'}
        maxWidth="full"
      />
    );
  }

  const occupiedBedsOfRoom = (room: FloorRoom): number =>
    (room.beds ?? []).filter((bed) => bed.isOccupied).length;

  return (
    <FormPage
      title={floor ? floor.label : 'Floor'}
      description={
        floor
          ? `Level ${floor.floorNumber} · ${
              stats?.activeRooms ?? activeRooms.length
            } room(s) in service · ${
              stats?.occupiedBeds ?? occupiedBeds
            } of ${stats?.totalBeds ?? bedsOfActiveRooms.length} beds taken`
          : 'The level of the building'
      }
      backHref="/floors"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        floor ? (
          <StatusBadge variant={serviceHealth.variant} label={serviceHealth.label} />
        ) : undefined
      }
      actions={
        floor ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/rooms/new?floorId=${floor._id}`)}
            >
              <UserPlus className="h-4 w-4" />
              Add Room
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/services?floorId=${floor._id}`)}
            >
              <Wrench className="h-4 w-4" />
              Services
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/floors/${floor._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Rename floor
            </Button>
          </div>
        ) : undefined
      }
    >
      {floor && (
        <ContentFrame
          rail={
            <>
              {/* The floor itself: the record the server holds for it. */}
              <DetailCard title="The floor" icon={<Building2 />}>
                <DetailList>
                  <DetailRow label="Label" value={floor.label} />
                  <DetailRow label="Level" value={String(floor.floorNumber)} />
                  <DetailRow
                    label="Rooms in service"
                    value={`${stats?.activeRooms ?? activeRooms.length} of ${floor.totalRooms}`}
                  />
                  <DetailRow
                    label="Beds taken"
                    value={`${stats?.occupiedBeds ?? occupiedBeds} of ${stats?.totalBeds ?? bedsOfActiveRooms.length}`}
                  />
                  <DetailRow
                    label="Beds free"
                    value={String(
                      stats?.vacantBeds ?? Math.max(0, bedsOfActiveRooms.length - occupiedBeds),
                    )}
                  />
                  <DetailRow label="Floor rent /mo" value={fmtMoney(stats?.potentialRent ?? 0)} />
                  <DetailRow label="Created" value={formatDate(floor.createdAt)} />
                </DetailList>
              </DetailCard>

              {/* What the floor carries: the hardware of the level. */}
              {(floor.amenityCounts ?? []).length > 0 && (
                <DetailCard title="What this floor carries" icon={<ShieldCheck />}>
                  <ul className="space-y-1.5">
                    {(floor.amenityCounts ?? []).map((count) => (
                      <li
                        key={count.amenityKey}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-semibold text-(--color-text-primary)">
                          {amenityLabel(count.amenityKey)}
                        </span>
                        <span className="text-xs font-bold text-(--color-text-secondary) tabular-nums">
                          {count.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                    These are the units the office counts for this level. The health of the service
                    itself is a service record, and it lives on the service board.
                  </p>
                </DetailCard>
              )}

              {machineList.length > 0 && (
                <DetailCard title={`Washing machines (${machineList.length})`} icon={<Wrench />}>
                  <ul className="space-y-1.5">
                    {machineList.map((machine) => (
                      <li key={machine._id} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-(--color-text-primary)">
                          Machine #{machine.machineNumber}
                          {machine.label ? ` · ${machine.label}` : ''}
                        </span>
                        <StatusBadge
                          variant={
                            machine.status === 'available'
                              ? 'success'
                              : machine.status === 'in_use'
                                ? 'warning'
                                : 'danger'
                          }
                          label={machine.status.replace(/_/g, ' ')}
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                    A washing machine on the floor blocks the deletion of the floor while it is
                    there.
                  </p>
                </DetailCard>
              )}
            </>
          }
        >
          <div className="space-y-6">
            <ErrorBanner message={queryErrorMessage || error} />

            {writeResult && (
              <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
                {writeResult}
              </div>
            )}

            {/* The band of the floor: what it holds and how healthy it is. Every
                number is the server's own figure for this floor. */}
            <PageBand
              metrics={[
                {
                  label: 'Beds taken',
                  value: `${stats?.occupiedBeds ?? occupiedBeds} / ${stats?.totalBeds ?? bedsOfActiveRooms.length}`,
                  hint: 'of the beds of the rooms in service',
                  tone: 'brand',
                },
                {
                  label: 'Beds free',
                  value: String(
                    stats?.vacantBeds ?? Math.max(0, bedsOfActiveRooms.length - occupiedBeds),
                  ),
                  hint: 'a bed with no resident in it',
                  tone: (stats?.vacantBeds ?? 0) === 0 ? 'warning' : 'success',
                },
                {
                  label: 'Rooms in service',
                  value: `${stats?.activeRooms ?? activeRooms.length} / ${floor.totalRooms}`,
                  hint:
                    (stats?.inactiveRooms ?? inactiveRooms.length) > 0
                      ? `${stats?.inactiveRooms ?? inactiveRooms.length} room(s) out of service`
                      : 'the count the server keeps in step',
                  tone: 'default',
                },
                {
                  label: 'Services not working',
                  value: String(serviceHealth.down + serviceHealth.degraded),
                  hint:
                    services.length === 0
                      ? 'no service is tracked on this floor'
                      : `of ${services.length} tracked service(s)`,
                  tone: serviceHealth.down + serviceHealth.degraded > 0 ? 'danger' : 'success',
                },
              ]}
            />

            {/* The rooms of the floor. A room links to the room page, and a bed
                links to the record that holds it. */}
            <DetailCard
              title={`The rooms of this floor (${stats?.activeRooms ?? activeRooms.length} in service)`}
              icon={<DoorOpen />}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/rooms?floorId=${floor._id}`)}
                >
                  Open the rooms board
                </Button>
              }
            >
              {rooms.length === 0 ? (
                <EmptyState
                  icon={<BedDouble className="h-10 w-10" />}
                  title="No rooms on this floor yet"
                  description="Add the first room: the server builds its beds from the sharing type, counts the room on this floor and writes a create entry in the audit log. Until a resident sleeps in it, the room has nobody to tell."
                  action={{
                    label: 'Add a room',
                    onClick: () => router.push(`/rooms/new?floorId=${floor._id}`),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {rooms.map((room) => {
                    const beds = room.beds ?? [];
                    const taken = occupiedBedsOfRoom(room);
                    const inService = room.isActive !== false;
                    return (
                      <div
                        key={room._id}
                        className={clsx(
                          surfaceNestedClass,
                          'flex flex-col justify-between gap-3 p-4 transition-colors duration-(--transition-duration)',
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                href={`/rooms/${room._id}`}
                                className="text-15 truncate font-bold text-(--color-brand-600) hover:underline"
                              >
                                Room {room.roomNumber}
                              </Link>
                              <p className="text-2xs mt-0.5 font-medium text-(--color-text-muted)">
                                {room.sharingType} sharing · {fmtMoney(room.monthlyRent)}/mo
                              </p>
                            </div>
                            <StatusBadge
                              variant={inService ? 'success' : 'neutral'}
                              label={inService ? 'In service' : 'Out of service'}
                            />
                          </div>

                          {/* The bed map of the room: one chip per bed. A bed
                              that holds a resident links to that resident, a
                              free bed links to the room that holds it. */}
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            {beds.length === 0 ? (
                              <span className="text-2xs text-(--color-text-muted)">
                                The server holds no bed for this room.
                              </span>
                            ) : (
                              beds.map((bed) => (
                                <Link
                                  key={bed.bedId}
                                  href={
                                    bed.tenantId ? `/tenants/${bed.tenantId}` : `/rooms/${room._id}`
                                  }
                                  title={
                                    bed.isOccupied
                                      ? `Bed ${bed.bedId}: ${bed.tenantName ?? 'a resident'}`
                                      : `Bed ${bed.bedId}: free`
                                  }
                                  className={clsx(
                                    'text-2xs flex h-7 w-7 items-center justify-center rounded-(--radius-sm) border font-mono font-bold',
                                    bed.isOccupied
                                      ? 'border-(--color-brand-500) bg-(--color-brand-500) text-(--color-on-brand)'
                                      : 'border-dashed border-(--border-color) bg-(--color-field-bg) text-(--color-text-muted)',
                                  )}
                                >
                                  {bed.bedId}
                                </Link>
                              ))
                            )}
                          </div>

                          <div className="mt-3">
                            <OccupancyBar occupied={taken} total={beds.length} />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 border-t border-(--border-color)/60 pt-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/rooms/${room._id}`)}
                          >
                            Open the room
                          </Button>
                          {inService && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOutOfServiceTarget(room)}
                            >
                              Take out of service
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DetailCard>

            {/* The health of the services the floor carries. */}
            <DetailCard
              title="The services of this floor"
              icon={<Wrench />}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/services?floorId=${floor._id}`)}
                >
                  Open the service board
                </Button>
              }
            >
              <FloorServiceGrid
                key={servicesEpoch}
                floorId={floor._id}
                floorLabel={floor.label}
                onReportIssue={(serviceType) => {
                  router.push(
                    `/complaints/new?category=${encodeURIComponent(serviceType)}&floorId=${encodeURIComponent(floor._id)}`,
                  );
                }}
              />

              {services.length === 0 && (
                <p className="text-sm font-semibold text-(--color-text-muted)">
                  The server holds no service row for this floor. A floor that carries no service
                  cannot be reported as broken: the row has to exist first.
                </p>
              )}

              {missingServices.length > 0 && (
                <div className="mt-4 rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) p-3.5">
                  <p className="text-xs font-bold text-(--color-warning-800)">
                    {missingServices.length} service{missingServices.length === 1 ? '' : 's'} the
                    office tracks are not set up on this floor
                  </p>
                  <p className="text-2xs mt-1 font-medium text-(--color-warning-800)">
                    A missing row is a gap in the record, not a working service. The office sets it
                    up here and the server writes the row with the status operational.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {missingServices.map((definition) => (
                      <li
                        key={definition.key}
                        className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-card-bg) px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-(--color-text-primary)">
                          {serviceLabel(definition.key, definition.label)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={provisioningKey === definition.key}
                          disabled={provisioningKey !== ''}
                          onClick={() =>
                            void handleProvision(
                              definition.key,
                              serviceLabel(definition.key, definition.label),
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Set up on this floor
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DetailCard>

            {/* The write trail: the proof of what the office did to this floor. */}
            <DetailCard
              title="The write trail"
              icon={<History />}
              action={
                <Button variant="ghost" size="sm" onClick={() => router.push('/audit-logs')}>
                  Open the audit log
                </Button>
              }
            >
              {audit.length === 0 ? (
                <p className="text-sm font-semibold text-(--color-text-muted)">
                  The server holds no entry for this floor yet. Every write on a floor writes one.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {audit.map((entry) => (
                    <li
                      key={entry._id}
                      className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-(--color-text-primary)">
                          {entry.action}
                        </span>
                        <span className="text-2xs font-medium text-(--color-text-muted)">
                          {formatDate(entry.timestamp)}
                          {entry.userId?.name ? ` · ${entry.userId.name}` : ''}
                        </span>
                      </div>
                      <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                        {auditSummary(entry)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-2xs mt-3 flex items-start gap-1.5 font-medium text-(--color-text-muted)">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                The trail holds the entries the server wrote about this floor. A service status is
                written against the service and shows on the service board, and a room that is taken
                out of service is written against the room.
              </p>
            </DetailCard>

            <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              The floor record carries no status of its own. What this page shows is the state of
              what hangs off it: the rooms and their beds, and the service rows of the floor.
            </p>

            <ConfirmModal
              open={!!outOfServiceTarget}
              title="Take the room out of service"
              message={`The server keeps the record of Room ${
                outOfServiceTarget?.roomNumber ?? ''
              } and sets its active flag to false, so the room leaves the lists a new resident is picked from. It recounts the rooms of this floor and writes a delete entry in the audit log. It refuses while a resident still occupies the room${
                outOfServiceTarget && occupiedBedsOfRoom(outOfServiceTarget) > 0
                  ? `: this room holds ${occupiedBedsOfRoom(outOfServiceTarget)} bed(s) with a resident in it.`
                  : '.'
              }`}
              confirmLabel="Take it out of service"
              loading={outOfServiceBusy}
              onConfirm={() => void handleOutOfService()}
              onCancel={() => setOutOfServiceTarget(null)}
            />
          </div>
        </ContentFrame>
      )}
    </FormPage>
  );
}
