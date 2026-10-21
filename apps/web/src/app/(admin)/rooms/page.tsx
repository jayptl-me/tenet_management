'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  DoorOpen,
  LayoutList,
  LayoutGrid,
  Download,
  Wrench,
  X,
  Search,
  Info,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { BedOccupancyGrid, type RoomGridItem } from '@/components/ui/BedOccupancyGrid';
import { floorLabel } from '@/lib/resource-select-presets';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /rooms              apps/api/src/routes/rooms.ts:214-335
//   GET /rooms/reconcile    apps/api/src/routes/rooms.ts:339-365
//   DELETE /rooms/:id       apps/api/src/routes/rooms.ts:651-693

interface RoomBed {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
}

interface RoomRow {
  _id: string;
  roomNumber: string;
  floor?: { _id?: string; label?: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  beds?: RoomBed[];
  roomAmenities?: Array<{ amenityKey: string; status: string }>;
  createdAt: string;
}

/**
 * The bed statistics the rooms route computes over the WHOLE filtered set,
 * not over the page (apps/api/src/routes/rooms.ts:240-269).
 */
interface RoomsStats {
  totalRooms: number;
  activeRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  potentialRent: number;
}

interface RoomsListBody {
  success: boolean;
  data: RoomRow[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: RoomsStats;
  };
}

interface ReconcileReport {
  dryRun: boolean;
  scannedRooms: number;
  scannedTenants: number;
  fixedRooms: number;
  occupiedBeds: number;
  freedBeds: number;
  conflicts: Array<{
    roomId: string;
    roomNumber: string;
    bedId: string;
    tenantIds: string[];
    tenantNames: string[];
    keptTenantId: string;
  }>;
  orphans: Array<{
    tenantId: string;
    tenantName: string;
    roomId: string;
    bedId: string;
    reason: string;
  }>;
  invalidRooms: Array<{
    roomId: string;
    roomNumber: string;
    sharingType: number;
    bedCount: number;
  }>;
}

/** One floor of the building, for the name of the floor filter. */
interface FloorRow {
  _id: string;
  label?: string;
  floorNumber?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** The beds of one room, in the order the server holds them. */
function bedsOf(room: RoomRow): RoomBed[] {
  return room.beds ?? [];
}

function freeBedsOf(room: RoomRow): number {
  return bedsOf(room).filter((bed) => !bed.isOccupied).length;
}

/**
 * One room in the shape the bed map draws.
 *
 * The map expects a room with a floor that is named and beds that carry a
 * resident or nothing. The server may hold a null where the map expects a
 * name, so the null is turned into "not known" here and nowhere else.
 */
function toGridRoom(room: RoomRow): RoomGridItem {
  return {
    _id: room._id,
    roomNumber: room.roomNumber,
    floor: room.floor
      ? {
          _id: room.floor._id ?? '',
          label: room.floor.label ?? '',
          floorNumber: room.floor.floorNumber,
        }
      : undefined,
    sharingType: room.sharingType,
    monthlyRent: room.monthlyRent,
    description: room.description,
    isActive: room.isActive,
    beds: bedsOf(room).map((bed) => ({
      bedId: bed.bedId,
      isOccupied: bed.isOccupied,
      tenantId: bed.tenantId ?? undefined,
      tenantName: bed.tenantName ?? undefined,
    })),
  };
}

/**
 * The in-room amenity health of a room, worst state first.
 *
 * This is the room's OWN health: the list of amenities the office tracks for
 * this room (roomAmenities). It is not the health of the floor services, which
 * the server keeps per floor and per service type.
 */
function roomServiceState(room: RoomRow): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
  detail: string;
} {
  const amenities = room.roomAmenities ?? [];
  if (amenities.length === 0) {
    return {
      label: 'Not tracked',
      variant: 'neutral',
      detail: 'no in-room amenity is listed for this room',
    };
  }
  const down = amenities.find((amenity) => amenity.status === 'down');
  if (down) {
    return {
      label: 'Down',
      variant: 'danger',
      detail: `${down.amenityKey.replace(/_/g, ' ')} is down`,
    };
  }
  const degraded = amenities.find((amenity) => amenity.status === 'degraded');
  if (degraded) {
    return {
      label: 'Degraded',
      variant: 'warning',
      detail: `${degraded.amenityKey.replace(/_/g, ' ')} works badly`,
    };
  }
  return {
    label: 'Operational',
    variant: 'success',
    detail: `${amenities.length} in-room amenit${amenities.length === 1 ? 'y' : 'ies'} working`,
  };
}

/**
 * The bed map of one room: the shape of the room, one chip per bed.
 *
 * A room row in this module is a set of beds, not a name, so the map of the
 * beds is what has to be readable at a glance.
 */
function BedMap({ beds }: { beds: RoomBed[] }) {
  if (beds.length === 0) {
    return <span className="text-2xs text-(--color-text-muted)">No bed slots</span>;
  }
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="img"
      aria-label={`${beds.filter((bed) => bed.isOccupied).length} of ${beds.length} beds taken`}
    >
      {beds.map((bed) => (
        <span
          key={bed.bedId}
          title={
            bed.isOccupied
              ? `Bed ${bed.bedId}: ${bed.tenantName ?? 'taken'}`
              : `Bed ${bed.bedId}: free`
          }
          className={`text-2xs flex h-6 w-6 items-center justify-center rounded-(--radius-sm) border font-mono font-bold ${
            bed.isOccupied
              ? 'border-(--color-brand-500) bg-(--color-brand-500) text-(--color-on-brand)'
              : 'border-dashed border-(--border-color) bg-(--color-field-bg) text-(--color-text-muted)'
          }`}
        >
          {bed.bedId}
        </span>
      ))}
    </div>
  );
}

