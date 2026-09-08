'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [machines, setMachines] = useState<MachineListing[]>([]);
  const [amenityDefs, setAmenityDefs] = useState<AmenityDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');

    api
      .get(`floors/${id}`)
      .json<{ success: boolean; data: FloorDetail }>()
      .then((res) => setFloor(res.data))
      .catch(async (err) => setError((await parseApiError(err)).message))
      .finally(() => setIsLoading(false));

    api
      .get(`rooms?floorId=${id}&limit=200`)
      .json<{ success: boolean; data: RoomListing[] }>()
      .then((res) => setRooms(res.data ?? []))
      .catch(() => {});

    api
      .get(`washing-machines?floorId=${id}`)
      .json<{ success: boolean; data: MachineListing[] }>()
      .then((res) => setMachines(res.data ?? []))
      .catch(() => {});

    api
      .get('app-config')
      .json<{ success: boolean; data: { amenityDefinitions?: AmenityDef[] } }>()
      .then((res) => setAmenityDefs(res.data?.amenityDefinitions ?? []))
      .catch(() => {});
  }, [id]);

  const stats = useMemo(() => {
    const activeRooms = rooms.filter((r) => r.isActive);
    const beds = activeRooms.flatMap((r) => r.beds ?? []);
    const occupiedBeds = beds.filter((b) => b.isOccupied).length;
    return {
      activeRooms,
      inactiveRooms: rooms.length - activeRooms.length,
      beds,
      occupiedBeds,
      vacantBeds: beds.length - occupiedBeds,
      occupancyPct: beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0,
      potentialRent: activeRooms.reduce((sum, r) => sum + (r.monthlyRent ?? 0), 0),
    };
  }, [rooms]);

    if (!isLoading && (error || !floor)) {
    return (
      <FormPage
        title="Floor Details"
        description="View floor information"
        backHref="/floors"
        error={error || 'Floor not found'}
        maxWidth="5xl"
      />
    );
  }

  return (
    <FormPage
      title={floor?.label ?? 'Floor Details'}
      description={floor ? `Floor #${floor.floorNumber} - rooms, beds, services, and amenities` : 'View floor information'}
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
                'flex items-center justify-center gap-5 rounded-[var(--radius-xl)] border border-[color:var(--border-color)]',
                'bg-[color:var(--color-card-bg)] px-8 py-5 shadow-[var(--shadow-card)]',
              )}
            >
              <OccupancyRing
                value={stats.occupancyPct}
                size={112}
                caption={`${stats.occupiedBeds} / ${stats.beds.length} beds`}
              />
              <div className="space-y-1.5 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  {stats.vacantBeds} vacant bed{stats.vacantBeds !== 1 ? 's' : ''}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
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
                value={stats.beds.length}
                icon={<BedDouble className="h-4 w-4" />}
              />
              <StatCard
                title="Tenants Housed"
                value={stats.occupiedBeds}
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
                        'group cursor-pointer p-4 text-left transition-[border-color,box-shadow] duration-[var(--transition-duration)]',
                        'hover:border-[color:var(--color-brand-300)] hover:shadow-[var(--shadow-sm)]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-primary)]">
                          <BedDouble className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                          {room.roomNumber}
                        </span>
                        <StatusBadge
                          variant={statusToVariant(room.isActive ? 'active' : 'inactive')}
                          label={room.isActive ? 'Active' : 'Inactive'}
                        />
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                        {room.sharingType} sharing - {formatCurrency(room.monthlyRent)}/mo
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <BedMiniGrid beds={room.beds ?? []} />
                          <span
                            className={clsx(
                              'text-[11px] font-bold tabular-nums',
                              full
                                ? 'text-[color:var(--color-danger-600)]'
                                : occupied > 0
                                  ? 'text-[color:var(--color-warning-600)]'
                                  : 'text-[color:var(--color-success-600)]',
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
                        'inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)]',
                        'bg-[color:var(--color-field-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-primary)]',
                      )}
                    >
                      <Building className="h-3.5 w-3.5 text-[color:var(--color-brand-500)]" />
                      {label}
                      <span className="rounded-full bg-[color:var(--color-brand-100)] px-1.5 text-[10px] font-bold tabular-nums text-[color:var(--color-brand-700)]">
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
                      'flex cursor-pointer items-center justify-between gap-2 p-3.5 text-left transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-field-bg-hover)]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-600)]">
                        <Shirt className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
                          Machine #{m.machineNumber}
                        </p>
                        {m.label && (
                          <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
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


