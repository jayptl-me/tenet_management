'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  BedSingle,
  Building2,
  Car,
  DoorOpen,
  Download,
  Droplets,
  Fan,
  Info,
  MoonStar,
  Plus,
  Refrigerator,
  RotateCcw,
  ScrollText,
  Shield,
  Shirt,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Users,
  Wifi,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson, type ApiQueryError } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { Textarea } from '@/components/ui/Textarea';
import { floorLabel } from '@/lib/resource-select-presets';
import type { AmenityDefinition, IAppConfig } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /floors/overview               apps/api/src/routes/floors.ts:97-172
//   GET /services?page&limit&floorId   apps/api/src/routes/services.ts:212-253
//   GET /app-config                    apps/api/src/models/appConfig.ts
//   PUT  /services/:id                 apps/api/src/routes/services.ts:361-461
//   POST /floors/reseed-services       apps/api/src/routes/floors.ts:388-414

interface ServiceStatusRow {
  _id: string;
  serviceType: string;
  status: string;
  floor?: { _id?: string; label?: string; floorNumber?: number };
  lastUpdatedAt?: string;
  lastUpdatedBy?: { name?: string };
  note?: string;
  openComplaintCount?: number;
}

interface FloorOverview {
  _id: string;
  label: string;
  floorNumber: number;
  stats: {
    activeRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyPct: number;
    potentialRent: number;
    services: { operational: number; degraded: number; down: number; openComplaints: number };
  };
}

interface ServiceListBody {
  success: boolean;
  data: ServiceStatusRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** The whole service set, read in one pass over the pages the API clamps. */
interface ServiceSet {
  rows: ServiceStatusRow[];
  total: number;
  pages: number;
}

/** One cell of the board: a service type on a floor. */
interface ServiceCell {
  serviceType: string;
  label: string;
  icon: LucideIcon;
  row: ServiceStatusRow | null;
}

/** One floor of the board with its cells. */
interface FloorBoardRow {
  floor: FloorOverview;
  cells: ServiceCell[];
  /** The rows the server holds for this floor, before the status filter. */
  rowCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** The lucide icon of an amenity definition, by its key. */
const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  zap: Zap,
  droplets: Droplets,
  thermometer: Thermometer,
  shield: Shield,
  shirt: Shirt,
  sparkles: Sparkles,
  'arrow-up-down': ArrowUpDown,
  car: Car,
  'bed-single': BedSingle,
  'scroll-text': ScrollText,
  'moon-star': MoonStar,
  fan: Fan,
  refrigerator: Refrigerator,
  wrench: Wrench,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Wrench;
}

/** The status vocabulary of the model. */
const STATUS_FILTERS = ['operational', 'degraded', 'down'] as const;

const STATUS_TABS = [
  { key: '', label: 'All services' },
  { key: 'operational', label: 'Operational' },
  { key: 'degraded', label: 'Degraded' },
  { key: 'down', label: 'Down' },
];

/** The page size the API allows (apps/api/src/routes/services.ts:231 clamps it to 100). */
const PAGE_SIZE = 100;

/** Stable empty fallbacks, so a memo that reads them does not churn. */
const EMPTY_ROWS: ServiceStatusRow[] = [];
const EMPTY_FLOORS: FloorOverview[] = [];
const EMPTY_DEFS: AmenityDefinition[] = [];

const SERVICE_SET_KEY = ['services', 'set'] as const;
const FLOORS_OVERVIEW_KEY = ['floors', 'overview'] as const;
const APP_CONFIG_KEY = ['app-config'] as const;

/**
 * The whole service set of the building, read over the pages the API clamps.
 *
 * The list route serves at most 100 rows in one page
 * (apps/api/src/routes/services.ts:231), and the board has to show every row
 * of every floor, so the pages are walked and the set is reported whole.
 */
async function fetchServiceSet(floorId: string): Promise<ServiceSet> {
  const filter = floorId ? `&floorId=${encodeURIComponent(floorId)}` : '';
  const first = await queryJson<ServiceListBody>(`services?page=1&limit=${PAGE_SIZE}${filter}`);
  const rows: ServiceStatusRow[] = [...(first.data ?? [])];
  const total = first.meta?.total ?? rows.length;
  const totalPages = first.meta?.totalPages ?? 1;
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        queryJson<ServiceListBody>(`services?page=${index + 2}&limit=${PAGE_SIZE}${filter}`),
      ),
    );
    for (const page of rest) rows.push(...(page.data ?? []));
  }
  return { rows, total, pages: totalPages };
}

