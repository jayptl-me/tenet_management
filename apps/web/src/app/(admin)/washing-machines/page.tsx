'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Download,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  TriangleAlert,
  User,
  WashingMachine,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { surfaceCardClass } from '@/lib/field-styles';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { ShimmerBlock } from '@/components/ui/Skeleton';
import { floorLabel } from '@/lib/resource-select-presets';

// -- Shapes -------------------------------------------------------------
// Every field below is read out of the API response, never invented:
//   GET /washing-machines        apps/api/src/routes/washingMachines.ts:91-148
//   GET /washing-machines/:id    apps/api/src/routes/washingMachines.ts:199-216
//   POST /washing-machines/:id/release   apps/api/src/routes/washingMachines.ts:437-489
//   PUT  /washing-machines/:id   apps/api/src/routes/washingMachines.ts:273-327
//   DELETE /washing-machines/:id apps/api/src/routes/washingMachines.ts:492-522

interface MachineRow {
  _id: string;
  machineNumber: number;
  label: string;
  status: string;
  floorId?: string;
  floorLabel?: string;
  floorNumber?: number;
  currentUserId?: string | null;
  currentUser?: { id?: string; name?: string; room?: string } | null;
  claimedAt?: string | null;
  timerDuration?: number;
  timerEndsAt?: string | null;
  lastUsedAt?: string | null;
  notes?: string;
  createdAt?: string;
}

