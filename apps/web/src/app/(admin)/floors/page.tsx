'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  Building2,
  DoorOpen,
  Info,
  LayoutGrid,
  List,
  Plus,
  Search,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { FloorCard } from '@/components/ui/FloorCard';
import { Input } from '@/components/ui/Input';
import { OccupancyBar } from '@/components/ui/BedMiniGrid';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { ShimmerBlock } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { TableActions } from '@/components/ui/TableActions';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /floors/overview   apps/api/src/routes/floors.ts:97-172
//   DELETE /floors/:id     apps/api/src/routes/floors.ts:337-386
//
// The overview is one server aggregate: it walks the floors, the rooms and the
// service rows and returns, for every floor, the room count, the bed map, the
// occupancy and the service health. The client joins nothing.

interface FloorServiceSummary {
  operational: number;
  degraded: number;
  down: number;
  openComplaints: number;
}

interface FloorStats {
  activeRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  potentialRent: number;
  services: FloorServiceSummary;
}

interface FloorOverviewRow {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  stats: FloorStats;
  beds: Array<{ bedId: string; isOccupied: boolean }>;
}

type SortKey = 'floor_asc' | 'floor_desc' | 'label' | 'occupancy' | 'rooms';

const FLOORS_KEY = ['floors', 'overview'] as const;

const SORT_OPTIONS = [
  { value: 'floor_asc', label: 'Level (low to high)' },
  { value: 'floor_desc', label: 'Level (high to low)' },
  { value: 'label', label: 'Name (A-Z)' },
  { value: 'occupancy', label: 'Occupancy (fullest first)' },
  { value: 'rooms', label: 'Most rooms' },
];

const SORT_KEYS = SORT_OPTIONS.map((option) => option.value);

const HEALTH_OPTIONS = [
  { value: '', label: 'Any service health' },
  { value: 'issues', label: 'A service is not working' },
  { value: 'healthy', label: 'Every service works' },
];

const HEALTH_FILTERS = ['issues', 'healthy'] as const;
const VIEW_MODES = ['cards', 'table'] as const;

/** The tab strip: the health of the floor, not a status of the floor. */
const HEALTH_TABS = [
  { key: '', label: 'All floors' },
  { key: 'issues', label: 'A service is not working' },
  { key: 'healthy', label: 'Every service works' },
];

/** A stable empty fallback, so the memos that read it do not churn. */
const EMPTY_FLOORS: FloorOverviewRow[] = [];

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** The services of a floor that are not working. */
function serviceIssues(floor: FloorOverviewRow): number {
  return floor.stats.services.degraded + floor.stats.services.down;
}

/** The health of the services of a floor, worst state first. */
function serviceHealth(floor: FloorOverviewRow): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
} {
  const services = floor.stats.services;
  if (services.down > 0) {
    return { label: `${services.down} down`, variant: 'danger' };
  }
  if (services.degraded > 0) {
    return { label: `${services.degraded} degraded`, variant: 'warning' };
  }
  const total = services.operational + services.degraded + services.down;
  if (total === 0) {
    return { label: 'No services set up', variant: 'neutral' };
  }
  return { label: 'All working', variant: 'success' };
}

function FloorsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a view of the building can be
  // linked, cited and reviewed, and a link that carries a query parameter lands
  // filtered instead of on the whole building.
  const searchState = useUrlSearch('q');
  const sortState = useUrlState<string>('sort', {
    defaultValue: 'floor_asc',
    allowed: SORT_KEYS,
  });
  const healthState = useUrlState<string>('health', {
    defaultValue: '',
    allowed: HEALTH_FILTERS,
  });
  const viewState = useUrlState<string>('view', { defaultValue: 'cards', allowed: VIEW_MODES });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const sortKey = sortState.value as SortKey;
  const healthFilter = healthState.value;
  const viewMode = viewState.value === 'table' ? 'table' : 'cards';

  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FloorOverviewRow | null>(null);
  const [deleteResult, setDeleteResult] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  const {
    data: floors = EMPTY_FLOORS,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<FloorOverviewRow[]>(FLOORS_KEY, 'floors/overview');

  /**
   * The building, as the server reports it.
   *
   * Every number here is the sum of the server's own per floor figures, over
   * the whole set of floors the server returned. The server does not filter
   * floors, so the filters below narrow the screen and not these numbers.
   */
  const building = useMemo(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let issues = 0;
    let floorsWithIssues = 0;
    for (const floor of floors) {
      totalBeds += floor.stats.totalBeds;
      occupiedBeds += floor.stats.occupiedBeds;
      const floorIssues = serviceIssues(floor);
      issues += floorIssues;
      if (floorIssues > 0) floorsWithIssues += 1;
    }
    return {
      totalBeds,
      occupiedBeds,
      freeBeds: Math.max(0, totalBeds - occupiedBeds),
      issues,
      floorsWithIssues,
    };
  }, [floors]);

  /** The floors the filters leave on the screen. */
  const visibleFloors = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = floors.filter((floor) => {
      if (q && !floor.label.toLowerCase().includes(q) && !String(floor.floorNumber).includes(q)) {
        return false;
      }
      if (healthFilter === 'issues' && serviceIssues(floor) === 0) return false;
      if (healthFilter === 'healthy' && serviceIssues(floor) > 0) return false;
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((left, right) => {
      switch (sortKey) {
        case 'floor_desc':
          return right.floorNumber - left.floorNumber;
        case 'label':
          return left.label.localeCompare(right.label);
        case 'occupancy':
          return right.stats.occupancyPct - left.stats.occupancyPct;
        case 'rooms':
          return right.stats.activeRooms - left.stats.activeRooms;
        default:
          return left.floorNumber - right.floorNumber;
      }
    });
    return sorted;
  }, [floors, search, healthFilter, sortKey]);

  const clearAllFilters = () => {
    writeUrl({ q: null, health: null, sort: null });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`floors/${deleteTarget._id}`).json();
      // The server committed a hard delete: the floor row is gone and the
      // service rows of that floor went with it. Say what it did, not what the
      // office hoped for.
      setDeleteResult(
        `Floor ${deleteTarget.label} is gone. The server deleted the row, removed the service ` +
          `rows that belonged to that floor and wrote a delete entry in the audit log. It is a ` +
          `hard delete: the floor and everything that hung off it are gone.`,
      );
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: FLOORS_KEY });
    } catch (err) {
      // The server's answer is the one that matters: it refuses while active
      // rooms or washing machines are still on the floor.
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const chips = [
    ...(search
      ? [
          {
            key: 'search',
            label: 'Floor',
            value: search,
            onRemove: () => searchState.clear(),
          },
        ]
      : []),
    ...(healthFilter
      ? [
          {
            key: 'health',
            label: 'Services',
            value: healthFilter === 'issues' ? 'Not working' : 'All working',
            onRemove: () => healthState.reset(),
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<FloorOverviewRow>[] = [
    {
      header: 'Floor',
      accessor: (row) => (
        <div>
          <Link
            href={`/floors/${row._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.label}
          </Link>
          <div className="text-2xs text-(--color-text-muted)">Level {row.floorNumber}</div>
        </div>
      ),
    },
    {
      header: 'Rooms',
      accessor: (row) => (
        <span className="tabular-nums">
          {row.stats.activeRooms}
          <span className="text-(--color-text-muted)"> / {row.totalRooms}</span>
        </span>
      ),
    },
    {
      header: 'Beds',
      accessor: (row) => (
        <OccupancyBar occupied={row.stats.occupiedBeds} total={row.stats.totalBeds} />
      ),
    },
    {
      header: 'Services',
      accessor: (row) => {
        const health = serviceHealth(row);
        return (
          <div>
            <StatusBadge variant={health.variant} label={health.label} />
            {row.stats.services.openComplaints > 0 && (
              <div className="text-2xs text-(--color-text-muted)">
                {row.stats.services.openComplaints} open complaint
                {row.stats.services.openComplaints === 1 ? '' : 's'}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Floor rent /mo',
      accessor: (row) => (
        <span className="text-(--color-text-secondary) tabular-nums">
          {fmtMoney(row.stats.potentialRent)}
        </span>
      ),
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

  const filtersActive = Boolean(search || healthFilter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Floors"
        description="The levels of the building: what each floor holds, how full it is, and how healthy its services are"
        action={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-(--radius-md) border-[length:var(--bw-default)] border-(--border-color)">
              <button
                type="button"
                onClick={() => viewState.setValue('cards')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'cards'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
                }`}
                aria-label="Floor cards view"
                aria-pressed={viewMode === 'cards'}
              >
                <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
                Floors
              </button>
              <button
                type="button"
                onClick={() => viewState.setValue('table')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'table'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
                }`}
                aria-label="Floor table view"
                aria-pressed={viewMode === 'table'}
              >
                <List className="mr-1 inline h-3.5 w-3.5" />
                Table
              </button>
            </div>
            <Button onClick={() => router.push('/floors/new')}>
              <Plus className="h-4 w-4" />
              Add Floor
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {deleteResult && (
        <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-xs font-semibold text-(--color-warning-800)">
          {deleteResult}
        </div>
      )}

      {/* The band: the numbers of the whole building, the health filter and the
          search in one surface, so the first floor is reachable without
          scrolling past half a screen of chrome. Every number names the scope
          it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Floors',
            value: String(floors.length),
            hint: 'the levels the server reports',
            tone: 'brand',
          },
          {
            label: 'Beds taken',
            value: `${building.occupiedBeds} / ${building.totalBeds}`,
            hint: 'over the whole building',
            tone: 'default',
          },
          {
            label: 'Free beds',
            value: String(building.freeBeds),
            hint: 'a bed with no resident in it',
            tone: building.freeBeds === 0 ? 'warning' : 'success',
          },
          {
            label: 'Services not working',
            value: String(building.issues),
            hint: `${building.floorsWithIssues} floor(s) affected`,
            tone: building.issues > 0 ? 'danger' : 'success',
          },
        ]}
      >
        <StatusTabs
          tabs={HEALTH_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count:
              tab.key === ''
                ? floors.length
                : tab.key === 'issues'
                  ? building.floorsWithIssues
                  : floors.length - building.floorsWithIssues,
            tone: tab.key === 'issues' ? 'danger' : tab.key === 'healthy' ? 'success' : 'brand',
          }))}
          active={healthFilter}
          onChange={(key) => healthState.setValue(key)}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search by floor name or level..."
              aria-label="Search by floor name or level"
              value={searchState.text}
              onChange={(e) => searchState.onChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            aria-label="Sort floors"
            size="compact"
            options={SORT_OPTIONS}
            value={sortKey}
            onChange={(e) => sortState.setValue(e.target.value)}
            leftIcon={<ArrowUpDown className="h-4 w-4" />}
            className="w-52"
          />
          <Select
            aria-label="Filter by service health"
            size="compact"
            options={HEALTH_OPTIONS}
            value={healthFilter}
            onChange={(e) => healthState.setValue(e.target.value)}
            leftIcon={<Wrench className="h-4 w-4" />}
            className="w-56"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-44" />
          ))}
        </div>
      ) : viewMode === 'cards' ? (
        visibleFloors.length === 0 ? (
          floors.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-10 w-10" />}
              title="No floors yet"
              description="Add the first floor: the server writes the level, seeds a service status for every per-floor amenity and counts the rooms you put on it. The level number is filled in with the next free level."
              action={{ label: 'Add the first floor', onClick: () => router.push('/floors/new') }}
            />
          ) : (
            <EmptyState
              icon={<Building2 className="h-10 w-10" />}
              title="No floor in this view"
              description="The server reports a floor for every level of the building, but none of them matches the search and the health filter in the address bar."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleFloors.map((floor) => (
              <FloorCard
                key={floor._id}
                label={floor.label}
                floorNumber={floor.floorNumber}
                totalRooms={floor.totalRooms}
                activeRooms={floor.stats.activeRooms}
                beds={floor.beds}
                potentialRent={floor.stats.potentialRent}
                services={floor.stats.services}
                onView={() => router.push(`/floors/${floor._id}`)}
                onEdit={() => router.push(`/floors/${floor._id}/edit`)}
                onDelete={() => setDeleteTarget(floor)}
              />
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={visibleFloors}
          keyExtractor={(row: FloorOverviewRow) => row._id}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/floors/${row._id}`)}
          emptyState={
            filtersActive ? (
              <EmptyState
                icon={<Building2 className="h-10 w-10" />}
                title="No floor in this view"
                description="The server reports a floor for every level of the building, but none of them matches the search and the health filter in the address bar."
                action={{ label: 'Clear the filters', onClick: clearAllFilters }}
              />
            ) : (
              <EmptyState
                icon={<Building2 className="h-10 w-10" />}
                title="No floors yet"
                description="Add the first floor: the server writes the level, seeds a service status for every per-floor amenity and counts the rooms you put on it. The level number is filled in with the next free level."
                action={{ label: 'Add the first floor', onClick: () => router.push('/floors/new') }}
              />
            )
          }
          mobileCardRenderer={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/floors/${row._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  {row.label}
                </Link>
                <span className="text-2xs inline-flex items-center rounded-full bg-(--color-surface-100) px-2 py-0.5 font-semibold text-(--color-text-muted)">
                  Level {row.floorNumber}
                </span>
              </div>
              <OccupancyBar occupied={row.stats.occupiedBeds} total={row.stats.totalBeds} />
              <div className="flex items-center justify-between gap-2">
                <StatusBadge
                  variant={serviceHealth(row).variant}
                  label={serviceHealth(row).label}
                />
                <span className="text-2xs text-(--color-text-muted) tabular-nums">
                  {row.stats.activeRooms} rooms · {fmtMoney(row.stats.potentialRent)}/mo
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/floors/${row._id}`)}
                  onEdit={() => router.push(`/floors/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          )}
        />
      )}

      {/* What the numbers mean. A floor is read fast, and a number nobody can
          place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every number in the band is the server&apos;s own count over the whole set of floors it
          reports, not over the rows on screen. The server does not filter floors, so the search and
          the health filter narrow this screen and leave those numbers over the whole building.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Rooms</strong> is the active rooms of
          the floor over the room count the floor record carries. The server keeps that count in
          step with the active rooms of the floor every time a room is saved or retired.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Floor rent /mo</strong> is the sum of
          the monthly rent of the active rooms of that floor, one rent per room and not per bed.
          What a resident owes is raised from the rent on their own record.
        </p>
        <p>
          <TriangleAlert className="mr-1 inline h-3 w-3" />A service that is not working is a
          service the floor carries: water, geyser, wifi, lift. The floor page opens the service and
          says who lives above it.
        </p>
        <p>
          <DoorOpen className="mr-1 inline h-3 w-3" />A floor is deleted only when it is empty of
          active rooms and of washing machines. The server refuses the delete otherwise and says how
          many are in the way.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete the floor"
        message={`The server deletes the floor row and the service rows that belonged to it, and writes a delete entry in the audit log. It refuses while active rooms (${
          deleteTarget?.stats.activeRooms ?? 0
        }) or washing machines are still on it. The floor number and the label are free again afterwards.`}
        confirmLabel="Delete the floor"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function FloorsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <FloorsContent />
    </Suspense>
  );
}
