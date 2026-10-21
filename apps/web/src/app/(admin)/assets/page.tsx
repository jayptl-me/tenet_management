'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Download,
  Info,
  Plus,
  Search,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import {
  AssetCategoryIcon,
  AssetStockMeter,
  assetCategoryLabel,
  formatShortDate,
  isLowStock,
} from '@/components/ui/AssetVisuals';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /assets            apps/api/src/routes/assets.ts:158-209
//   GET /assets/low-stock  apps/api/src/routes/assets.ts:212-221
//   GET /assets/service-due apps/api/src/routes/assets.ts:224-236
//   DELETE /assets/:id     apps/api/src/routes/assets.ts:357-384

interface PopulatedRef {
  _id?: string;
  label?: string;
  floorNumber?: number;
  roomNumber?: string;
}

interface AssetRow {
  _id: string;
  name: string;
  category: string;
  location?: string;
  floorId?: PopulatedRef | string | null;
  roomId?: PopulatedRef | string | null;
  quantity?: number;
  lowStockThreshold?: number;
  nextServiceDate?: string | null;
  status: string;
  notes?: string;
  createdAt?: string;
}

interface AssetsListBody {
  success: boolean;
  data: AssetRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Filter vocabulary ──────────────────────────────────────────────────

/** The five states the model holds (apps/api/src/models/asset.ts:63). */
const STATUS_VALUES = ['available', 'in_use', 'under_maintenance', 'damaged', 'retired'] as const;

const STATUS_TABS = [
  { key: '', label: 'All assets' },
  { key: 'available', label: 'Available' },
  { key: 'in_use', label: 'In use' },
  { key: 'under_maintenance', label: 'Under maintenance' },
  { key: 'damaged', label: 'Damaged' },
  { key: 'retired', label: 'Retired' },
];

/** The count keys the tab strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_VALUES] as const;

const CATEGORY_VALUES = ['furniture', 'appliance', 'electronics', 'cleaning', 'other'] as const;

/** The two clocks of this module, read from the server's own endpoints. */
const VIEW_VALUES = ['low', 'due'] as const;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

// Stable empty fallbacks. `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_ASSETS: AssetRow[] = [];

const ASSETS_LIST_KEY = ['assets', 'list'] as const;
const ASSETS_COUNT_KEY = ['assets', 'count'] as const;
const LOW_STOCK_KEY = ['assets', 'low-stock'] as const;
const SERVICE_DUE_KEY = ['assets', 'service-due'] as const;

// ── Helpers ────────────────────────────────────────────────────────────

/** The floor of a row, when the server resolved it. */
function floorOf(row: AssetRow): PopulatedRef | null {
  return row.floorId && typeof row.floorId === 'object' ? row.floorId : null;
}

/** The room of a row, when the server resolved it. */
function roomOf(row: AssetRow): PopulatedRef | null {
  return row.roomId && typeof row.roomId === 'object' ? row.roomId : null;
}

/** The name of the floor, as the server holds it. */
function floorText(row: AssetRow): string | null {
  const floor = floorOf(row);
  if (!floor) return null;
  return floor.label ?? (floor.floorNumber != null ? `Floor ${floor.floorNumber}` : null);
}

/**
 * The service clock of one row.
 *
 * The date is the server's; the comparison is a date, not a money number, and
 * the server sends no flag for it. A retired asset has no service clock: the
 * server leaves it out of the service-due set.
 */
function serviceState(row: AssetRow): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (row.status === 'retired') return { label: 'Closed', variant: 'neutral' };
  if (!row.nextServiceDate) return { label: 'Unscheduled', variant: 'neutral' };
  if (new Date(row.nextServiceDate).getTime() < Date.now()) {
    return { label: 'Overdue', variant: 'danger' };
  }
  return { label: formatShortDate(row.nextServiceDate), variant: 'success' };
}

function AssetsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a view of the register can be
  // linked, cited and reviewed, and a link that carries a query parameter
  // lands filtered.
  const searchState = useUrlSearch('search');
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_VALUES });
  const categoryState = useUrlState<string>('category', {
    defaultValue: '',
    allowed: CATEGORY_VALUES,
  });
  const viewState = useUrlState<string>('view', { defaultValue: '', allowed: VIEW_VALUES });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const statusFilter = statusState.value;
  const categoryFilter = categoryState.value;
  const view = viewState.value;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  // The outcome of the last write, as the server reports it.
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * The query parameters of the filtered set.
   *
   * Every read of the register sends the same set: the table, the counts behind
   * the status tabs and the CSV export. A number that answers a different
   * question than the rows would be a number nobody can trust.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (search) params.set('search', search);
    return params;
  }, [categoryFilter, search]);

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));
  if (statusFilter) listParams.set('status', statusFilter);

  const {
    data: listBody,
    isPending: listPending,
    error: listError,
  } = useApiBodyQuery<AssetsListBody>(
    [...ASSETS_LIST_KEY, page, perPage, statusFilter, categoryFilter, search],
    `assets?${listParams.toString()}`,
    { enabled: view === '' },
  );

  /**
   * The two clocks, read from the server's own endpoints.
   *
   * GET /assets/low-stock returns every asset at or below its threshold and
   * GET /assets/service-due every asset due within thirty days. Neither set
   * takes a filter and neither is paginated, so the two numbers are the
   * register's, not the page's.
   */
  const { data: lowStockRows, error: lowStockError } = useApiQuery<AssetRow[]>(
    LOW_STOCK_KEY,
    'assets/low-stock',
  );
  const { data: serviceDueRows, error: serviceDueError } = useApiQuery<AssetRow[]>(
    SERVICE_DUE_KEY,
    'assets/service-due',
  );

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<AssetsListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('status', key);
      return {
        queryKey: [...ASSETS_COUNT_KEY, categoryFilter, search, key],
        queryFn: () => queryJson<AssetsListBody>(`assets?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta?.total ?? null;
  });

  /**
   * The rows of the table.
   *
   * In the register view the server does the filtering. In the two clock views
   * the server returns the whole set and the page narrows it, because neither
   * endpoint takes a filter: the page says so in the legend.
   */
  const narrowedRows = useMemo(() => {
    const source = view === 'low' ? lowStockRows : serviceDueRows;
    if (!source || source.length === 0) return EMPTY_ASSETS;
    const needle = search.toLowerCase();
    return source.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (needle === '') return true;
      return `${row.name ?? ''} ${row.location ?? ''} ${row.notes ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [view, lowStockRows, serviceDueRows, statusFilter, categoryFilter, search]);

  const rows = view === '' ? (listBody?.data ?? EMPTY_ASSETS) : narrowedRows;
  const serverTotal = listBody?.meta?.total ?? 0;
  const total = view === '' ? serverTotal : narrowedRows.length;

  const displayedRows = useMemo(() => {
    if (view === '') return rows;
    return rows.slice((page - 1) * perPage, page * perPage);
  }, [rows, view, page, perPage]);

  const isLoading =
    view === ''
      ? listPending
      : view === 'low'
        ? lowStockRows === undefined
        : serviceDueRows === undefined;
  const fetchErrorMessage =
    errorMessage(listError) || errorMessage(lowStockError) || errorMessage(serviceDueError);

  const refreshAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ASSETS_LIST_KEY });
    queryClient.invalidateQueries({ queryKey: ASSETS_COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: LOW_STOCK_KEY });
    queryClient.invalidateQueries({ queryKey: SERVICE_DUE_KEY });
  }, [queryClient]);

  /**
   * The retirement.
   *
   * The server keeps the row and sets its status to retired. It writes an
   * update entry in the audit log and sends no message: nobody is told that the
   * item left the register.
   */
  const handleRetire = async () => {
    if (!deleteTarget) return;
    const retired = deleteTarget;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`assets/${retired._id}`).json();
      setDeleteTarget(null);
      // Re-read the server: the list, the band and the status column below
      // show the state the server actually holds.
      refreshAssets();
      // Read the record back so the banner quotes the server's own status.
      let serverStatus = '';
      try {
        const refreshed = await api
          .get(`assets/${retired._id}`)
          .json<{ success: boolean; data?: { status?: string } }>();
        serverStatus = refreshed.data?.status ?? '';
      } catch {
        // The list below still shows the server's state.
      }
      setWriteResult(
        serverStatus
          ? `Retired. The server now reports "${retired.name}" with status "${serverStatus.replace(/_/g, ' ')}". The record is kept and an update entry was written in the audit log. No resident was told.`
          : `Retired. The server kept the record of "${retired.name}" and wrote an update entry in the audit log. No resident was told.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The CSV export of what the table shows.
   *
   * In the register view the API clamps a page to 100 assets, so the export
   * walks the pages of the filtered set instead of asking for one big page
   * that silently arrives truncated. In the two clock views the server set is
   * whole and the file carries it narrowed by the filters. Either way the
   * operator is told how many assets the server reports and how many the file
   * carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const exported: AssetRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      if (view === '') {
        for (;;) {
          const params = new URLSearchParams(filterParams.toString());
          params.set('page', String(exportPage));
          params.set('limit', String(EXPORT_PAGE_SIZE));
          if (statusFilter) params.set('status', statusFilter);
          const res = await api.get(`assets?${params.toString()}`).json<AssetsListBody>();
          const pageRows = res.data ?? [];
          reportedTotal = res.meta?.total ?? reportedTotal;
          exported.push(...pageRows);
          const totalPages = res.meta?.totalPages ?? 1;
          if (exportPage >= totalPages || pageRows.length === 0) break;
          exportPage += 1;
        }
      } else {
        exported.push(...narrowedRows);
        reportedTotal = (view === 'low' ? lowStockRows : serviceDueRows)?.length ?? 0;
      }

      if (exported.length === 0) {
        setWriteResult('Nothing to export: the server reports no asset for these filters.');
        return;
      }

      const headers = [
        'Asset',
        'Category',
        'Floor',
        'Room',
        'Location',
        'Quantity',
        'Low stock threshold',
        'Status',
        'Next service',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = exported.map((row) => {
        const room = roomOf(row);
        return [
          escapeCsv(row.name),
          escapeCsv(assetCategoryLabel(row.category)),
          escapeCsv(floorText(row) ?? ''),
          escapeCsv(room?.roomNumber ?? ''),
          escapeCsv(row.location),
          escapeCsv(row.quantity),
          escapeCsv(row.lowStockThreshold),
          escapeCsv(row.status),
          escapeCsv(row.nextServiceDate ? formatShortDate(row.nextServiceDate) : ''),
        ];
      });
      const csvContent = [headers.join(','), ...exportRows.map((row) => row.join(','))].join(
        '\r\n',
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `assets-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      let exportMessage: string;
      if (view !== '') {
        exportMessage = `Export written with ${exported.length} of the ${reportedTotal} assets the server holds for this view, narrowed by the filters.`;
      } else if (exported.length < reportedTotal) {
        exportMessage = `Export written with ${exported.length} of ${reportedTotal} assets: the export stops at the last page the server returns, so the file is short of the whole set.`;
      } else {
        exportMessage = `Export written with all ${exported.length} assets the server reports for these filters.`;
      }
      setWriteResult(exportMessage);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ search: null, status: null, category: null, view: null });
    setPage(1);
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'State',
            value: statusFilter.replace(/_/g, ' '),
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(categoryFilter
      ? [
          {
            key: 'category',
            label: 'Category',
            value: assetCategoryLabel(categoryFilter),
            onRemove: () => {
              categoryState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: 'search',
            label: 'Search',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
    ...(view
      ? [
          {
            key: 'view',
            label: 'View',
            value: view === 'low' ? 'Below threshold' : 'Due for service',
            onRemove: () => {
              viewState.reset();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<AssetRow>[] = [
    {
      header: 'Asset',
      accessor: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) [&_svg]:h-4 [&_svg]:w-4">
            <AssetCategoryIcon category={row.category} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/assets/${row._id}`}
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-semibold text-(--color-brand-600) hover:underline"
            >
              {row.name}
            </Link>
            <span className="text-2xs block text-(--color-text-muted)">
              {assetCategoryLabel(row.category)}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Where it lives',
      accessor: (row) => {
        const floor = floorOf(row);
        const room = roomOf(row);
        const parts = [
          floor?._id ? (
            <Link
              key="floor"
              href={`/floors/${floor._id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              {floorText(row) ?? 'Floor'}
            </Link>
          ) : null,
          room?._id ? (
            <Link
              key="room"
              href={`/rooms/${room._id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              Room {room.roomNumber ?? ''}
            </Link>
          ) : null,
        ].filter(Boolean);
        return (
          <div>
            {parts.length > 0 ? (
              <span className="text-xs font-medium text-(--color-text-secondary)">
                {parts.map((part, index) => (
                  <span key={index}>
                    {index > 0 ? ' · ' : ''}
                    {part}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-xs font-medium text-(--color-text-muted)">
                {row.location ?? 'No location'}
              </span>
            )}
            {parts.length > 0 && row.location && (
              <span className="text-2xs block text-(--color-text-muted)">{row.location}</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Stock',
      accessor: (row) => {
        const low = isLowStock(row.quantity, row.lowStockThreshold);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{row.quantity ?? '-'}</span>
              {low && <StatusBadge variant="warning" label="Low" />}
            </div>
            <AssetStockMeter
              quantity={row.quantity}
              threshold={row.lowStockThreshold}
              className="mt-1 hidden w-24 xl:block"
            />
          </div>
        );
      },
    },
    {
      header: 'Service',
      accessor: (row) => {
        const service = serviceState(row);
        return (
          <div>
            <StatusBadge variant={service.variant} label={service.label} />
            {row.nextServiceDate && row.status !== 'retired' && (
              <span className="text-2xs block text-(--color-text-muted)">
                next service {formatShortDate(row.nextServiceDate)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'State',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/assets/${row._id}`)}
          onEdit={() => router.push(`/assets/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  const filtersActive = Boolean(search || statusFilter || categoryFilter || view);
  const outOfService = (counts['under_maintenance'] ?? 0) + (counts['damaged'] ?? 0);
  const retireMessage = `The server keeps the record of "${deleteTarget?.name ?? ''}" and sets its state to retired, so it leaves the service due list. It writes an update entry in the audit log and sends no message: nobody is told that the item left the register.`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assets"
        description="The register of what the PG owns: what is broken, what is due for service and what is running out"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                viewState.setValue('low');
                setPage(1);
              }}
              disabled={view === 'low'}
              title="Show the assets that are at or below their low stock threshold"
            >
              <AlertTriangle className="h-4 w-4" />
              Below threshold
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                viewState.setValue('due');
                setPage(1);
              }}
              disabled={view === 'due'}
              title="Show the assets whose service is due within thirty days"
            >
              <CalendarClock className="h-4 w-4" />
              Due for service
            </Button>
            <Button onClick={() => router.push('/assets/new')}>
              <Plus className="h-4 w-4" />
              Register an asset
            </Button>
          </div>
        }
      />

      <ErrorBanner message={fetchErrorMessage || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers, the status tabs and the filters in one
          surface, so the first data row is reachable without scrolling past
          half a screen of chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Assets in view',
            value: String(total),
            hint:
              view === ''
                ? 'the server reports these for the filters'
                : view === 'low'
                  ? "of the server's low stock set"
                  : "of the server's service due set",
            tone: 'brand',
          },
          {
            label: 'Below threshold',
            value: lowStockRows ? String(lowStockRows.length) : '-',
            hint: 'across the whole register',
            tone: lowStockRows && lowStockRows.length > 0 ? 'warning' : 'default',
          },
          {
            label: 'Service due',
            value: serviceDueRows ? String(serviceDueRows.length) : '-',
            hint: 'in the next 30 days, whole register',
            tone: 'default',
          },
          {
            label: 'Out of service',
            value: String(outOfService),
            hint: 'under maintenance and damaged, over the filters',
            tone: outOfService > 0 ? 'danger' : 'success',
          },
        ]}
      >
        {/* The status tabs. The count behind a tab is the number of rows the
            tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'available'
                ? 'success'
                : tab.key === 'under_maintenance'
                  ? 'warning'
                  : tab.key === 'damaged'
                    ? 'danger'
                    : tab.key === 'retired'
                      ? 'default'
                      : 'brand',
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
              placeholder="Search by name, location or notes..."
              aria-label="Search by name, location or notes"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            aria-label="Filter by category"
            size="compact"
            options={[
              { value: '', label: 'All categories' },
              { value: 'furniture', label: 'Furniture' },
              { value: 'appliance', label: 'Appliance' },
              { value: 'electronics', label: 'Electronics' },
              { value: 'cleaning', label: 'Cleaning' },
              { value: 'other', label: 'Other' },
            ]}
            value={categoryFilter}
            onChange={(e) => {
              categoryState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-48"
          />
          <Button
            variant="outline"
            onClick={() => void handleExportCsv()}
            disabled={exporting || total === 0}
            loading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {view !== '' && (
        <div className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-xs">
          <span className="font-semibold text-(--color-text-secondary)">
            {view === 'low'
              ? `Showing the assets at or below their threshold (${total} of the server's low stock set)`
              : `Showing the assets due for service within 30 days (${total} of the server's service due set)`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              viewState.reset();
              setPage(1);
            }}
          >
            Show the whole register
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={displayedRows}
        keyExtractor={(row: AssetRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/assets/${row._id}`)}
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
          // filter is not the same as an empty register.
          view === 'low' ? (
            <EmptyState
              icon={<Boxes className="h-10 w-10" />}
              title="Nothing is running out"
              description="The server holds no asset at or below its low stock threshold."
              action={{ label: 'Show the whole register', onClick: () => viewState.reset() }}
            />
          ) : view === 'due' ? (
            <EmptyState
              icon={<CalendarClock className="h-10 w-10" />}
              title="Nothing is due for service"
              description="The server holds no asset whose service falls due in the next thirty days."
              action={{ label: 'Show the whole register', onClick: () => viewState.reset() }}
            />
          ) : filtersActive ? (
            <EmptyState
              icon={<Wrench className="h-10 w-10" />}
              title="No asset in this view"
              description="The server reports no asset for the filters above."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : (
            <EmptyState
              icon={<Boxes className="h-10 w-10" />}
              title="No assets yet"
              description="Register the first item: the server writes it with its state, its count and its service dates."
              action={{ label: 'Register an asset', onClick: () => router.push('/assets/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => {
          const service = serviceState(row);
          const floor = floorOf(row);
          const room = roomOf(row);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/assets/${row._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex min-w-0 items-center gap-2 text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  <AssetCategoryIcon
                    category={row.category}
                    className="h-4 w-4 shrink-0 text-(--color-text-muted)"
                  />
                  <span className="truncate">{row.name}</span>
                </Link>
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-muted)">
                <span>{assetCategoryLabel(row.category)}</span>
                <span>{floor?.label ?? room?.roomNumber ?? row.location ?? 'No location'}</span>
                <span>Qty {row.quantity ?? '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge variant={service.variant} label={service.label} />
                <AssetStockMeter quantity={row.quantity} threshold={row.lowStockThreshold} />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/assets/${row._id}`)}
                  onEdit={() => router.push(`/assets/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          );
        }}
      />

      {/* What the columns and the numbers mean. The register is read fast, and
          a number nobody can place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          {
            'Every number in the band is the server count over the whole filtered set, not over the page on screen. The filters and the view live in the address bar, so this view is a link.'
          }
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Below threshold</strong>
          {
            ' is the server low stock set: every asset whose count has reached its own threshold. The set takes no filter and does not leave out a retired asset, so a retired item that was left counted still shows there.'
          }
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Service due</strong>
          {
            ' is the server service set: every asset with a next service date within thirty days. A retired asset is left out of it.'
          }
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Out of service</strong>
          {
            ' counts the assets under maintenance and the assets damaged, over the filters of the search and the category. The server sends no number for the whole register, so it is the sum of two server counts and not a count of the rows on screen.'
          }
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Where it lives</strong>
          {
            ' is the floor and the room the server resolved for the row. The two clock views come from endpoints that do not resolve them, so a row there shows its free-text location only.'
          }
        </p>
        <p>
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          {
            'The server cannot filter by room or floor, so the placement of a row is read from the row itself. Every asset links to the room and the floor it lives in from its own page.'
          }
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Retire this asset"
        message={retireMessage}
        confirmLabel="Retire it"
        loading={deleting}
        onConfirm={handleRetire}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <AssetsContent />
    </Suspense>
  );
}