interface MachinesListBody {
  success: boolean;
  data: MachineRow[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

/** One floor of the building, for the name of the floor filter. */
interface FloorRow {
  _id: string;
  label?: string;
  floorNumber?: number;
}

// -- Vocabulary ---------------------------------------------------------

/**
 * The four states of a machine, in the words of the office.
 *
 * The status literal of the model is the truth (apps/api/src/models/washingMachine.ts:37-41);
 * the label is what the office reads.
 */
const STATUS_LABELS: Record<string, string> = {
  available: 'Free to claim',
  in_use: 'Running',
  under_maintenance: 'In maintenance',
  down: 'Down',
};

/** What each state means, in one line, for the legend under the board. */
const STATUS_MEANING: Record<string, string> = {
  available: 'a resident of the floor can claim it right away',
  in_use: 'a resident holds it until the timer on the claim runs out',
  under_maintenance: 'it is being fixed and cannot be claimed',
  down: 'it is broken and cannot be claimed',
};

const STATUS_TABS = [
  { key: '', label: 'All machines' },
  { key: 'available', label: 'Free to claim' },
  { key: 'in_use', label: 'Running' },
  { key: 'under_maintenance', label: 'In maintenance' },
  { key: 'down', label: 'Down' },
];

/** The values the state filter may take in the address bar. */
const STATUS_FILTERS = ['available', 'in_use', 'under_maintenance', 'down'] as const;

/** The count keys the band reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

/**
 * The page size the board draws.
 *
 * The API serves at most 100 machines in one page, and a washing machine is a
 * physical unit, so the board draws the whole set the server reports. When the
 * set is larger the board says so and names the floor filter as the way to
 * narrow it.
 */
const BOARD_PAGE_SIZE = 100;

const WASHING_MACHINES_KEY = ['washing-machines', 'list'] as const;
const WASHING_MACHINES_COUNT_KEY = ['washing-machines', 'count'] as const;
const FLOORS_KEY = ['floors', 'list'] as const;

/** A stable empty fallback: `?? []` would allocate a new array on every render. */
const EMPTY_MACHINES: MachineRow[] = [];

// -- Helpers ------------------------------------------------------------

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/** The name of the machine as the office reads it. */
function machineName(machine: MachineRow): string {
  return machine.label || `Machine ${machine.machineNumber}`;
}

/** The floor of a machine as the office reads it. */
function floorName(machine: MachineRow): string {
  if (machine.floorLabel) return machine.floorLabel;
  if (machine.floorNumber != null) return `Floor ${machine.floorNumber}`;
  return 'No floor';
}

/**
 * The timer of a claim.
 *
 * The timer is the window the machine is held for. The resident chooses it
 * per claim between 10 and 180 minutes, so the page reads the timer the server
 * holds and never guesses one.
 */
function timerState(machine: MachineRow): { label: string; overdue: boolean } {
  if (machine.status !== 'in_use') return { label: 'No timer on this machine', overdue: false };
  if (!machine.timerEndsAt) return { label: 'The claim carries no timer', overdue: true };
  const endsAt = new Date(machine.timerEndsAt).getTime();
  if (Number.isNaN(endsAt)) return { label: 'The claim carries no timer', overdue: true };
  const minutes = Math.round((endsAt - Date.now()) / 60000);
  const clock = new Date(machine.timerEndsAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (minutes <= 0) return { label: `The timer ran out (was due at ${clock})`, overdue: true };
  return { label: `Held until ${clock} (${minutes} min left)`, overdue: false };
}

/**
 * The minutes of laundry still running, summed from the timers of the held
 * machines in the board.
 *
 * This is the number only this module can compute: the server holds the timer
 * of every held machine and nothing else sums them. It is not money and it is
 * not a server aggregate, so the scope is named where the number is shown.
 */
function runningMinutes(machines: MachineRow[]): number {
  const now = Date.now();
  let total = 0;
  for (const machine of machines) {
    if (machine.status !== 'in_use') continue;
    if (!machine.timerEndsAt) continue;
    const endsAt = new Date(machine.timerEndsAt).getTime();
    if (Number.isNaN(endsAt)) continue;
    total += Math.max(0, Math.round((endsAt - now) / 60000));
  }
  return total;
}

/** The state mix of one floor, in the words of the office. */
function floorSummary(machines: MachineRow[]): string {
  const count = (status: string) => machines.filter((m) => m.status === status).length;
  const parts: string[] = [];
  const free = count('available');
  const running = count('in_use');
  const maintenance = count('under_maintenance');
  const down = count('down');
  if (free > 0) parts.push(`${free} free to claim`);
  if (running > 0) parts.push(`${running} running`);
  if (maintenance > 0) parts.push(`${maintenance} in maintenance`);
  if (down > 0) parts.push(`${down} down`);
  return parts.length > 0 ? parts.join(' | ') : 'No machine on this floor';
}

/** The write the office is about to make, and the machine it is about. */
type PendingWrite =
  | { kind: 'release'; machine: MachineRow }
  | { kind: 'down'; machine: MachineRow }
  | { kind: 'available'; machine: MachineRow }
  | { kind: 'delete'; machine: MachineRow };

/**
 * The board while the server answers.
 *
 * The shape of a machine tile, empty, so the page does not flash an empty
 * building before the first row arrives.
 */
function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3"
        >
          <ShimmerBlock className="h-4 w-2/3" />
          <ShimmerBlock className="mt-3 h-3 w-1/2" />
          <ShimmerBlock className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

// -- The board ----------------------------------------------------------

function WashingMachinesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a floor's machines can be linked,
  // cited and reviewed, and a link that carries a query parameter lands on
  // the machines it names.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const floorState = useUrlState<string>('floorId', { defaultValue: '' });
  const { write: writeUrl } = useUrlStateWriter();

  const statusFilter = statusState.value;
  const floorFilter = floorState.value;

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [writing, setWriting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * The parameters of the filtered set.
   *
   * The floor filter narrows the set for every read of it. The state filter
   * does NOT belong to this set: a state tab has to answer how many machines
   * it would show, and that number is the count of the set without the state
   * filter.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (floorFilter) params.set('floorId', floorFilter);
    return params;
  }, [floorFilter]);

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', '1');
  listParams.set('limit', String(BOARD_PAGE_SIZE));
  if (statusFilter) listParams.set('status', statusFilter);

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<MachinesListBody>(
    [...WASHING_MACHINES_KEY, statusFilter, floorFilter],
    `washing-machines?${listParams.toString()}`,
  );

  const machines = listBody?.data ?? EMPTY_MACHINES;
  const total = listBody?.meta?.total ?? 0;

  /**
   * The counts behind the state tabs.
   *
   * They are read from the server for the SAME filtered set the board draws,
   * so a tab count is exactly the number of machines that tab would show.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<MachinesListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('status', key);
      return {
        queryKey: [...WASHING_MACHINES_COUNT_KEY, floorFilter, key],
        queryFn: () => queryJson<MachinesListBody>(`washing-machines?${params.toString()}`),
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
   * The board: the machines of the set, grouped by the floor they stand on.
   *
   * A washing machine is a physical unit on a floor, so the floor is the way
   * the office reads the building. The server sorts by machine number, and
   * the board keeps that order inside every floor.
   */
  const board = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; name: string; floorId?: string; machines: MachineRow[] }
    >();
    for (const machine of machines) {
      const key = machine.floorId ?? 'no-floor';
      const group = groups.get(key) ?? {
        key,
        name: floorName(machine),
        floorId: machine.floorId,
        machines: [],
      };
      group.machines.push(machine);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [machines]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: WASHING_MACHINES_KEY });
    queryClient.invalidateQueries({ queryKey: WASHING_MACHINES_COUNT_KEY });
  }, [queryClient]);

  /**
   * The write the office asked for.
   *
   * Every write here reports the state the SERVER committed, read out of the
   * answer of the route, and then re-reads the list. The page never shows a
   * state it decided on its own.
   */
  const runWrite = async () => {
    if (!pending) return;
    setWriting(true);
    setError('');
    try {
      if (pending.kind === 'release') {
        const res = await api
          .post(`washing-machines/${pending.machine._id}/release`)
          .json<{ success: boolean; data: MachineRow }>();
        const holder = pending.machine.currentUser?.name;
        setWriteResult(
          `${machineName(pending.machine)} reads ${statusLabel(res.data.status)} now, the server says. ` +
            (holder
              ? `The claim of ${holder} was cleared. The resident was not told: they see the machine free the next time they open the app.`
              : 'The claim on it was cleared. The resident was not told: they see the machine free the next time they open the app.'),
        );
      } else if (pending.kind === 'delete') {
        await api.delete(`washing-machines/${pending.machine._id}`).json();
        setWriteResult(
          `${machineName(pending.machine)} is gone, the server says. The record and the audit entry stay. The residents of the floor were not told: they see the machine missing in their own list.`,
        );
      } else {
        const res = await api
          .put(`washing-machines/${pending.machine._id}`, { json: { status: pending.kind } })
          .json<{ success: boolean; data: MachineRow }>();
        const holder = pending.machine.currentUser?.name;
        setWriteResult(
          `${machineName(pending.machine)} reads ${statusLabel(res.data.status)} now, the server says. ` +
            (holder
              ? `The claim of ${holder} was cleared. The residents of the floor were not told: they read the machine list themselves.`
              : 'No claim was on it. The residents of the floor were not told: they read the machine list themselves.'),
        );
      }
      setPending(null);
      refresh();
    } catch (err) {
      setError((await parseApiError(err)).message);
      setPending(null);
      refresh();
    } finally {
      setWriting(false);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 machines, so the export walks the pages of
   * the filtered set instead of asking for one big page that silently arrives
   * truncated. The filters of the view travel with it, and the operator is told
   * how many machines the server reports and how many the file carries.
   */
  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const rows: MachineRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(filterParams.toString());
        if (statusFilter) params.set('status', statusFilter);
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`washing-machines?${params.toString()}`).json<MachinesListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no machine for these filters.');
        return;
      }

      const headers = [
        'Machine Number',
        'Label',
        'Floor',
        'State',
        'Claimed By',
        'Claimant Room',
        'Timer Ends At',
        'Last Used At',
        'Notes',
      ];
      const escapeCsv = (value: unknown) => {
        let str = String(value ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((machine) => [
        escapeCsv(machine.machineNumber),
        escapeCsv(machineName(machine)),
        escapeCsv(floorName(machine)),
        escapeCsv(machine.status),
        escapeCsv(machine.currentUser?.name ?? ''),
        escapeCsv(machine.currentUser?.room ?? ''),
        escapeCsv(machine.timerEndsAt ?? ''),
        escapeCsv(machine.lastUsedAt ?? ''),
        escapeCsv(machine.notes ?? ''),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((row) => row.join(','))].join(
        '\r\n',
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `washing_machines_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of the ${reportedTotal} machines the server reports: the file stops at the last page the server returns.`
          : `Export written with all ${rows.length} machines the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ status: null, floorId: null });
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'State',
            value: statusLabel(statusFilter),
            onRemove: () => statusState.reset(),
          },
        ]
      : []),
    ...(floorFilter
      ? [
          {
            key: 'floor',
            label: 'Floor',
            value: floorLabelText,
            onRemove: () => floorState.reset(),
          },
        ]
      : []),
  ];

  const freeCount = counts['available'] ?? null;
  const runningCount = counts['in_use'] ?? null;
  const outOfPoolCount =
    counts['under_maintenance'] === null || counts['down'] === null
      ? null
      : (counts['under_maintenance'] ?? 0) + (counts['down'] ?? 0);
  const loadMinutes = runningMinutes(machines);
  const boardIsWhole = total <= machines.length;

  const confirmCopy = (() => {
    if (!pending) return null;
    const machine = pending.machine;
    const holder = machine.currentUser?.name;
    if (pending.kind === 'release') {
      return {
        title: 'Release the machine',
        message:
          'The server sets the machine back to free to claim and clears the claim, so a resident of the floor can take it right away. It writes an update entry in the audit log. ' +
          (holder
            ? `The resident who held it (${holder}) is not told: they see the machine free the next time they open the app.`
            : 'The resident who held it is not told: they see the machine free the next time they open the app.'),
        confirmLabel: 'Release it',
        variant: 'warning' as const,
      };
    }
    if (pending.kind === 'down') {
      return {
        title: 'Report the machine as down',
        message:
          'The server writes the state down and clears the claim on the machine, so nobody can claim it until it is brought back. It writes an update entry in the audit log. ' +
          (holder
            ? `The resident holding it (${holder}) loses the machine right away and is not told: they meet the refusal when they try to claim it.`
            : 'The residents of the floor are not told: they meet the refusal when they try to claim it.'),
        confirmLabel: 'Report it down',
        variant: 'danger' as const,
      };
    }
    if (pending.kind === 'available') {
      return {
        title: 'Bring the machine back into the pool',
        message:
          'The server writes the state free to claim and clears any claim on the machine, so a resident of the floor can claim it right away. It writes an update entry in the audit log. The residents of the floor are not told: they read the machine list themselves.',
        confirmLabel: 'Bring it back',
        variant: 'warning' as const,
      };
    }
    return {
      title: 'Delete the machine',
      message:
        'The server deletes the machine record and writes a delete entry in the audit log. It refuses while the machine is running, so release the claim first. The residents of the floor are not told: they see the machine missing in their own list.',
      confirmLabel: 'Delete it',
      variant: 'danger' as const,
    };
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Washing machines"
        description="Which machines are free, who is using them and which are broken, floor by floor"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting || machines.length === 0}
              loading={exporting}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/washing-machines/new')}>
              <Plus className="h-4 w-4" />
              Add Machine
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

      {/* The compact band: the numbers, the state tabs and the floor filter in
          one surface, so the first machine is reachable without scrolling past
          half a screen of chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Machines in view',
            value: String(total),
            hint: 'the server reports these for the filters',
            tone: 'brand',
          },
          {
            label: 'Free to claim',
            value: freeCount === null ? '-' : String(freeCount),
            hint: 'a resident can take one now',
            tone: freeCount === 0 ? 'warning' : 'success',
          },
          {
            label: 'Running now',
            value: runningCount === null ? '-' : String(runningCount),
            hint: 'held with a timer',
            tone: 'default',
          },
          {
            label: 'Load running',
            value: `${loadMinutes} min`,
            hint: boardIsWhole
              ? 'left on the timers of the machines in this board'
              : 'left on the timers of the first 100 machines',
            tone: 'default',
          },
          {
            label: 'Out of the pool',
            value: outOfPoolCount === null ? '-' : String(outOfPoolCount),
            hint: 'in maintenance or down',
            tone: outOfPoolCount === 0 ? 'default' : 'danger',
          },
        ]}
      >
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'available'
                ? 'success'
                : tab.key === 'down'
                  ? 'danger'
                  : tab.key === 'under_maintenance'
                    ? 'warning'
                    : tab.key === ''
                      ? 'brand'
                      : 'default',
          }))}
          active={statusFilter}
          onChange={(key) => statusState.setValue(key)}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <ResourceSelect
            endpoint="floors"
            value={floorFilter}
            onChange={(val) => floorState.setValue(val)}
            placeholder="All Floors"
            valueKey="_id"
            labelKey={floorLabel}
            dataPath="data"
            className="w-52"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {!boardIsWhole && (
        <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-secondary)">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
          The board draws the first {machines.length} of the {total} machines the server reports for
          these filters: the server serves at most 100 machines in one page. Narrow the set with the
          floor filter to see it whole.
        </p>
      )}

      {isLoading ? (
        <BoardSkeleton />
      ) : machines.length === 0 ? (
        statusFilter || floorFilter ? (
          <EmptyState
            icon={<WashingMachine className="h-10 w-10" />}
            title="No machine in this view"
            description="The server reports no machine for the filters above. Clear them to see the whole building."
            action={{ label: 'Clear the filters', onClick: clearAllFilters }}
          />
        ) : (
          <EmptyState
            icon={<WashingMachine className="h-10 w-10" />}
            title="No washing machine is registered yet"
            description="Register the first one: the server writes it on a floor with its own timer length, and from that moment the residents of that floor can claim it from their own machine list. The residents are not told: they read the list themselves."
            action={{
              label: 'Register a machine',
              onClick: () => router.push('/washing-machines/new'),
            }}
          />
        )
      ) : (
        <div className="space-y-4">
          {board.map((group) => (
            <section key={group.key} className={clsx(surfaceCardClass, 'overflow-hidden')}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border-color) bg-(--color-field-bg) px-4 py-3">
                <h2 className="font-display flex items-center gap-2 text-sm font-bold tracking-tight text-(--color-text-primary)">
                  <Building2 className="h-4 w-4 text-(--color-text-muted)" />
                  {group.floorId ? (
                    <Link
                      href={`/floors/${group.floorId}`}
                      className="text-(--color-brand-600) hover:underline"
                    >
                      {group.name}
                    </Link>
                  ) : (
                    group.name
                  )}
                </h2>
                <p className="text-2xs font-semibold text-(--color-text-secondary)">
                  {floorSummary(group.machines)}
                </p>
              </header>

              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.machines.map((machine) => {
                  const timer = timerState(machine);
                  const holderId = machine.currentUser?.id ?? machine.currentUserId ?? null;
                  return (
                    <article
                      key={machine._id}
                      className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3"
                    >
                      <header className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/washing-machines/${machine._id}`}
                            className="font-display block truncate text-sm font-bold text-(--color-brand-600) hover:underline"
                          >
                            {machineName(machine)}
                          </Link>
                          <p className="text-2xs font-medium text-(--color-text-muted)">
                            Machine #{machine.machineNumber}
                          </p>
                        </div>
                        <StatusBadge
                          variant={statusToVariant(machine.status)}
                          label={statusLabel(machine.status)}
                          size="xs"
                        />
                      </header>

                      <div className="space-y-1">
                        <p className="text-xs text-(--color-text-secondary)">
                          <User className="mr-1 inline h-3 w-3 text-(--color-text-muted)" />
                          {machine.currentUser ? (
                            <>
                              {holderId ? (
                                <Link
                                  href={`/tenants/${holderId}`}
                                  className="font-semibold text-(--color-brand-600) hover:underline"
                                >
                                  {machine.currentUser.name ?? 'The resident'}
                                </Link>
                              ) : (
                                <span className="font-semibold text-(--color-text-primary)">
                                  {machine.currentUser.name ?? 'A resident'}
                                </span>
                              )}
                              {machine.currentUser.room ? `, room ${machine.currentUser.room}` : ''}
                            </>
                          ) : (
                            <span className="text-(--color-text-muted)">Nobody holds it</span>
                          )}
                        </p>
                        <p
                          className={clsx(
                            'text-xs font-medium',
                            timer.overdue
                              ? 'text-(--color-warning-700)'
                              : 'text-(--color-text-secondary)',
                          )}
                        >
                          <Timer className="mr-1 inline h-3 w-3 text-(--color-text-muted)" />
                          {timer.label}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-(--border-color) pt-2">
                        {machine.status === 'in_use' && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setPending({ kind: 'release', machine })}
                            title="Release the claim and put the machine back in the pool"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Release
                          </Button>
                        )}
                        {machine.status !== 'down' && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setPending({ kind: 'down', machine })}
                            title="Report the machine as broken and take it out of the pool"
                          >
                            <TriangleAlert className="h-3 w-3" />
                            Report down
                          </Button>
                        )}
                        {(machine.status === 'under_maintenance' || machine.status === 'down') && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setPending({ kind: 'available', machine })}
                            title="Bring the machine back into the pool a resident can claim from"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Bring back
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => router.push(`/washing-machines/${machine._id}/edit`)}
                          title="Edit the machine"
                          aria-label="Edit the machine"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setPending({ kind: 'delete', machine })}
                          title="Delete the machine"
                          aria-label="Delete the machine"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* What the states and the numbers mean. A state the office cannot read
          is a state the office cannot act on. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          The board is the building, floor by floor. The filters live in the address bar, so this
          view is a link: the floor and the state can be shared, cited and reviewed.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The four states.</strong>{' '}
          {STATUS_FILTERS.map(
            (status) => `${statusLabel(status)} (${status}): ${STATUS_MEANING[status]}`,
          ).join('. ')}
          .
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Who acts here.</strong> A resident
          claims a machine: the server refuses a claim from anyone but a tenant, so the office never
          writes the state running. The office releases a claim, reports a machine down and brings
          it back. Nobody is messaged by any of those writes: the residents read the machine list
          themselves, right before they claim.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The counts.</strong> Every count in the
          band except &quot;Machines in view&quot; is the count of the floor set, without the state
          filter, because a state tab has to answer how many machines it would show. &quot;Machines
          in view&quot; is the set the board draws.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Load running</strong> is the sum of the
          timers of the machines in the board. It is the only number here the client adds up, and it
          covers the machines on the board, not the whole building.
        </p>
      </div>

      <ConfirmModal
        open={pending !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.confirmLabel ?? 'Confirm'}
        variant={confirmCopy?.variant ?? 'warning'}
        loading={writing}
        onConfirm={() => void runWrite()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

export default function WashingMachinesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <WashingMachinesContent />
    </Suspense>
  );
}