/**
 * The per-floor answer of a bulk provisioning run, as the create page wrote it
 * into the address bar. A malformed payload renders nothing rather than a guess.
 */
interface ProvisionedRow {
  floor: string;
  outcome: string;
  kind: 'created' | 'exists' | 'refused';
}

function parseProvisionedRows(raw: string | null): ProvisionedRow[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const rows: ProvisionedRow[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as { floor?: unknown; outcome?: unknown; kind?: unknown };
    if (typeof row.floor !== 'string' || typeof row.outcome !== 'string') continue;
    const kind =
      row.kind === 'created' || row.kind === 'exists' || row.kind === 'refused'
        ? row.kind
        : 'refused';
    rows.push({ floor: row.floor, outcome: row.outcome, kind });
  }
  return rows;
}

/** The tone of a cell, by the state the server holds for it. */
function cellTone(status: string | null, isTarget: boolean): string {
  if (isTarget) return 'ring-2 ring-(--color-brand-500)';
  if (status === 'down') return 'border-(--color-danger-200) bg-(--color-danger-50)';
  if (status === 'degraded') return 'border-(--color-warning-200) bg-(--color-warning-50)';
  if (status === 'operational') return 'border-(--color-success-200) bg-(--color-success-50)';
  return 'border-dashed border-(--border-color) bg-(--color-field-bg)';
}

/** The text of a cell, by the state the server holds for it. */
function cellState(status: string | null): string {
  if (status === 'down') return 'Not working';
  if (status === 'degraded') return 'Only partly working';
  if (status === 'operational') return 'Working';
  return 'Not set up';
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}

function ServicesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { write: writeUrl } = useUrlStateWriter();

  // The floor filter lives in the address bar: a floor can be linked, cited and
  // reviewed, and a link that carries a query parameter lands filtered.
  const floorState = useUrlState<string>('floorId', { defaultValue: '' });
  const floorFilter = floorState.value;

  // The floors of the building and their service health, computed by the
  // server (apps/api/src/routes/floors.ts:97-172).
  const { data: floorRows = EMPTY_FLOORS, error: floorsError } = useApiQuery<FloorOverview[]>(
    FLOORS_OVERVIEW_KEY,
    'floors/overview',
  );

  // The catalog of the services a floor carries. Only the per floor
  // definitions are floor services; a room only amenity never becomes a floor
  // row (apps/api/src/routes/services.ts:34-39).
  const { data: appConfig } = useApiQuery<IAppConfig>(APP_CONFIG_KEY, 'app-config');
  const definitions = useMemo<AmenityDefinition[]>(
    () => (appConfig?.amenityDefinitions ?? EMPTY_DEFS).filter((def) => def.isPerFloor === true),
    [appConfig],
  );

  // The whole service set, walked over the pages the API clamps.
  const {
    data: serviceSet,
    isPending: setPending,
    error: servicesError,
  } = useQuery<ServiceSet, ApiQueryError>({
    queryKey: [...SERVICE_SET_KEY, floorFilter],
    queryFn: () => fetchServiceSet(floorFilter),
    staleTime: 15_000,
  });

  const rows = serviceSet?.rows ?? EMPTY_ROWS;

  // The state filter and the service filter live in the address bar too.
  const statusState = useUrlState<string>('status', {
    defaultValue: '',
    allowed: STATUS_FILTERS,
  });
  const statusFilter = statusState.value;

  /**
   * The values the service filter may take.
   *
   * They are the catalog of the per floor amenities and the types the server
   * actually holds, so a broken parameter in the address bar never filters the
   * board to nothing.
   */
  const serviceTypeValues = useMemo(() => {
    const keys = new Set(definitions.map((def) => def.key));
    for (const row of rows) keys.add(row.serviceType);
    return [...keys];
  }, [definitions, rows]);

  const serviceTypeState = useUrlState<string>('serviceType', {
    defaultValue: '',
    allowed: serviceTypeValues,
  });
  const serviceTypeFilter = serviceTypeState.value;

  // The server's per-floor answer to a bulk provisioning run, if this visit
  // came from one.
  const provisionedRows = parseProvisionedRows(searchParams.get('provisioned'));

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [target, setTarget] = useState<{ cell: ServiceCell; floor: FloorOverview } | null>(null);
  const [nextStatus, setNextStatus] = useState('operational');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * The service type filter narrows the set on the screen.
   *
   * The server cannot filter on a service type (apps/api/src/routes/services.ts:212-228
   * reads the floor and the status only), so the filter is applied here and
   * the legend says so.
   */
  const scopedRows = useMemo(
    () => (serviceTypeFilter ? rows.filter((row) => row.serviceType === serviceTypeFilter) : rows),
    [rows, serviceTypeFilter],
  );

  /** The counts behind the tabs: the rows the tab would show. */
  const counts = useMemo(() => {
    const map: Record<string, number> = { '': scopedRows.length };
    for (const key of STATUS_FILTERS) map[key] = 0;
    for (const row of scopedRows) {
      if (row.status in map) map[row.status] = (map[row.status] ?? 0) + 1;
    }
    return map;
  }, [scopedRows]);

  /**
   * The board: one line per floor, one tile per service type of that floor.
   *
   * A tile the server holds carries the state it holds. A tile the server does
   * not hold is a gap, and the office can provision it.
   */
  const board = useMemo<FloorBoardRow[]>(() => {
    const rowsByFloor = new Map<string, ServiceStatusRow[]>();
    for (const row of scopedRows) {
      const floorId = row.floor?._id;
      if (!floorId) continue;
      const list = rowsByFloor.get(floorId) ?? [];
      list.push(row);
      rowsByFloor.set(floorId, list);
    }

    const catalogKeys = definitions.map((def) => def.key);
    const result: FloorBoardRow[] = [];
    for (const floor of floorRows) {
      if (floorFilter && floor._id !== floorFilter) continue;
      const floorRowsForFloor = rowsByFloor.get(floor._id) ?? [];
      const types = [...catalogKeys];
      for (const row of floorRowsForFloor) {
        if (!types.includes(row.serviceType)) types.push(row.serviceType);
      }
      const cells: ServiceCell[] = types.map((serviceType) => {
        const row = floorRowsForFloor.find((entry) => entry.serviceType === serviceType) ?? null;
        const def = definitions.find((entry) => entry.key === serviceType);
        return {
          serviceType,
          label: def?.label ?? serviceType.replace(/_/g, ' '),
          icon: resolveIcon(def?.icon ?? 'wrench'),
          row,
        };
      });
      result.push({ floor, cells, rowCount: floorRowsForFloor.length });
    }
    return result;
  }, [floorRows, scopedRows, definitions, floorFilter]);

  /** The floors the board shows: a floor with a tile that matches the filter. */
  const visibleBoard = useMemo(() => {
    if (!statusFilter) return board;
    return board
      .map((entry) => ({
        ...entry,
        cells: entry.cells.filter((cell) => cell.row?.status === statusFilter),
      }))
      .filter((entry) => entry.cells.length > 0);
  }, [board, statusFilter]);

  /** The floors that carry no service row at all. */
  const floorsWithoutService = useMemo(
    () => (statusFilter ? [] : board.filter((entry) => entry.rowCount === 0).map((e) => e.floor)),
    [board, statusFilter],
  );

  /**
   * The band of the page: the standing picture of the building.
   *
   * Every number here is the server's own count over the floors in view, and
   * every number names its scope. The tiles below are the set in the address
   * bar.
   */
  const band = useMemo(() => {
    const floorsInView = floorRows.filter((floor) => !floorFilter || floor._id === floorFilter);
    let down = 0;
    let degraded = 0;
    let floorsWithProblem = 0;
    let residentsAffected = 0;
    for (const floor of floorsInView) {
      down += floor.stats.services.down;
      degraded += floor.stats.services.degraded;
      if (floor.stats.services.down + floor.stats.services.degraded > 0) {
        floorsWithProblem += 1;
        residentsAffected += floor.stats.occupiedBeds;
      }
    }
    return { floors: floorsInView.length, down, degraded, floorsWithProblem, residentsAffected };
  }, [floorRows, floorFilter]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SERVICE_SET_KEY });
    queryClient.invalidateQueries({ queryKey: FLOORS_OVERVIEW_KEY });
  }, [queryClient]);

  /** Open the action panel on a tile. */
  const openAction = (cell: ServiceCell, floor: FloorOverview) => {
    setTarget({ cell, floor });
    setNextStatus(cell.row?.status ?? 'operational');
    setNote(cell.row?.note ?? '');
    setError('');
  };

  /**
   * Set the status of a service on a floor.
   *
   * The server writes the status, stamps the record with the office and the
   * time, writes an update entry in the audit log and, when the status
   * actually moved, pushes a service update to the active residents of the
   * floor. A note on its own does not reach them.
   */
  const submitStatus = async () => {
    if (!target?.cell.row) return;
    const row = target.cell.row;
    const serviceName = target.cell.label;
    const floorName = target.floor.label;
    setSaving(true);
    setError('');
    try {
      await api
        .put(`services/${row._id}`, {
          json: { status: nextStatus, note },
        })
        .json();
      const moved = row.status !== nextStatus;
      setWriteResult(
        moved
          ? `${serviceName} on ${floorName} is ${nextStatus} now. The server wrote the status, stamped the record with your name and the time, wrote an update entry in the audit log and pushed a service update to the active residents of ${floorName}. A floor with nobody living on it has nobody to tell, and a failed push never undoes the write.`
          : `The note on ${serviceName} (${floorName}) was written. The server stamped the record with your name and the time and wrote an update entry in the audit log. The status did not move, so no message went to the residents.`,
      );
      setTarget(null);
      refresh();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Create the service rows the floors are missing.
   *
   * The server walks every floor and creates only the keys that are missing,
   * so the run is idempotent. The new rows start operational and the server
   * tells nobody: a row that was missing is a row nobody had reported.
   */
  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    setWriteResult('');
    try {
      const res = await api.post('floors/reseed-services').json<{
        success: boolean;
        data: { floorsTouched: number; rowsCreated: number };
      }>();
      setWriteResult(
        `The server created ${res.data.rowsCreated} missing service row(s) across ${res.data.floorsTouched} floor(s). The new rows start operational and the server tells nobody: a row that was missing is a row nobody had reported.`,
      );
      refresh();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setSeeding(false);
    }
  };

  /**
   * The CSV of the set in the address bar.
   *
   * The file carries the rows the board shows, and the report says how many
   * rows the server holds for the same filters, so a short file is never read
   * as the whole set.
   */
  const handleExportCsv = () => {
    const exportRows = visibleBoard.flatMap((entry) =>
      entry.cells.filter((cell) => cell.row !== null).map((cell) => ({ cell, floor: entry.floor })),
    );
    if (exportRows.length === 0) {
      setWriteResult('Nothing to export: the board shows no service for these filters.');
      return;
    }
    const headers = [
      'Service',
      'Floor',
      'Status',
      'Open complaints',
      'Last updated',
      'Updated by',
      'Note',
    ];
    const escapeCsv = (value: unknown) => {
      let str = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };
    const lines = exportRows.map(({ cell, floor }) =>
      [
        escapeCsv(cell.label),
        escapeCsv(floor.label),
        escapeCsv(cell.row?.status ?? 'not set up'),
        escapeCsv(cell.row?.openComplaintCount ?? 0),
        escapeCsv(
          cell.row?.lastUpdatedAt
            ? new Date(cell.row.lastUpdatedAt).toISOString().slice(0, 16).replace('T', ' ')
            : '-',
        ),
        escapeCsv(cell.row?.lastUpdatedBy?.name ?? '-'),
        escapeCsv(cell.row?.note ?? ''),
      ].join(','),
    );
    const csvContent = [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `services-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setWriteResult(
      `The file carries ${exportRows.length} of the ${scopedRows.length} row(s) the server holds for these filters. The service and the state filters narrow the board, and the file carries the set the board shows.`,
    );
  };

  const clearFilters = () => {
    writeUrl({ status: null, floorId: null, serviceType: null });
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'State',
            value: cellState(statusFilter),
            onRemove: () => statusState.reset(),
          },
        ]
      : []),
    ...(floorFilter
      ? [
          {
            key: 'floor',
            label: 'Floor',
            value:
              floorRows.find((floor) => floor._id === floorFilter)?.label ??
              `Floor ${floorFilter.slice(-6)}`,
            onRemove: () => floorState.reset(),
          },
        ]
      : []),
    ...(serviceTypeFilter
      ? [
          {
            key: 'service',
            label: 'Service',
            value:
              definitions.find((def) => def.key === serviceTypeFilter)?.label ??
              serviceTypeFilter.replace(/_/g, ' '),
            onRemove: () => serviceTypeState.reset(),
          },
        ]
      : []),
  ];

  const filtersActive = Boolean(statusFilter || floorFilter || serviceTypeFilter);
  const isLoading = setPending || (floorRows === EMPTY_FLOORS && floorsError === null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Service status"
        description="What is working and what is not, per floor, and who the server told"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleSeed()}
              disabled={seeding}
              loading={seeding}
              title="Create the service rows the floors are missing. The server creates only the missing keys, so the run is idempotent."
            >
              <RotateCcw className="h-4 w-4" />
              Seed the missing rows
            </Button>
            <Button onClick={() => router.push('/services/new')}>
              <Plus className="h-4 w-4" />
              Provision a service
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(floorsError) || errorMessage(servicesError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
          {writeResult}
        </div>
      )}

      {provisionedRows.length > 0 && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold text-(--color-text-primary)">
              The provisioning run, per floor, as the server answered it
            </p>
            <button
              type="button"
              aria-label="Dismiss the provisioning result"
              onClick={() => writeUrl({ provisioned: null })}
              className="rounded-(--radius-md) p-1 text-(--color-text-muted) hover:bg-(--color-field-bg)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {provisionedRows.map((row) => (
              <li key={`${row.floor}-${row.outcome}`} className="text-xs">
                <StatusBadge
                  variant={
                    row.kind === 'created'
                      ? 'success'
                      : row.kind === 'exists'
                        ? 'warning'
                        : 'danger'
                  }
                  label={
                    row.kind === 'created' ? 'created' : row.kind === 'exists' ? 'held' : 'failed'
                  }
                />
                <span className="ml-2 font-semibold text-(--color-text-primary)">{row.floor}</span>
                <span className="ml-1 text-(--color-text-secondary)">{row.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The band: the standing picture of the building. Every number names the
          scope it covers, and the tiles below are the set in the address bar. */}
      <PageBand
        metrics={[
          {
            label: 'Floors in view',
            value: String(band.floors),
            hint: 'the floors the server holds',
            tone: 'brand',
          },
          {
            label: 'Down now',
            value: String(band.down),
            hint: 'services that are not working',
            tone: band.down > 0 ? 'danger' : 'default',
          },
          {
            label: 'Degraded now',
            value: String(band.degraded),
            hint: 'services that work badly',
            tone: band.degraded > 0 ? 'warning' : 'default',
          },
          {
            label: 'Residents affected',
            value: String(band.residentsAffected),
            hint: 'the occupied beds the server reports on the floors with a problem',
            tone: band.residentsAffected > 0 ? 'danger' : 'success',
          },
        ]}
      >
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'down'
                ? 'danger'
                : tab.key === 'degraded'
                  ? 'warning'
                  : tab.key === 'operational'
                    ? 'success'
                    : 'brand',
          }))}
          active={statusFilter}
          onChange={(key) => statusState.setValue(key)}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <ResourceSelect
            endpoint="floors"
            value={floorFilter}
            onChange={(value) => floorState.setValue(value)}
            placeholder="All floors"
            valueKey="_id"
            labelKey={floorLabel}
            dataPath="data"
            className="w-52"
          />
          <Select
            aria-label="Filter by service"
            size="compact"
            options={[
              { value: '', label: 'All services' },
              ...definitions.map((def) => ({
                value: def.key,
                label: def.label || def.key.replace(/_/g, ' '),
              })),
            ]}
            value={serviceTypeFilter}
            onChange={(event) => serviceTypeState.setValue(event.target.value)}
            className="w-48"
          />
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearFilters} />
        </div>
      </PageBand>

      {isLoading ? (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-8 text-center text-xs font-semibold text-(--color-text-muted)">
          Reading the service rows of the building...
        </div>
      ) : visibleBoard.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={<Wrench className="h-10 w-10" />}
            title="No service in this view"
            description="The server holds no service for the filters above."
            action={{ label: 'Clear the filters', onClick: clearFilters }}
          />
        ) : band.floors === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No floor yet"
            description="A service belongs to a floor, so there is nothing to track until the building has one."
            action={{ label: 'Add a floor', onClick: () => router.push('/floors/new') }}
          />
        ) : (
          <EmptyState
            icon={<Wrench className="h-10 w-10" />}
            title="No service is tracked yet"
            description="The floors of the building carry no service row. Provision the first service, or seed the rows every floor is missing."
            action={{ label: 'Provision a service', onClick: () => router.push('/services/new') }}
          />
        )
      ) : (
        <div className="space-y-3">
          {visibleBoard.map((entry) => {
            const floor = entry.floor;
            const floorProblem = floor.stats.services.down + floor.stats.services.degraded > 0;
            const isTargetFloor = target?.floor._id === floor._id;
            return (
              <section
                key={floor._id}
                className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg)"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-color) px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-(--color-brand-600)" />
                    <Link
                      href={`/floors/${floor._id}`}
                      className="font-display truncate text-sm font-bold text-(--color-text-primary) hover:underline"
                    >
                      {floor.label}
                    </Link>
                    {floorProblem ? (
                      <StatusBadge
                        variant={floor.stats.services.down > 0 ? 'danger' : 'warning'}
                        label={floor.stats.services.down > 0 ? 'Service down' : 'Degraded'}
                      />
                    ) : (
                      <StatusBadge variant="success" label="All working" />
                    )}
                  </div>
                  <div className="text-2xs flex flex-wrap items-center gap-3 font-semibold text-(--color-text-muted)">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {floor.stats.occupiedBeds} resident
                      {floor.stats.occupiedBeds === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen className="h-3.5 w-3.5" />
                      {floor.stats.activeRooms} room
                      {floor.stats.activeRooms === 1 ? '' : 's'}
                    </span>
                    <Link
                      href={`/rooms?floorId=${floor._id}`}
                      className="font-semibold text-(--color-brand-600) hover:underline"
                    >
                      the rooms of this floor
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {entry.cells.map((cell) => {
                    const Icon = cell.icon;
                    const status = cell.row?.status ?? null;
                    const isTarget = isTargetFloor && target?.cell.serviceType === cell.serviceType;
                    return (
                      <button
                        key={cell.serviceType}
                        type="button"
                        onClick={() => openAction(cell, floor)}
                        className={`flex items-start gap-2.5 rounded-(--radius-md) border p-3 text-left transition-colors ${cellTone(status, isTarget)}`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-(--color-text-secondary)" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-(--color-text-primary)">
                            {cell.label}
                          </span>
                          <span className="text-2xs mt-0.5 block font-semibold text-(--color-text-secondary)">
                            {cellState(status)}
                          </span>
                          {cell.row?.note ? (
                            <span className="text-2xs mt-1 block truncate font-medium text-(--color-text-muted)">
                              {cell.row.note}
                            </span>
                          ) : null}
                          {cell.row?.openComplaintCount ? (
                            <span className="text-2xs mt-1 inline-flex items-center gap-1 font-bold text-(--color-danger-700)">
                              <TriangleAlert className="h-3 w-3" />
                              {cell.row.openComplaintCount} open complaint
                              {cell.row.openComplaintCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isTargetFloor && target && (
                  <div className="border-t border-(--border-color) px-4 py-3">
                    {target.cell.row ? (
                      <>
                        <p className="text-xs font-bold text-(--color-text-primary)">
                          Set the status of {target.cell.label} on {floor.label}
                        </p>
                        <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                          The server writes the status, stamps the record with your name and the
                          time and writes an update entry in the audit log. When the status actually
                          moves it pushes a service update to the active residents of {floor.label}.
                          A note on its own does not reach them, and a failed push never undoes the
                          write.
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Select
                            label="State"
                            size="compact"
                            options={[
                              { value: 'operational', label: 'Operational - it works' },
                              { value: 'degraded', label: 'Degraded - it works badly' },
                              { value: 'down', label: 'Down - it does not work' },
                            ]}
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
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Button
                            size="sm"
                            onClick={() => void submitStatus()}
                            disabled={saving}
                            loading={saving}
                          >
                            Save the status
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setTarget(null)}>
                            Close
                          </Button>
                          <Link
                            href={`/services/${target.cell.row._id}`}
                            className="text-2xs font-semibold text-(--color-brand-600) hover:underline"
                          >
                            Open the full record
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-(--color-text-primary)">
                          The server holds no row for {target.cell.label} on {floor.label}
                        </p>
                        <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                          A service that is not tracked has no state and nobody to tell. The server
                          refuses a second row for the same floor and the same service, so the row
                          has to be created first.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/services/new?floorId=${floor._id}&serviceType=${target.cell.serviceType}`,
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Provision {target.cell.label} on {floor.label}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setTarget(null)}>
                            Close
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {floorsWithoutService.length > 0 && (
        <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3">
          <p className="text-xs font-bold text-(--color-warning-800)">
            {floorsWithoutService.length} floor
            {floorsWithoutService.length === 1 ? '' : 's'} carry no service row at all
          </p>
          <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
            A floor with no row has no state to show and no residents to tell. The seed on this page
            creates the rows that are missing, floor by floor.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {floorsWithoutService.map((floor) => (
              <li key={floor._id}>
                <Link
                  href={`/services/new?floorId=${floor._id}`}
                  className="text-2xs inline-flex items-center gap-1.5 rounded-(--radius-full) border border-(--color-warning-300) bg-(--color-card-bg) px-2.5 py-1 font-semibold text-(--color-warning-800) hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Provision {floor.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What the tiles and the numbers mean. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />A service belongs to a floor, not to a room: one
          tile is one service type on one floor, and the residents it reaches are the residents of
          that floor. The floor, the service and the state live in the address bar, so this view is
          a link.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The band</strong> is the standing
          picture of the building: the server&apos;s own count of every service row of the floors in
          view, whatever the filters below say. The tiles are the set in the address bar, and the
          count on every tab is the number of service rows the server holds in that state for these
          filters. The tiles also show the services the server holds no row for.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Residents affected</strong> counts the
          beds the server reports as taken on the floors that carry a degraded or down service. The
          server itself tells the active residents of a floor, which is a different count, and the
          write result names what it did.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The service filter</strong> narrows the
          tiles on the screen: the server cannot filter on a service type, so the whole set is read
          in one pass and the filter is applied here. The set is walked over the pages the API
          clamps, so the board holds every row of every floor
          {serviceSet && serviceSet.pages > 1
            ? ` (${serviceSet.total} rows over ${serviceSet.pages} pages)`
            : ''}
          .
        </p>
      </div>
    </div>
  );
}