// ── Filter vocabulary ──────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '', label: 'All rooms' },
  { key: 'true', label: 'In service' },
  { key: 'false', label: 'Out of service' },
];

/** The values the status filter may take in the address bar. */
const STATUS_FILTERS = ['true', 'false'];

/** The count keys the tab strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

const SHARING_FILTERS = ['2', '3', '4'];
const AVAILABILITY_FILTERS = ['vacant', 'full'];
const VIEW_MODES = ['table', 'map'];

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

/** The largest page the API will serve, so the bed map knows its own ceiling. */
const MAX_PAGE_SIZE = 100;

// Stable empty fallbacks. `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_ROOMS: RoomRow[] = [];

const ROOMS_LIST_PREFIX = ['rooms', 'list'] as const;
const ROOMS_COUNT_KEY = ['rooms', 'count'] as const;
const FLOORS_KEY = ['floors', 'list'] as const;

function RoomsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a floor's rooms can be linked, cited
  // and reviewed, and a link that carries a query parameter lands filtered.
  const searchState = useUrlSearch('roomNumber');
  const floorState = useUrlState<string>('floorId', { defaultValue: '' });
  const sharingState = useUrlState<string>('sharingType', {
    defaultValue: '',
    allowed: SHARING_FILTERS,
  });
  const statusState = useUrlState<string>('isActive', {
    defaultValue: '',
    allowed: STATUS_FILTERS,
  });
  const availabilityState = useUrlState<string>('availability', {
    defaultValue: '',
    allowed: AVAILABILITY_FILTERS,
  });
  const viewState = useUrlState<string>('view', { defaultValue: 'table', allowed: VIEW_MODES });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const floorFilter = floorState.value;
  const sharingFilter = sharingState.value;
  const statusFilter = statusState.value;
  const availabilityFilter = availabilityState.value;
  const viewMode = viewState.value === 'map' ? 'map' : 'table';

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null);
  const [deleteResult, setDeleteResult] = useState<RoomRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileReport | null>(null);
  const [reconcileApplied, setReconcileApplied] = useState(false);
  /**
   * The query parameters of the filtered set.
   *
   * Every read of the rooms list sends the same set: the table, the counts
   * behind the status tabs and the CSV export. A number that answers a
   * different question than the rows would be a number nobody can trust.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('roomNumber', search);
    if (floorFilter) params.set('floorId', floorFilter);
    if (sharingFilter) params.set('sharingType', sharingFilter);
    if (statusFilter) params.set('isActive', statusFilter);
    return params;
  }, [search, floorFilter, sharingFilter, statusFilter]);

  /**
   * The bed map draws the biggest page the server allows, once: a map of the
   * first 100 rooms of the set. The table walks the set page by page.
   */
  const listLimit = viewMode === 'map' ? MAX_PAGE_SIZE : perPage;
  const listPage = viewMode === 'map' ? 1 : page;

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', String(listPage));
  listParams.set('limit', String(listLimit));

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<RoomsListBody>(
    [
      ...ROOMS_LIST_PREFIX,
      listPage,
      listLimit,
      search,
      floorFilter,
      sharingFilter,
      statusFilter,
      viewMode,
    ],
    `rooms?${listParams.toString()}`,
  );

  const rooms = listBody?.data ?? EMPTY_ROOMS;
  const total = listBody?.meta?.total ?? 0;
  const stats = listBody?.meta?.stats ?? null;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<RoomsListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('isActive', key);
      return {
        queryKey: [...ROOMS_COUNT_KEY, search, floorFilter, sharingFilter, key],
        queryFn: () => queryJson<RoomsListBody>(`rooms?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta?.total ?? null;
  });

  /**
   * The name of the floor in view, so the filter chip names a place and not an
   * id. The server holds the label.
   */
  const { data: floors } = useApiQuery<FloorRow[]>(FLOORS_KEY, 'floors', { staleTime: 300_000 });
  const floorLabelText =
    floors?.find((floor) => floor._id === floorFilter)?.label ??
    (floorFilter ? `Floor ${floorFilter.slice(-6)}` : '');

  /**
   * The availability filter.
   *
   * The server cannot filter on a free bed (apps/api/src/routes/rooms.ts:214-226
   * reads the floor, the sharing type, the active flag and the room number),
   * so this filter narrows the rooms on the screen and nothing else. The
   * numbers in the band stay over the whole set, and the legend says so.
   */
  const visibleRooms = useMemo(() => {
    if (!availabilityFilter) return rooms;
    return rooms.filter((room) => {
      const free = freeBedsOf(room);
      return availabilityFilter === 'vacant' ? free > 0 : free === 0;
    });
  }, [rooms, availabilityFilter]);

  const refreshRooms = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ROOMS_LIST_PREFIX });
    queryClient.invalidateQueries({ queryKey: ROOMS_COUNT_KEY });
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`rooms/${deleteTarget._id}`).json();
      setDeleteResult(deleteTarget);
      setDeleteTarget(null);
      refreshRooms();
    } catch (err) {
      // The server's answer is the one that matters: it refuses with
      // ACTIVE_TENANTS and the count of the residents still in the room.
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The occupancy reconcile.
   *
   * The server can report the drift without writing it (GET, dry run) and can
   * apply it (POST). The office sees the drift first, then applies it: a
   * rebuild that touches every room in the building is not a write to make
   * blind.
   */
  const runReconcile = async (apply: boolean) => {
    setReconciling(true);
    setError('');
    try {
      const res = apply
        ? await api.post('rooms/reconcile-occupancy', { json: {} }).json<{
            success: boolean;
            data: ReconcileReport;
          }>()
        : await api.get('rooms/reconcile-occupancy').json<{
            success: boolean;
            data: ReconcileReport;
          }>();
      setReconcileResult(res.data);
      setReconcileApplied(apply);
      if (apply) refreshRooms();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setReconciling(false);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 rooms, so the export walks the pages of the
   * filtered set instead of asking for one big page that silently arrives
   * truncated. The filters and the search of the view travel with it, and the
   * operator is told how many rooms the server reported and how many the file
   * carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const rows: RoomRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(filterParams.toString());
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`rooms?${params.toString()}`).json<RoomsListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no room for these filters.');
        return;
      }

      const headers = [
        'Room',
        'Floor',
        'Sharing type',
        'Beds taken',
        'Beds free',
        'Rent per month',
        'In-room services',
        'In service',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((room) => {
        const beds = bedsOf(room);
        return [
          escapeCsv(room.roomNumber),
          escapeCsv(room.floor?.label ?? '—'),
          escapeCsv(`${room.sharingType} Sharing`),
          escapeCsv(beds.filter((bed) => bed.isOccupied).length),
          escapeCsv(beds.filter((bed) => !bed.isOccupied).length),
          escapeCsv(room.monthlyRent),
          escapeCsv(roomServiceState(room).label),
          escapeCsv(room.isActive ? 'In service' : 'Out of service'),
        ];
      });
      const csvContent = [headers.join(','), ...exportRows.map((row) => row.join(','))].join(
        '\r\n',
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rooms-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} rooms: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${rows.length} rooms the server reports for these filters. The free-bed filter narrows the screen, not the file, because the server cannot filter on a free bed.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({
      roomNumber: null,
      floorId: null,
      sharingType: null,
      isActive: null,
      availability: null,
    });
    setPage(1);
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'Service',
            value: statusFilter === 'true' ? 'In service' : 'Out of service',
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(floorFilter
      ? [
          {
            key: 'floor',
            label: 'Floor',
            value: floorLabelText,
            onRemove: () => {
              floorState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(sharingFilter
      ? [
          {
            key: 'sharing',
            label: 'Sharing',
            value: `${sharingFilter} Sharing`,
            onRemove: () => {
              sharingState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(availabilityFilter
      ? [
          {
            key: 'availability',
            label: 'Beds',
            value: availabilityFilter === 'vacant' ? 'Has a free bed' : 'Full',
            onRemove: () => {
              availabilityState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: 'search',
            label: 'Room number',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<RoomRow>[] = [
    {
      header: 'Room',
      accessor: (row) => (
        <div>
          <Link
            href={`/rooms/${row._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.roomNumber}
          </Link>
          <div className="text-2xs text-(--color-text-muted)">
            {row.sharingType} Sharing · {fmtMoney(row.monthlyRent)}/mo
          </div>
        </div>
      ),
    },
    {
      header: 'Floor',
      accessor: (row) =>
        row.floor?._id ? (
          <Link
            href={`/floors/${row.floor._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.floor.label ?? 'Floor'}
          </Link>
        ) : (
          <span className="text-(--color-text-muted)">No floor</span>
        ),
    },
    {
      header: 'Beds',
      accessor: (row) => {
        const beds = bedsOf(row);
        const free = beds.filter((bed) => !bed.isOccupied).length;
        return (
          <div>
            <BedMap beds={beds} />
            <div className="text-2xs text-(--color-text-muted)">
              {free} free of {beds.length}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Who sleeps here',
      accessor: (row) => {
        const taken = bedsOf(row).filter((bed) => bed.isOccupied);
        if (taken.length === 0) {
          return <span className="text-(--color-text-muted)">Nobody</span>;
        }
        return (
          <div className="space-y-0.5">
            {taken.map((bed) => (
              <div key={bed.bedId} className="text-xs">
                <span className="text-2xs font-mono text-(--color-text-muted)">{bed.bedId}</span>{' '}
                {bed.tenantId ? (
                  <Link
                    href={`/tenants/${bed.tenantId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {bed.tenantName ?? 'View resident'}
                  </Link>
                ) : (
                  <span className="font-semibold text-(--color-text-primary)">
                    {bed.tenantName ?? 'Taken'}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      header: 'In-room services',
      accessor: (row) => {
        const service = roomServiceState(row);
        return (
          <div>
            <StatusBadge variant={service.variant} label={service.label} />
            <span className="text-2xs block text-(--color-text-muted)">{service.detail}</span>
          </div>
        );
      },
    },
    {
      header: 'Service',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
          label={row.isActive ? 'In service' : 'Out of service'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/rooms/${row._id}`)}
          onEdit={() => router.push(`/rooms/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  const filtersActive = Boolean(search || floorFilter || sharingFilter || statusFilter);
  const deleteOccupied = deleteTarget
    ? bedsOf(deleteTarget).filter((bed) => bed.isOccupied).length
    : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rooms"
        description="The bed map of the building: which beds are free, who is in them, and what each room depends on"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReconcileResult(null);
                setReconcileApplied(false);
                void runReconcile(false);
              }}
              disabled={reconciling}
              title="Report the drift between the beds and the residents, without writing anything"
            >
              <Wrench className="h-4 w-4" />
              Check the bed map
            </Button>
            <div className="flex overflow-hidden rounded-(--radius-md) border-[length:var(--bw-default)] border-(--border-color)">
              <button
                type="button"
                onClick={() => viewState.setValue('table')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'table'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
                }`}
                aria-label="Table view"
                aria-pressed={viewMode === 'table'}
              >
                <LayoutList className="mr-1 inline h-3.5 w-3.5" />
                Rooms
              </button>
              <button
                type="button"
                onClick={() => viewState.setValue('map')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'map'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
                }`}
                aria-label="Bed map view"
                aria-pressed={viewMode === 'map'}
              >
                <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
                Bed map
              </button>
            </div>
            <Button onClick={() => router.push('/rooms/new')}>
              <Plus className="h-4 w-4" />
              Add Room
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {deleteResult && (
        <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-xs font-semibold text-(--color-warning-800)">
          Room {deleteResult.roomNumber} is out of service. The server kept the record, set the
          active flag to false, recounted the rooms on {deleteResult.floor?.label ?? 'its floor'}{' '}
          and wrote a delete entry in the audit log. The residents of the room were not told.
        </div>
      )}

      {/* The compact band: the numbers, the status tabs and the filters in one
          surface, so the first data row is reachable without scrolling past
          half a screen of chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Rooms in view',
            value: String(total),
            hint: 'the server reports these for the filters',
            tone: 'brand',
          },
          {
            label: 'Beds taken',
            value: stats ? `${stats.occupiedBeds} / ${stats.totalBeds}` : '-',
            hint: stats ? 'of the beds in this set' : 'not reported',
            tone: 'default',
          },
          {
            label: 'Free beds',
            value: stats ? String(stats.vacantBeds) : '-',
            hint: stats ? 'a bed with no resident' : 'not reported',
            tone: stats && stats.vacantBeds === 0 ? 'warning' : 'success',
          },
          {
            label: 'Room rent /mo',
            value: stats ? fmtMoney(stats.potentialRent) : '-',
            hint: stats ? 'one rent per room, not per bed' : 'not reported',
            tone: 'default',
          },
        ]}
      >
        {/* Status tab strip. The counts are the rows the tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone: tab.key === 'true' ? 'success' : tab.key === 'false' ? 'default' : 'brand',
          }))}
          active={statusFilter}
          onChange={(key) => {
            statusState.setValue(key);
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search by room number..."
              aria-label="Search by room number"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <ResourceSelect
            endpoint="floors"
            value={floorFilter}
            onChange={(val) => {
              floorState.setValue(val);
              setPage(1);
            }}
            placeholder="All Floors"
            valueKey="_id"
            labelKey={floorLabel}
            dataPath="data"
            className="w-52"
          />
          <Select
            aria-label="Filter by sharing type"
            size="compact"
            options={[
              { value: '', label: 'All sharing types' },
              { value: '2', label: '2 Sharing' },
              { value: '3', label: '3 Sharing' },
              { value: '4', label: '4 Sharing' },
            ]}
            value={sharingFilter}
            onChange={(e) => {
              sharingState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-48"
          />
          <Select
            aria-label="Filter by free beds"
            size="compact"
            options={[
              { value: '', label: 'Any bed state' },
              { value: 'vacant', label: 'Has a free bed' },
              { value: 'full', label: 'Full' },
            ]}
            value={availabilityFilter}
            onChange={(e) => {
              availabilityState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
          <Button
            variant="outline"
            onClick={() => void handleExportCsv()}
            disabled={exporting || rooms.length === 0}
            loading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {reconcileResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-(--color-text-primary)">
                {reconcileApplied
                  ? `The bed map was rebuilt - ${reconcileResult.fixedRooms} room${
                      reconcileResult.fixedRooms === 1 ? '' : 's'
                    } repaired`
                  : `The bed map is checked, not written - ${reconcileResult.fixedRooms} room${
                      reconcileResult.fixedRooms === 1 ? '' : 's'
                    } would be repaired`}
              </p>
              <p className="mt-1 text-xs font-semibold text-(--color-text-secondary)">
                Scanned {reconcileResult.scannedRooms} rooms · {reconcileResult.scannedTenants}{' '}
                active residents · {reconcileResult.occupiedBeds} beds taken ·{' '}
                {reconcileResult.freedBeds} stale beds to free
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss the reconcile report"
              onClick={() => setReconcileResult(null)}
              className="rounded-(--radius-md) p-1 text-(--color-text-muted) hover:bg-(--color-field-bg)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!reconcileApplied && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runReconcile(true)}
                disabled={reconciling}
                loading={reconciling}
              >
                Rebuild the bed map now
              </Button>
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The rebuild reads the active resident records and rewrites every bed of every room.
                A bed whose resident has left is freed, a bed whose resident is missing is taken,
                and a bed claimed by two residents keeps the one who moved in first. The server
                writes a reconcile entry in the audit log and tells nobody.
              </p>
            </div>
          )}

          {reconcileResult.conflicts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-(--color-danger-700)">
                Bed conflicts ({reconcileResult.conflicts.length}) — the earliest move-in keeps the
                bed, the rest are listed for a manual transfer
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.conflicts.map((cf) => (
                  <li
                    key={`${cf.roomId}-${cf.bedId}`}
                    className="rounded-(--radius-md) border border-(--color-danger-200) bg-(--color-card-bg) px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-(--color-text-primary)">
                      Room {cf.roomNumber} · Bed {cf.bedId}
                    </span>
                    <span className="ml-2 text-(--color-text-secondary)">
                      {cf.tenantNames.join(', ')}
                    </span>
                    <span className="ml-2">
                      {cf.tenantIds
                        .filter((tid) => tid !== cf.keptTenantId)
                        .map((tid) => (
                          <button
                            key={tid}
                            type="button"
                            onClick={() => router.push(`/tenants/${tid}`)}
                            className="mr-1 font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                          >
                            Move the resident
                          </button>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reconcileResult.orphans.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-(--color-warning-800)">
                Residents with no bed ({reconcileResult.orphans.length}) — the room or the bed they
                point at is gone
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.orphans.map((o) => (
                  <li
                    key={o.tenantId}
                    className="rounded-(--radius-md) border border-(--color-warning-200) bg-(--color-card-bg) px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/tenants/${o.tenantId}`)}
                      className="font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                    >
                      {o.tenantName}
                    </button>
                    <span className="ml-2 text-(--color-text-secondary)">
                      Bed {o.bedId} · {o.reason.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reconcileResult.invalidRooms.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-(--color-warning-800)">
                Rooms whose bed count does not match the sharing type (
                {reconcileResult.invalidRooms.length})
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.invalidRooms.map((r) => (
                  <li
                    key={r.roomId}
                    className="rounded-(--radius-md) border border-(--border-color) bg-(--color-card-bg) px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/rooms/${r.roomId}`)}
                      className="font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                    >
                      Room {r.roomNumber}
                    </button>
                    <span className="ml-2 text-(--color-text-secondary)">
                      {r.bedCount} beds for {r.sharingType} sharing
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {viewMode === 'map' ? (
        <>
          {total > visibleRooms.length && (
            <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-secondary)">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              The bed map draws the first {visibleRooms.length} of the {total} rooms the server
              reports for these filters: the server serves at most 100 rooms in one page. Narrow the
              set with the floor filter to see it whole.
            </p>
          )}
          <BedOccupancyGrid rooms={visibleRooms.map(toGridRoom)} isLoading={isLoading} />
        </>
      ) : (
        <DataTable
          columns={columns}
          data={visibleRooms}
          keyExtractor={(row: RoomRow) => row._id}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/rooms/${row._id}`)}
          pagination={{
            page,
            perPage,
            total,
            onPageChange: (p) => setPage(p),
            onPerPageChange: (pp) => {
              setPerPage(pp);
              setPage(1);
            },
          }}
          emptyState={
            // The empty state answers the question the operator asked. An empty
            // filter is not the same as an empty building.
            filtersActive || availabilityFilter ? (
              <EmptyState
                icon={<DoorOpen className="h-10 w-10" />}
                title="No room in this view"
                description="The server reports no room for the filters above."
                action={{ label: 'Clear the filters', onClick: clearAllFilters }}
              />
            ) : (
              <EmptyState
                icon={<DoorOpen className="h-10 w-10" />}
                title="No rooms yet"
                description="Add the first room: the server creates its beds from the sharing type and counts it on its floor."
                action={{ label: 'Add Room', onClick: () => router.push('/rooms/new') }}
              />
            )
          }
          mobileCardRenderer={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/rooms/${row._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  Room {row.roomNumber}
                </Link>
                <StatusBadge
                  variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
                  label={row.isActive ? 'In service' : 'Out of service'}
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-(--color-text-muted)">
                <span>{row.floor?.label ?? 'No floor'}</span>
                <span>{row.sharingType} Sharing</span>
                <span>{fmtMoney(row.monthlyRent)}/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <BedMap beds={bedsOf(row)} />
                <span className="text-2xs text-(--color-text-muted)">
                  {freeBedsOf(row)} free of {bedsOf(row).length}
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/rooms/${row._id}`)}
                  onEdit={() => router.push(`/rooms/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          )}
        />
      )}

      {/* What the columns and the numbers mean. A bed map is read fast, and a
          number nobody can place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every number in the band is the server&apos;s count over the whole filtered set, not over
          the page on screen. The filters that carry the set live in the address bar, so this view
          is a link.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Beds</strong> is the shape of the room:
          one chip per bed, a filled chip for a bed with a resident and a dashed chip for a free
          one. The room record holds the beds, and the server rebuilds them from the resident
          records when they drift.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">In-room services</strong> is the health
          of this room&apos;s own amenities. The health of the services the floor carries (water,
          geyser, wifi, lift) is a floor record and lives on the room and floor pages.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Room rent /mo</strong> is the sum of the
          monthly rent of the rooms in service, one rent per room and not per bed. What a resident
          owes is raised from the rent on their own record.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Has a free bed</strong> narrows the
          rooms on this page only: the server cannot filter on a free bed, so the numbers in the
          band stay over the whole set.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Take the room out of service"
        message={`The server keeps the record and sets its active flag to false, so the room disappears from the lists a new resident is picked from. It recounts the rooms on the floor and writes a delete entry in the audit log. ${
          deleteOccupied > 0
            ? `It will refuse: ${deleteOccupied} bed(s) of this room still hold a resident. Move or check them out first.`
            : 'It sends no message: the residents of the room are not told.'
        }`}
        confirmLabel="Take it out of service"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <RoomsContent />
    </Suspense>
  );
}
