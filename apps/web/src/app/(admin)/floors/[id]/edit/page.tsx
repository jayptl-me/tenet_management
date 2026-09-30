'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  Building2,
  LayoutGrid,
  Layers,
  Shirt,
  Refrigerator,
  Home,
  DoorOpen,
  BedDouble,
  IndianRupee,
  Plus,
  Eye,
  Wrench,
  AlertTriangle,
  Pencil,
  Hash,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { AmenityCountStepper } from '@/components/ui/AmenityCountStepper';
import { FloorStackPreview } from '@/components/ui/FloorStackPreview';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailCard } from '@/components/ui/DetailCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { BedMiniGrid, OccupancyBar } from '@/components/ui/BedMiniGrid';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';
import type { IAppConfig } from '@pg/types';

// ── Types ──────────────────────────────────────────────

type PerFloorAmenity = { key: string; label: string; maxPerFloor?: number; icon?: string };

interface ExistingFloor {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
}

interface FloorDetail {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
  createdAt?: string;
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

const FALLBACK_ICON_MAP: Record<string, React.ReactNode> = {
  washing_machine: <Shirt className="h-4 w-4" />,
  fridge: <Refrigerator className="h-4 w-4" />,
  washing_machines: <Shirt className="h-4 w-4" />,
  fridges: <Refrigerator className="h-4 w-4" />,
};

function amenityIcon(key: string): React.ReactNode {
  return FALLBACK_ICON_MAP[key] ?? <LayoutGrid className="h-4 w-4" />;
}

const FLOOR_PRESETS = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Basement',
  'Mezzanine',
  'Penthouse',
  'Terrace',
];

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '\u20B90';
  try {
    return `\u20B9${amount.toLocaleString('en-IN')}`;
  } catch {
    return `\u20B9${amount}`;
  }
}

function buildSchema(perFloorAmenities: PerFloorAmenity[]) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const a of perFloorAmenities) {
    amenityFields[a.key] = z.coerce
      .number()
      .int()
      .min(0, 'Must be >= 0')
      .max(a.maxPerFloor ?? 10, `Max ${a.maxPerFloor ?? 10}`);
  }
  return z.object({
    label: z.string().min(1, 'Label is required').max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'Floor number must be >= 0'),
    ...amenityFields,
  });
}

