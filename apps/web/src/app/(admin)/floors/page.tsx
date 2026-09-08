'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Building2, Search, LayoutGrid, List, ArrowUpDown, DoorOpen, IndianRupee, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FloorCard, type FloorCardServiceSummary } from '@/components/ui/FloorCard';
import { OccupancyRing } from '@/components/ui/OccupancyRing';
import { OccupancyBar } from '@/components/ui/BedMiniGrid';
import { StatCard } from '@/components/ui/StatCard';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShimmerBlock } from '@/components/ui/Skeleton';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { surfaceCardClass } from '@/lib/field-styles';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────

interface FloorRow {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
}

interface RoomLite {
  _id: string;
  floorId: string;
  roomNumber: string;
  monthlyRent: number;
  isActive: boolean;
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantName?: string }>;
}

interface ServiceLite {
  _id: string;
  floorId: string | { _id?: string };
  status: 'operational' | 'degraded' | 'down';
  openComplaintCount?: number;
}

type SortKey = 'floor_asc' | 'floor_desc' | 'label' | 'occupancy' | 'rooms';

const SORT_OPTIONS = [
  { value: 'floor_asc', label: 'Floor # (low to high)' },
  { value: 'floor_desc', label: 'Floor # (high to low)' },
  { value: 'label', label: 'Name (A-Z)' },
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'rooms', label: 'Most rooms' },
];

// ── Per-floor computed stats ───────────────────────────

interface FloorStats {
  activeRooms: number;
  beds: NonNullable<RoomLite['beds']>;
  occupiedBeds: number;
  occupancyPct: number;
  potentialRent: number;
  services: FloorCardServiceSummary;
}

function computeStats(
  floor: FloorRow,
  roomsByFloor: Map<string, RoomLite[]>,
  servicesByFloor: Map<string, ServiceLite[]>,
): FloorStats {
  const rooms = (roomsByFloor.get(floor._id) ?? []).filter((r) => r.isActive);
  const beds = rooms.flatMap((r) => r.beds ?? []);
  const occupiedBeds = beds.filter((b) => b.isOccupied).length;
  const services = servicesByFloor.get(floor._id) ?? [];
  return {
    activeRooms: rooms.length,
    beds,
    occupiedBeds,
    occupancyPct: beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0,
    potentialRent: rooms.reduce((sum, r) => sum + (r.monthlyRent ?? 0), 0),
    services: {
      operational: services.filter((s) => s.status === 'operational').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      down: services.filter((s) => s.status === 'down').length,
      openComplaints: services.reduce((sum, s) => sum + (s.openComplaintCount ?? 0), 0),
    },
  };
}

function floorIdOf(svc: ServiceLite): string {
  if (typeof svc.floorId === 'object' && svc.floorId !== null && '_id' in svc.floorId) {
    return String(svc.floorId._id ?? '');
  }
  return String(svc.floorId ?? '');
}

// ── Page ───────────────────────────────────────────────

