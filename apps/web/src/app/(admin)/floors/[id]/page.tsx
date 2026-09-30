'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building,
  DoorOpen,
  Pencil,
  BedDouble,
  Users,
  UserPlus,
  Wrench,
  Shirt,
  IndianRupee,
  Sparkles,
} from 'lucide-react';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';
import { OccupancyRing } from '@/components/ui/OccupancyRing';
import { BedMiniGrid, OccupancyBar } from '@/components/ui/BedMiniGrid';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

interface FloorDetail {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
  createdAt: string;
}

interface FloorStats {
  activeRooms: number;
  inactiveRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  potentialRent: number;
}

interface RoomListing {
  _id: string;
  roomNumber: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantName?: string }>;
}

interface MachineListing {
  _id: string;
  machineNumber: number;
  label?: string;
  status: string;
}

interface AmenityDef {
  key: string;
  label: string;
  icon?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '\u20B90';
  try {
    return `\u20B9${amount.toLocaleString('en-IN')}`;
  } catch {
    return `\u20B9${amount}`;
  }
}

// ── Page ───────────────────────────────────────────────

const FLOOR_KEY = (id: string) => ['floors', id] as const;
const FLOOR_ROOMS_KEY = (id: string) => ['floors', id, 'rooms'] as const;
const FLOOR_MACHINES_KEY = (id: string) => ['washing-machines', 'by-floor', id] as const;
const APP_CONFIG_KEY = ['app-config'] as const;
// Stable empty fallback: `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_ROOMS: RoomListing[] = [];

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Primary query drives loading and error states, like the old effect did.
  const {
    data: floor = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<FloorDetail>(FLOOR_KEY(id), `floors/${id}`, { enabled: Boolean(id) });
  const queryErrorMessage = errorMessage(queryError);

  // Server-aggregated rooms + stats - single source of truth, no client
  // limit truncation. Falls back to zeros while loading; errors stay silent.
  const { data: roomsData } = useApiQuery<{ rooms: RoomListing[]; stats: FloorStats }>(
    FLOOR_ROOMS_KEY(id),
    `floors/${id}/rooms`,
    { enabled: Boolean(id) },
  );
  const rooms = roomsData?.rooms ?? EMPTY_ROOMS;
  const floorStats = roomsData?.stats ?? null;

  const { data: machines = [] } = useApiQuery<MachineListing[]>(
    FLOOR_MACHINES_KEY(id),
    `washing-machines?floorId=${id}`,
    { enabled: Boolean(id) },
  );

  const { data: appConfig } = useApiQuery<{ amenityDefinitions?: AmenityDef[] }>(
    APP_CONFIG_KEY,
    'app-config',
  );
  const amenityDefs = appConfig?.amenityDefinitions ?? [];

  const stats = useMemo(() => {
    const s: FloorStats = floorStats ?? {
      activeRooms: 0,
      inactiveRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      vacantBeds: 0,
      occupancyPct: 0,
      potentialRent: 0,
    };
    const activeRooms = rooms.filter((r) => r.isActive);
    return {
      ...s,
      activeRooms,
      bedsCount: s.totalBeds,
      occupiedBedsDisplay: s.occupiedBeds,
    };
  }, [rooms, floorStats]);

  if (!isLoading && (queryErrorMessage || !floor)) {
    return (
      <FormPage
        title="Floor Details"
        description="View floor information"
        backHref="/floors"
        error={queryErrorMessage || 'Floor not found'}
        maxWidth="5xl"
      />
    );
  }

  return (
    <FormPage
      title={floor?.label ?? 'Floor Details'}
      description={
        floor
          ? `Floor #${floor.floorNumber} - rooms, beds, services, and amenities`
          : 'View floor information'
      }
      backHref="/floors"
      isLoading={isLoading}
      maxWidth="5xl"
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
              onClick={() => router.push(`/floors/${floor._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit Floor
            </Button>
          </div>
        ) : undefined
      }
    >
      {floor && (
        <div className="space-y-6">
          {/* Hero: occupancy ring + stat cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
            <div
              className={clsx(
                'flex items-center justify-center gap-5 rounded-(--radius-xl) border border-(--border-color)',
                'bg-(--color-card-bg) px-8 py-5 shadow-(--shadow-card)',
              )}
            >
              <OccupancyRing
                value={stats.occupancyPct}
                size={112}
                caption={`${stats.occupiedBedsDisplay} / ${stats.bedsCount} beds`}
              />
              <div className="space-y-1.5 text-left">
                <p className="text-2xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
                  {stats.vacantBeds} vacant bed{stats.vacantBeds !== 1 ? 's' : ''}
                </p>
                <p className="text-2xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
                  {stats.inactiveRooms > 0
                    ? `${stats.inactiveRooms} inactive room${stats.inactiveRooms !== 1 ? 's' : ''}`
                    : 'All rooms active'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Active Rooms"
                value={stats.activeRooms.length}
                icon={<DoorOpen className="h-4 w-4" />}
                variant="brand"
              />
              <StatCard
                title="Total Beds"
                value={stats.bedsCount}
                icon={<BedDouble className="h-4 w-4" />}
              />
              <StatCard
                title="Tenants Housed"
                value={stats.occupiedBedsDisplay}
                icon={<Users className="h-4 w-4" />}
                variant="success"
              />
              <StatCard
                title="Potential Rent /mo"
                value={formatCurrency(stats.potentialRent)}
                icon={<IndianRupee className="h-4 w-4" />}
                variant="default"
              />
            </div>
          </div>

          {/* Service health */}
          <DetailCard title="Service Health" icon={<Wrench />}>
            <FloorServiceGrid
              floorId={floor._id}
              floorLabel={floor.label}
              onReportIssue={(serviceType) => {
                router.push(
                  `/complaints/new?category=${encodeURIComponent(serviceType)}&floorId=${encodeURIComponent(floor._id)}`,
                );
              }}
            />
          </DetailCard>

          {/* Rooms grid with bed-level detail */}
          <DetailCard
            title={`Rooms (${stats.activeRooms.length})`}
            icon={<DoorOpen />}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/rooms?floorId=${floor._id}`)}
              >
                View all
              </Button>
            }
          >
            {stats.activeRooms.length === 0 ? (
              <EmptyState
                icon={<BedDouble className="h-10 w-10" />}
                title="No rooms on this floor"
                description="Add a room to start managing this floor"
                action={{
                  label: 'Add Room',
                  onClick: () => router.push(`/rooms/new?floorId=${floor._id}`),
                }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.activeRooms.map((room) => {
                  const totalBeds = room.beds?.length ?? 0;
                  const occupied = room.beds?.filter((b) => b.isOccupied).length ?? 0;
                  const full = totalBeds > 0 && occupied === totalBeds;
                  return (
                    <button
                      key={room._id}
                      type="button"
                      onClick={() => router.push(`/rooms/${room._id}`)}
                      className={clsx(
                        surfaceNestedClass,
                        'group cursor-pointer p-4 text-left transition-all duration-(--transition-duration)',
                        'hover:border-(--color-brand-300) hover:shadow-(--shadow-sm)',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
                          <BedDouble className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          {room.roomNumber}
                        </span>
                        <StatusBadge
                          variant={statusToVariant(room.isActive ? 'active' : 'inactive')}
                          label={room.isActive ? 'Active' : 'Inactive'}
                        />
                      </div>
                      <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                        {room.sharingType} sharing - {formatCurrency(room.monthlyRent)}/mo
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <BedMiniGrid beds={room.beds ?? []} />
                          <span
                            className={clsx(
                              'text-2xs font-bold tabular-nums',
                              full
                                ? 'text-(--color-danger-600)'
                                : occupied > 0
                                  ? 'text-(--color-warning-600)'
                                  : 'text-(--color-success-600)',
                            )}
                          >
                            {occupied}/{totalBeds}
                          </span>
                        </div>
                        <OccupancyBar occupied={occupied} total={totalBeds} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </DetailCard>

          {/* Amenities */}
          {floor.amenityCounts && floor.amenityCounts.length > 0 && (
            <DetailCard title="Per-Floor Amenities" icon={<Sparkles />}>
              <div className="flex flex-wrap gap-2">
                {floor.amenityCounts.map((ac) => {
                  const def = amenityDefs.find((d) => d.key === ac.amenityKey);
                  const label =
                    def?.label ??
                    ac.amenityKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <span
                      key={ac.amenityKey}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full border border-(--border-color)',
                        'bg-(--color-field-bg) px-3 py-1.5 text-xs font-semibold text-(--color-text-primary)',
                      )}
                    >
                      <Building className="h-3.5 w-3.5 text-(--color-brand-500)" />
                      {label}
                      <span className="text-3xs rounded-full bg-(--color-brand-100) px-1.5 font-bold text-(--color-brand-700) tabular-nums">
                        x{ac.count}
                      </span>
                    </span>
                  );
                })}
              </div>
            </DetailCard>
          )}

          {/* Washing machines */}
          {machines.length > 0 && (
            <DetailCard
              title={`Washing Machines (${machines.length})`}
              icon={<Shirt />}
              action={
                <Button variant="ghost" size="sm" onClick={() => router.push('/washing-machines')}>
                  Manage
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {machines.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => router.push('/washing-machines')}
                    className={clsx(
                      surfaceNestedClass,
                      'flex cursor-pointer items-center justify-between gap-2 p-3.5 text-left transition-colors duration-(--transition-duration) hover:bg-(--color-field-bg-hover)',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-600)">
                        <Shirt className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-(--color-text-primary)">
                          Machine #{m.machineNumber}
                        </p>
                        {m.label && (
                          <p className="text-2xs font-medium text-(--color-text-muted)">
                            {m.label}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge
                      variant={
                        m.status === 'available'
                          ? 'success'
                          : m.status === 'in_use'
                            ? 'warning'
                            : 'danger'
                      }
                      label={m.status.replace(/_/g, ' ')}
                    />
                  </button>
                ))}
              </div>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