export default function EditFloorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [perFloorAmenities, setPerFloorAmenities] = useState<PerFloorAmenity[]>([]);
  const [existingFloors, setExistingFloors] = useState<ExistingFloor[]>([]);
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [floorStats, setFloorStats] = useState<FloorStats | null>(null);
  const [machines, setMachines] = useState<MachineListing[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);

  const schema = buildSchema(perFloorAmenities);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // Whole-form subscription. watch() during render is incompatible with
  // memoization; useWatch is the supported reactive replacement.
  const watchedValues = useWatch({ control });

  // Next.js reuses this component across /floors/[id]/edit navigations, so
  // reset loading + error when the route param changes during render
  // (react.dev: adjusting state when a prop changes) rather than calling
  // setState synchronously inside the effect.
  const [activeId, setActiveId] = useState(id);
  if (activeId !== id) {
    setActiveId(id);
    setIsLoading(true);
    setSubmitError('');
  }

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get(`floors/${id}`).json<{ success: boolean; data: FloorDetail }>(),
      api.get('app-config').json<{ success: boolean; data: IAppConfig }>(),
      api
        .get('floors')
        .json<{ success: boolean; data: Array<ExistingFloor & { _id?: string }> }>()
        .catch(() => null),
      api
        .get(`floors/${id}/rooms`)
        .json<{
          success: boolean;
          data: { floor: FloorDetail; rooms: RoomListing[]; stats: FloorStats };
        }>()
        .catch(() => null),
      api
        .get(`washing-machines?floorId=${id}`)
        .json<{ success: boolean; data: MachineListing[] }>()
        .catch(() => null),
    ])
      .then(([floorRes, configRes, floorsRes, roomsRes, machinesRes]) => {
        const currentFloor = floorRes.data;
        setFloor(currentFloor);
        setTotalRooms(currentFloor.totalRooms ?? 0);

        const defs = (configRes.data.amenityDefinitions ?? [])
          .filter((d) => d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, maxPerFloor: d.maxPerFloor, icon: d.icon }));
        setPerFloorAmenities(defs);

        const rawFloors = floorsRes?.data ?? [];
        setExistingFloors(
          rawFloors.map((f) => ({
            id: String(f.id ?? f._id ?? ''),
            floorNumber: f.floorNumber,
            label: f.label,
            totalRooms: f.totalRooms,
          })),
        );

        if (roomsRes?.data) {
          setRooms(roomsRes.data.rooms ?? []);
          setFloorStats(roomsRes.data.stats ?? null);
        }

        if (machinesRes?.data) {
          setMachines(machinesRes.data ?? []);
        }

        const defaults: Record<string, number | string> = {
          label: currentFloor.label ?? '',
          floorNumber: currentFloor.floorNumber ?? 0,
        };

        const amenityCounts = currentFloor.amenityCounts ?? [];
        for (const a of defs) {
          const existing = amenityCounts.find((ac) => ac.amenityKey === a.key);
          defaults[a.key] = existing?.count ?? 0;
        }

        reset(defaults);
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
        setIsLoading(false);
      });
  }, [id, reset]);

  // Live preview & collision calculation
  const watchedLabel = (watchedValues.label as string) ?? '';
  const watchedFloorNumber = Number(watchedValues.floorNumber) || 0;

  // Real-time client-side collision check against other floors
  const collidingFloor = useMemo(() => {
    return existingFloors.find(
      (f) => f.floorNumber === watchedFloorNumber && String(f.id) !== String(id),
    );
  }, [existingFloors, watchedFloorNumber, id]);

  const previewFloors = useMemo(
    () =>
      existingFloors.map((f) => ({
        id: f.id,
        floorNumber: f.floorNumber,
        label: f.label,
        totalRooms: f.totalRooms,
      })),
    [existingFloors],
  );

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
    const activeRooms = rooms.filter((r) => r.isActive !== false);
    return {
      ...s,
      activeRooms,
      bedsCount: s.totalBeds,
      occupiedBedsDisplay: s.occupiedBeds,
    };
  }, [rooms, floorStats]);

  const onSubmit = async (data: Record<string, unknown>) => {
    if (collidingFloor) {
      setSubmitError(
        `Floor number ${watchedFloorNumber} is already used by "${collidingFloor.label}". Please choose an unused floor number.`,
      );
      return;
    }

    setSubmitError('');
    try {
      const amenityCounts = perFloorAmenities.map((a) => ({
        amenityKey: a.key,
        count: Number(data[a.key]) || 0,
      }));

      // totalRooms is auto-synced by API from active rooms
      const payload = {
        label: data.label,
        floorNumber: Number(data.floorNumber),
        amenityCounts,
      };

      await api.put(`floors/${id}`, { json: payload }).json();
      router.push('/floors');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title={`Edit ${floor?.label ?? 'Floor'}`}
      description={
        floor
          ? `Configure structural details, floor numbering, and amenities for Floor #${floor.floorNumber}`
          : 'Update floor details'
      }
      backHref="/floors"
      error={submitError}
      isLoading={isLoading}
      maxWidth="5xl"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/floors/${id}`)}
          >
            <Eye className="h-4 w-4" />
            View Details
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/rooms/new?floorId=${id}`)}
          >
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/services')}
          >
            <Wrench className="h-4 w-4" />
            Floor Services
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Telemetry Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Occupancy Rate"
            value={`${stats.occupancyPct}%`}
            subtitle={`${stats.occupiedBedsDisplay} of ${stats.bedsCount} beds occupied`}
            icon={<DoorOpen className="h-4 w-4" />}
            variant="brand"
            progress={{
              value: stats.occupancyPct,
              max: 100,
              color: 'var(--color-brand-500)',
            }}
          />
          <StatCard
            title="Active Rooms"
            value={stats.activeRooms.length}
            subtitle={
              stats.inactiveRooms > 0
                ? `${stats.inactiveRooms} inactive room${stats.inactiveRooms !== 1 ? 's' : ''}`
                : `All ${totalRooms} room${totalRooms !== 1 ? 's' : ''} operational`
            }
            icon={<Building2 className="h-4 w-4" />}
            variant="default"
          />
          <StatCard
            title="Available Beds"
            value={stats.vacantBeds}
            subtitle={`${stats.bedsCount} total beds capacity`}
            icon={<BedDouble className="h-4 w-4" />}
            variant={stats.vacantBeds > 0 ? 'success' : 'default'}
          />
          <StatCard
            title="Potential Rent /mo"
            value={formatCurrency(stats.potentialRent)}
            subtitle="Monthly yield from active rooms"
            icon={<IndianRupee className="h-4 w-4" />}
            variant="default"
          />
        </div>

        {/* Form Card & Architectural Elevation Preview */}
        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/floors"
              submitLabel="Save Changes"
              disabled={Boolean(collidingFloor)}
              divided={false}
            />
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left Column: Form Controls */}
            <div className="space-y-6">
              <FormSection
                title="Floor details"
                icon={<Building2 />}
                description="Physical labeling, level number, and auto-synced capacity"
              >
                {/* 1-Click Label Presets */}
                <div className="space-y-1.5 pb-1">
                  <span className="text-2xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
                    Quick Label Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FLOOR_PRESETS.map((preset) => {
                      const isActive = watchedLabel === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setValue('label', preset, { shouldValidate: true, shouldDirty: true })
                          }
                          className={clsx(
                            'text-2xs rounded-full border px-2.5 py-1 font-semibold transition-all duration-150',
                            isActive
                              ? 'border-(--badge-info-border) bg-(--badge-info-bg) text-(--badge-info-text) shadow-(--shadow-xs)'
                              : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--border-color-hover) hover:text-(--color-text-primary)',
                          )}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FormGrid cols={2}>
                  <Input
                    label="Floor Label"
                    placeholder="e.g. First Floor"
                    leftIcon={<Building2 className="h-4 w-4" />}
                    error={(errors as Record<string, { message?: string }>).label?.message}
                    {...register('label')}
                  />
                  <div className="space-y-1">
                    <Input
                      label="Floor Level"
                      type="number"
                      placeholder="e.g. 1"
                      leftIcon={<Hash className="h-4 w-4" />}
                      helperText="Level 0 is ground floor. Basements use negative numbers."
                      error={(errors as Record<string, { message?: string }>).floorNumber?.message}
                      {...register('floorNumber')}
                    />
                    {collidingFloor && (
                      <p className="text-2xs flex items-center gap-1.5 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-2.5 py-1.5 font-semibold text-(--badge-danger-text)">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Floor number {watchedFloorNumber} is already used by &quot;
                        {collidingFloor.label}&quot;.
                      </p>
                    )}
                  </div>
                </FormGrid>

                {/* Live Capacity Telemetry Banner */}
                <div className="mt-4 flex flex-col justify-between gap-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3.5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-700)">
                      <DoorOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-(--color-text-primary)">
                          Active Capacity: {totalRooms} Room{totalRooms !== 1 ? 's' : ''} (
                          {stats.bedsCount} Total Beds)
                        </span>
                        <StatusBadge variant="info" label="Auto-Synced" />
                      </div>
                      <p className="text-2xs text-(--color-text-muted)">
                        Room count and capacity are calculated automatically from active rooms
                        assigned to this floor.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/rooms?floorId=${id}`}
                    className="inline-flex shrink-0 items-center gap-1 self-start text-xs font-medium text-(--color-brand-600) hover:text-(--color-brand-700) hover:underline sm:self-center"
                  >
                    Manage Rooms <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </FormSection>

              {perFloorAmenities.length > 0 && (
                <FormSection
                  title="Per-floor amenity counts"
                  icon={<Layers />}
                  description="Hardware units assigned and maintained specifically for this floor"
                  divided
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {perFloorAmenities.map((a) => {
                      const value = Number(watchedValues[a.key]) || 0;
                      return (
                        <AmenityCountStepper
                          key={a.key}
                          label={a.label}
                          icon={amenityIcon(a.key)}
                          value={value}
                          min={0}
                          max={a.maxPerFloor ?? 10}
                          error={(errors as Record<string, { message?: string }>)[a.key]?.message}
                          onChange={(v) =>
                            setValue(a.key, v, { shouldValidate: true, shouldDirty: true })
                          }
                        />
                      );
                    })}
                  </div>
                </FormSection>
              )}

              <FormSection
                title="Architectural and Safety Advisory"
                icon={<Home />}
                description="Structural consequences of updating or renumbering this level"
                divided
              >
                <div className="text-12 space-y-2 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3.5 leading-relaxed font-medium text-(--color-text-secondary)">
                  <p>
                    <strong className="text-(--color-text-primary)">Level Numbering:</strong>{' '}
                    Renumbering this floor updates its building elevation index across all{' '}
                    {stats.activeRooms.length} room(s) and {machines.length} machine(s). Existing
                    room numbers (e.g., Room 101) and active lease contracts remain unaltered.
                  </p>
                  <p>
                    <strong className="text-(--color-text-primary)">Capacity Management:</strong>{' '}
                    Room capacity on this floor is maintained dynamically. To create new rooms, use
                    the &quot;Add Room to Floor&quot; button.
                  </p>
                  <p>
                    <strong className="text-(--color-text-primary)">Deletion Rules:</strong> A floor
                    cannot be deleted while it houses active rooms or washing machines.
                  </p>
                </div>
              </FormSection>
            </div>

            {/* Right Column: Building Elevation Preview & Quick Snapshot */}
            <div className="space-y-4">
              <FloorStackPreview
                floors={previewFloors}
                current={{
                  floorNumber: watchedFloorNumber,
                  label: watchedLabel || 'Unnamed Floor',
                  totalRooms,
                }}
                currentId={id}
                mode="edit"
              />

              {/* Floor Health Card */}
              <div className="space-y-3 rounded-(--radius-xl) border border-(--border-color) bg-(--color-field-bg) p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-(--color-text-primary)">
                    Floor Health Snapshot
                  </span>
                  <StatusBadge
                    variant={collidingFloor ? 'danger' : 'success'}
                    label={collidingFloor ? 'Number Conflict' : 'Operational'}
                  />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-(--color-text-secondary)">
                    <span>Active Rooms:</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {stats.activeRooms.length} / {totalRooms}
                    </span>
                  </div>
                  <div className="flex justify-between text-(--color-text-secondary)">
                    <span>Beds Occupied:</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {stats.occupiedBedsDisplay} / {stats.bedsCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-(--color-text-secondary)">
                    <span>Washing Machines:</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {machines.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-(--color-text-secondary)">
                    <span>Monthly Yield:</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {formatCurrency(stats.potentialRent)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FormCard>

        {/* Embedded Rooms Roster */}
        <DetailCard
          title={`Rooms on this Floor (${stats.activeRooms.length})`}
          icon={<DoorOpen />}
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/rooms/new?floorId=${id}`)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Room
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/rooms?floorId=${id}`)}
              >
                View all
              </Button>
            </div>
          }
        >
          {stats.activeRooms.length === 0 ? (
            <EmptyState
              icon={<BedDouble className="h-10 w-10" />}
              title="No active rooms on this floor"
              description="Add a room to assign beds, set rent pricing, and house tenants."
              action={{
                label: 'Add Room to Floor',
                onClick: () => router.push(`/rooms/new?floorId=${id}`),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.activeRooms.map((room) => {
                const totalBeds = room.beds?.length ?? room.sharingType ?? 0;
                const occupied = room.beds?.filter((b) => b.isOccupied).length ?? 0;
                const isFull = totalBeds > 0 && occupied === totalBeds;
                const hasVacancy = totalBeds > occupied;

                return (
                  <div
                    key={room._id}
                    className={clsx(
                      surfaceNestedClass,
                      'group flex flex-col justify-between p-4 transition-all duration-(--transition-duration)',
                      'hover:border-(--color-brand-300) hover:shadow-(--shadow-sm)',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/rooms/${room._id}`)}
                          className="flex items-center gap-1.5 text-sm font-bold text-(--color-text-primary) hover:text-(--color-brand-600)"
                        >
                          <BedDouble className="h-4 w-4 text-(--color-text-muted)" />
                          Room {room.roomNumber}
                        </button>
                        <StatusBadge
                          variant={
                            isFull ? 'danger' : hasVacancy && occupied > 0 ? 'warning' : 'success'
                          }
                          label={
                            isFull ? 'Full' : hasVacancy && occupied > 0 ? 'Available' : 'Vacant'
                          }
                        />
                      </div>
                      <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                        {room.sharingType}-sharing · {formatCurrency(room.monthlyRent)}/mo
                      </p>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <BedMiniGrid beds={room.beds ?? []} />
                          <span
                            className={clsx(
                              'text-2xs font-bold tabular-nums',
                              isFull
                                ? 'text-(--color-danger-600)'
                                : occupied > 0
                                  ? 'text-(--color-warning-600)'
                                  : 'text-(--color-success-600)',
                            )}
                          >
                            {occupied}/{totalBeds} beds
                          </span>
                        </div>
                        <OccupancyBar occupied={occupied} total={totalBeds} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-(--border-color)/60 pt-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/rooms/${room._id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/rooms/${room._id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DetailCard>

        {/* Per-Floor Washing Machines & Connected Assets */}
        {machines.length > 0 && (
          <DetailCard
            title={`Washing Machines on Floor (${machines.length})`}
            icon={<Shirt />}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push('/washing-machines')}
              >
                Manage Machines
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {machines.map((m) => (
                <div
                  key={m._id}
                  className={clsx(
                    surfaceNestedClass,
                    'flex items-center justify-between gap-2 p-3.5',
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
                        <p className="text-2xs font-medium text-(--color-text-muted)">{m.label}</p>
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
                </div>
              ))}
            </div>
          </DetailCard>
        )}
      </div>
    </FormPage>
  );
}