export default function FloorsPage() {
  const router = useRouter();
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const [rooms, setRooms] = useState<RoomLite[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('floor_asc');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FloorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFloors = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [floorsRes, roomsRes, servicesRes] = await Promise.all([
        api.get('floors').json<{ success: boolean; data: FloorRow[] }>(),
        api
          .get('rooms', { searchParams: { limit: '500' } })
          .json<{ success: boolean; data: RoomLite[] }>(),
        api
          .get('services', { searchParams: { limit: '100' } })
          .json<{ success: boolean; data: ServiceLite[] }>(),
      ]);
      setFloors(floorsRes.data);
      setRooms(roomsRes.data ?? []);
      setServices(servicesRes.data ?? []);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  const roomsByFloor = useMemo(() => {
    const map = new Map<string, RoomLite[]>();
    for (const room of rooms) {
      const key = String(room.floorId ?? '');
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(room);
    }
    return map;
  }, [rooms]);

  const servicesByFloor = useMemo(() => {
    const map = new Map<string, ServiceLite[]>();
    for (const svc of services) {
      const key = floorIdOf(svc);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(svc);
    }
    return map;
  }, [services]);

  const statsFor = useCallback(
    (floor: FloorRow) => computeStats(floor, roomsByFloor, servicesByFloor),
    [roomsByFloor, servicesByFloor],
  );

    // Aggregates for the stat strip
  const totals = useMemo(() => {
    let activeRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;
    let potentialRent = 0;
    let serviceIssues = 0;
    for (const floor of floors) {
      const s = statsFor(floor);
      activeRooms += s.activeRooms;
      totalBeds += s.beds.length;
      occupiedBeds += s.occupiedBeds;
      potentialRent += s.potentialRent;
      serviceIssues += s.services.degraded + s.services.down;
    }
    return {
      activeRooms,
      totalBeds,
      occupiedBeds,
      potentialRent,
      serviceIssues,
      occupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    };
  }, [floors, statsFor]);

  // Filter + sort
  const visibleFloors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = floors.filter(
      (f) => !q || f.label.toLowerCase().includes(q) || String(f.floorNumber).includes(q),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'floor_desc':
          return b.floorNumber - a.floorNumber;
        case 'label':
          return a.label.localeCompare(b.label);
        case 'occupancy':
          return statsFor(b).occupancyPct - statsFor(a).occupancyPct;
        case 'rooms':
          return statsFor(b).activeRooms - statsFor(a).activeRooms;
        default:
          return a.floorNumber - b.floorNumber;
      }
    });
    return sorted;
  }, [floors, search, sortKey, statsFor]);

  const pagedFloors = visibleFloors.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`floors/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchFloors();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

    const viewToggle = (
    <div className="flex items-center rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-0.5 shadow-[var(--shadow-xs)]">
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === 'grid'}
        onClick={() => setView('grid')}
        className={clsx(
          'flex h-8 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-200',
          view === 'grid'
            ? 'bg-[color:var(--color-card-bg)] text-[color:var(--color-brand-600)] shadow-[var(--shadow-xs)]'
            : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]',
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={view === 'table'}
        onClick={() => setView('table')}
        className={clsx(
          'flex h-8 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-200',
          view === 'table'
            ? 'bg-[color:var(--color-card-bg)] text-[color:var(--color-brand-600)] shadow-[var(--shadow-xs)]'
            : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]',
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );

  const columns: DataTableColumn<FloorRow>[] = [
    {
      header: 'Floor',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.label}</span>
      ),
    },
    { header: 'Floor #', accessor: (row) => row.floorNumber },
    {
      header: 'Rooms',
      accessor: (row) => {
        const s = statsFor(row);
        return `${s.activeRooms}${s.activeRooms !== row.totalRooms ? ` / ${row.totalRooms}` : ''}`;
      },
    },
    {
      header: 'Occupancy',
      accessor: (row) => {
        const s = statsFor(row);
        return <OccupancyBar occupied={s.occupiedBeds} total={s.beds.length} />;
      },
    },
    {
      header: 'Potential /mo',
      accessor: (row) => (
        <span className="tabular-nums text-[color:var(--color-text-secondary)]">
          {'\u20B9'}
          {statsFor(row).potentialRent.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Services',
      accessor: (row) => {
        const s = statsFor(row).services;
        const issues = s.degraded + s.down;
        return issues > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--color-danger-700)]">
            {issues} issue{issues !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[color:var(--color-success-600)]">
            All operational
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/floors/${row._id}`)}
          onEdit={() => router.push(`/floors/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

    return (
    <div className="space-y-6">
      <PageHeader
        title="Floors"
        description="Manage building floors, room capacity, bed occupancy, and floor service health"
        action={
          <Button onClick={() => router.push('/floors/new')}>
            <Plus className="h-4 w-4" />
            Add Floor
          </Button>
        }
      />

      <ErrorBanner message={error} />

      {/* Stat strip */}
      {isLoading ? (
        <div className={clsx(surfaceCardClass, 'grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4')}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
          <div className={clsx(surfaceCardClass, 'flex items-center justify-center gap-4 px-6 py-4')}>
            <OccupancyRing
              value={totals.occupancyPct}
              caption={`${totals.occupiedBeds} / ${totals.totalBeds} beds`}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Floors" value={floors.length} icon={<Building2 className="h-4 w-4" />} />
            <StatCard
              title="Active rooms"
              value={totals.activeRooms}
              icon={<DoorOpen className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Potential rent /mo"
              value={`\u20B9${totals.potentialRent.toLocaleString('en-IN')}`}
              icon={<IndianRupee className="h-4 w-4" />}
              variant="success"
            />
            <StatCard
              title="Service issues"
              value={totals.serviceIssues}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={totals.serviceIssues > 0 ? 'danger' : 'success'}
              onClick={totals.serviceIssues > 0 ? () => router.push('/services') : undefined}
            />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <Input
              placeholder="Search floors by name or number..."
              aria-label="Search floors"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <div className="w-full sm:w-72">
            <Select
              aria-label="Sort floors"
              value={sortKey}
              leftIcon={<ArrowUpDown className="h-4 w-4" />}
              options={SORT_OPTIONS}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setPage(1);
              }}
            />
          </div>
        </div>
        {viewToggle}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-44" />
          ))}
        </div>
      ) : view === 'grid' ? (
        visibleFloors.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="No floors yet"
            description="Add your first floor to get started"
            action={{ label: 'Add Floor', onClick: () => router.push('/floors/new') }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleFloors.map((floor) => {
              const s = statsFor(floor);
              return (
                <FloorCard
                  key={floor._id}
                  label={floor.label}
                  floorNumber={floor.floorNumber}
                  totalRooms={floor.totalRooms}
                  activeRooms={s.activeRooms}
                  beds={s.beds}
                  potentialRent={s.potentialRent}
                  services={s.services}
                  onView={() => router.push(`/floors/${floor._id}`)}
                  onEdit={() => router.push(`/floors/${floor._id}/edit`)}
                  onDelete={() => setDeleteTarget(floor)}
                />
              );
            })}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={pagedFloors}
          keyExtractor={(row: FloorRow) => row._id}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/floors/${row._id}`)}
          pagination={{
            page,
            perPage,
            total: visibleFloors.length,
            onPageChange: (p) => setPage(p),
            onPerPageChange: (pp) => {
              setPerPage(pp);
              setPage(1);
            },
          }}
          emptyState={
            <EmptyState
              icon={<Building2 className="h-12 w-12" />}
              title="No floors found"
              description="Try adjusting your search or add a new floor"
              action={{ label: 'Add Floor', onClick: () => router.push('/floors/new') }}
            />
          }
          mobileCardRenderer={(row) => {
            const s = statsFor(row);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {row.label}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-text-muted)]">
                    Floor #{row.floorNumber}
                  </span>
                </div>
                <OccupancyBar occupied={s.occupiedBeds} total={s.beds.length} />
                <div className="flex items-center gap-1 pt-1">
                  <TableActions
                    onView={() => router.push(`/floors/${row._id}`)}
                    onEdit={() => router.push(`/floors/${row._id}/edit`)}
                    onDelete={() => setDeleteTarget(row)}
                  />
                </div>
              </div>
            );
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Floor"
        message={`Are you sure you want to delete "${deleteTarget?.label}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}