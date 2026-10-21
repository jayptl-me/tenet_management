'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  DoorOpen,
  Download,
  Search,
  Info,
  TriangleAlert,
  LogIn,
  LogOut,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions, type TableAction } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { tenantLabel } from '@/lib/resource-select-presets';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /visitors          apps/api/src/routes/visitors.ts:191-233
//   POST /visitors/:id/*   apps/api/src/routes/visitors.ts:305-586
//   DELETE /visitors/:id   apps/api/src/routes/visitors.ts:624-641

/** The resident who registered the visit, with the place they sleep. */
interface VisitorHost {
  _id?: string;
  bedId?: string;
  user?: { name?: string; phone?: string };
  room?: {
    _id?: string;
    roomNumber?: string;
    floor?: { label?: string; floorNumber?: number };
  };
}

interface VisitorRow {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: VisitorHost;
  expectedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: string;
  createdAt: string;
}

interface VisitorsListBody {
  success: boolean;
  data: VisitorRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** The answer of a gate write: the record the server returns after the write. */
interface GateWriteResult {
  success: boolean;
  data?: {
    _id?: string;
    status?: string;
    actualArrival?: string;
    actualDeparture?: string;
    expectedArrival?: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rem = minutes % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}

/**
 * When the pass is expected, in the words of the gate desk.
 *
 * The hour is the server's (expectedArrival); the words are the office's.
 * A pass whose hour has passed is overdue: nobody stamped the arrival and
 * the gate sheet and the day disagree.
 */
function expectedWindow(value?: string): { label: string; overdue: boolean } {
  if (!value) return { label: 'No hour set', overdue: false };
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return { label: 'No hour set', overdue: false };
  const now = new Date();
  if (target.getTime() < now.getTime()) {
    return {
      label: `Overdue by ${formatDuration(now.getTime() - target.getTime())}`,
      overdue: true,
    };
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', overdue: false };
  if (diffDays === 1) return { label: 'Tomorrow', overdue: false };
  return { label: `In ${diffDays} days`, overdue: false };
}

/**
 * What the gate knows about this pass right now.
 *
 * The state is the server's; the line under it says what the state means for
 * the desk, so the row answers "is this person inside or not" without a guess.
 */
function gateState(row: VisitorRow): {
  label: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral' | 'danger';
} {
  if (row.status === 'arrived') {
    return {
      label: 'On site',
      detail: `in since ${formatDateTime(row.actualArrival)}`,
      tone: 'success',
    };
  }
  if (row.status === 'departed') {
    return {
      label: 'Left',
      detail: `out at ${formatDateTime(row.actualDeparture)}`,
      tone: 'neutral',
    };
  }
  if (row.status === 'cancelled') {
    return {
      label: 'Cancelled',
      detail: 'the visit will not happen',
      tone: 'danger',
    };
  }
  const expected = expectedWindow(row.expectedArrival);
  return {
    label: expected.overdue ? 'Overdue' : 'Not stamped',
    detail: `expected ${formatDateTime(row.expectedArrival)}`,
    tone: expected.overdue ? 'warning' : 'neutral',
  };
}

// ── Filter vocabulary ──────────────────────────────────────────────────

/** The statuses the model allows (apps/api/src/models/visitor.ts:56). */
const VISITOR_STATUSES = ['expected', 'arrived', 'departed', 'cancelled'] as const;

/**
 * The tabs of the gate desk, in the order the desk works them.
 *
 * The key is the value the address bar carries, so /visitors?status=arrived
 * lands on the on-site list.
 */
const STATUS_TABS = [
  { key: '', label: 'All passes' },
  { key: 'arrived', label: 'On site' },
  { key: 'expected', label: 'Expected' },
  { key: 'departed', label: 'Departed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

/** The count keys the tab strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...VISITOR_STATUSES] as const;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

const VISITORS_KEY = ['visitors', 'list'] as const;
const VISITORS_COUNT_KEY = ['visitors', 'count'] as const;

/** A stable empty list, so the memos that read it do not churn. */
const EMPTY_VISITORS: VisitorRow[] = [];

export default function VisitorsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <VisitorsContent />
    </Suspense>
  );
}

function VisitorsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: the gate sheet can be linked,
  // bookmarked and cited, and a link that names a status lands filtered.
  const statusState = useUrlState<string>('status', {
    defaultValue: '',
    allowed: VISITOR_STATUSES,
  });
  const tenantState = useUrlState<string>('tenantId', { defaultValue: '' });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const statusFilter = statusState.value;
  const tenantFilter = tenantState.value;
  const search = searchState.value.trim();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [busyVisitor, setBusyVisitor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VisitorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * The query parameters of the filtered set, without the status.
   *
   * Every read of the visitor list sends the same set: the table, the counts
   * behind the tabs and the CSV export. A number that answers a different
   * question than the rows would be a number nobody can trust.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tenantFilter) params.set('tenantId', tenantFilter);
    return params;
  }, [search, tenantFilter]);

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));
  if (statusFilter) listParams.set('status', statusFilter);

  const {
    data,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<VisitorsListBody>(
    [...VISITORS_KEY, page, perPage, statusFilter, search, tenantFilter],
    `visitors?${listParams.toString()}`,
  );

  const visitors = data?.data ?? EMPTY_VISITORS;
  const total = data?.meta.total ?? 0;

  /**
   * The counts behind the tabs.
   *
   * They are read from the server for the SAME filtered set the table shows
   * (the search and the resident filter, without the status), so a tab count
   * is exactly the number of rows the operator gets after clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<VisitorsListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('status', key);
      return {
        queryKey: [...VISITORS_COUNT_KEY, search, tenantFilter, key],
        queryFn: () => queryJson<VisitorsListBody>(`visitors?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta?.total ?? null;
  });

  const refreshVisitors = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: VISITORS_KEY });
    queryClient.invalidateQueries({ queryKey: VISITORS_COUNT_KEY });
  }, [queryClient]);

  /**
   * A gate stamp, made from the row the operator is looking at.
   *
   * The server owns the state machine: an arrival is refused on a pass that
   * is not expected, a departure on a pass that did not arrive, a
   * cancellation on a pass that already arrived, and a re-approval on a pass
   * that is not cancelled. The message after the write says what the server
   * committed and what the resident was told.
   */
  const handleGateAction = async (
    visitor: VisitorRow,
    action: 'arrive' | 'depart' | 'cancel' | 'approve',
  ) => {
    setBusyVisitor(visitor._id);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .post(`visitors/${visitor._id}/${action}`, { json: {} })
        .json<GateWriteResult>();
      const server = res.data ?? {};
      if (action === 'arrive') {
        setWriteResult(
          `${visitor.name} is on site. The server stamped the arrival at ${formatDateTime(server.actualArrival ?? visitor.actualArrival)} with its own clock, wrote an update entry in the audit log and told the resident who registered the pass. The visitor stays on site until the gate stamps the departure.`,
        );
      } else if (action === 'depart') {
        setWriteResult(
          `${visitor.name} has left. The server stamped the departure at ${formatDateTime(server.actualDeparture ?? visitor.actualDeparture)} with its own clock, wrote an update entry in the audit log and told the resident who registered the pass.`,
        );
      } else if (action === 'cancel') {
        setWriteResult(
          `The visit of ${visitor.name} will not happen. The server set the pass to cancelled and wrote an update entry in the audit log. It sends no message: the resident still expects the visitor, and only the gate tells them.`,
        );
      } else {
        setWriteResult(
          `${visitor.name} is expected again. The server put the pass back to expected, recorded who re-approved it, wrote a visitor_approve entry in the audit log and told the resident who registered the pass.`,
        );
      }
      refreshVisitors();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setBusyVisitor('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`visitors/${deleteTarget._id}`).json();
      setWriteResult(
        `The pass of ${deleteTarget.name} is gone. The server deleted the record and wrote a delete entry in the audit log. It sends no message: the resident still expects the visitor.`,
      );
      setDeleteTarget(null);
      refreshVisitors();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 visitors, so the export walks the pages of
   * the filtered set instead of asking for one big page that silently arrives
   * truncated. The filters of the view travel with it, and the operator is
   * told how many passes the server reported and how many the file carries.
   */
  const handleExport = async () => {
    setError('');
    try {
      const rows: VisitorRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(filterParams.toString());
        if (statusFilter) params.set('status', statusFilter);
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`visitors?${params.toString()}`).json<VisitorsListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no visitor for these filters.');
        return;
      }

      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        'Pass',
        'Visitor',
        'Phone',
        'Purpose',
        'Host resident',
        'Room',
        'Bed',
        'Floor',
        'Expected arrival',
        'Checked in',
        'Checked out',
        'Status',
        'Created at',
      ];
      const exportRows = rows.map((visitor) => [
        escapeCsv(visitor._id),
        escapeCsv(visitor.name),
        escapeCsv(visitor.phone),
        escapeCsv(visitor.purpose),
        escapeCsv(visitor.tenant?.user?.name ?? ''),
        escapeCsv(visitor.tenant?.room?.roomNumber ?? ''),
        escapeCsv(visitor.tenant?.bedId ?? ''),
        escapeCsv(visitor.tenant?.room?.floor?.label ?? ''),
        escapeCsv(visitor.expectedArrival ?? ''),
        escapeCsv(visitor.actualArrival ?? ''),
        escapeCsv(visitor.actualDeparture ?? ''),
        escapeCsv(visitor.status),
        escapeCsv(visitor.createdAt),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((row) => row.join(','))].join(
        '\r\n',
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `visitors-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} passes: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${rows.length} passes the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ search: null, tenantId: null, status: null });
    setPage(1);
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'State',
            value: STATUS_TABS.find((tab) => tab.key === statusFilter)?.label ?? statusFilter,
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(tenantFilter
      ? [
          {
            key: 'tenant',
            label: 'Resident',
            value: 'One resident',
            onRemove: () => {
              tenantState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: 'search',
            label: 'Visitor',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const filtersActive = Boolean(search || tenantFilter || statusFilter);

  /**
   * The gate actions of one row: the ones the server allows for that state.
   *
   * The mapping is the route guards of the server (apps/api/src/routes/visitors.ts:314,
   * :398, :478, :556): an expected pass can arrive or be refused, an arrived pass
   * can leave, a cancelled pass can be approved again, and a departed pass is
   * only read.
   */
  const gateActionsOf = (row: VisitorRow): TableAction[] => {
    const busy = busyVisitor === row._id;
    const actions: TableAction[] = [];
    if (row.status === 'expected') {
      actions.push({
        label: 'Mark arrived',
        icon: <LogIn className="h-3.5 w-3.5 text-(--color-success-600)" />,
        onClick: () => void handleGateAction(row, 'arrive'),
        disabled: busy,
      });
      actions.push({
        label: 'Refuse the visit',
        icon: <Ban className="h-3.5 w-3.5 text-(--color-danger-600)" />,
        onClick: () => void handleGateAction(row, 'cancel'),
        disabled: busy,
      });
    }
    if (row.status === 'arrived') {
      actions.push({
        label: 'Mark departed',
        icon: <LogOut className="h-3.5 w-3.5 text-(--color-brand-600)" />,
        onClick: () => void handleGateAction(row, 'depart'),
        disabled: busy,
      });
    }
    if (row.status === 'cancelled') {
      actions.push({
        label: 'Re-approve the visit',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-(--color-success-600)" />,
        onClick: () => void handleGateAction(row, 'approve'),
        disabled: busy,
      });
    }
    return actions;
  };

  const columns: DataTableColumn<VisitorRow>[] = [
    {
      header: 'Visitor',
      accessor: (row) => (
        <div>
          <Link
            href={`/visitors/${row._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.name}
          </Link>
          <div className="text-2xs text-(--color-text-muted)">
            {row.phone} · <span className="capitalize">{row.purpose}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Who they visit',
      accessor: (row) => (
        <div>
          {row.tenant?._id ? (
            <Link
              href={`/tenants/${row.tenant._id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              {row.tenant.user?.name ?? 'View the resident'}
            </Link>
          ) : (
            <span className="text-(--color-text-muted)">No resident</span>
          )}
          <div className="text-2xs text-(--color-text-muted)">
            {row.tenant?.room?._id ? (
              <Link
                href={`/rooms/${row.tenant.room._id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                Room {row.tenant.room.roomNumber ?? '—'}
              </Link>
            ) : (
              <span>No room</span>
            )}
            {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
            {row.tenant?.room?.floor?.label ? ` · ${row.tenant.room.floor.label}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Expected',
      accessor: (row) => {
        const expected = expectedWindow(row.expectedArrival);
        return (
          <div>
            <div className="text-xs font-semibold text-(--color-text-primary)">
              {formatDateTime(row.expectedArrival)}
            </div>
            <div
              className={
                expected.overdue
                  ? 'text-2xs font-semibold text-(--color-warning-700)'
                  : 'text-2xs font-semibold text-(--color-text-muted)'
              }
            >
              {expected.label}
            </div>
          </div>
        );
      },
    },
    {
      header: 'At the gate',
      accessor: (row) => {
        const gate = gateState(row);
        return (
          <div>
            <StatusBadge variant={gate.tone} label={gate.label} size="xs" />
            <div className="text-2xs text-(--color-text-muted)">{gate.detail}</div>
          </div>
        );
      },
    },
    {
      header: 'Status',
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
          onView={() => router.push(`/visitors/${row._id}`)}
          onEdit={() => router.push(`/visitors/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
          extra={gateActionsOf(row)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visitors"
        description="The gate desk: who is expected, who is on site right now, and who has left"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={visitors.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/visitors/new')}>
              <Plus className="h-4 w-4" />
              Register Visitor
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers of the gate, the tabs that narrow them
          and the filters in one surface, so the first data row is reachable
          without scrolling past half a screen of chrome. */}
      <PageBand
        metrics={[
          {
            label: 'On site now',
            value: counts.arrived == null ? '-' : String(counts.arrived),
            hint: 'the server counts them as arrived, over the filters',
            tone: 'success',
          },
          {
            label: 'Expected',
            value: counts.expected == null ? '-' : String(counts.expected),
            hint: 'registered, not stamped at the gate yet',
            tone: 'brand',
          },
          {
            label: 'Passes in view',
            value: String(total),
            hint: 'the server reports these for the filters and the tab',
            tone: 'default',
          },
          {
            label: 'Departed',
            value: counts.departed == null ? '-' : String(counts.departed),
            hint: 'stamped out at the gate',
            tone: 'default',
          },
        ]}
      >
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'arrived'
                ? 'success'
                : tab.key === 'expected'
                  ? 'brand'
                  : tab.key === 'cancelled'
                    ? 'danger'
                    : 'default',
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
              placeholder="Search by visitor name or phone..."
              aria-label="Search visitors"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <ResourceSelect
            endpoint="tenants"
            value={tenantFilter}
            onChange={(val) => {
              tenantState.setValue(val);
              setPage(1);
            }}
            placeholder="All residents"
            valueKey="_id"
            labelKey={tenantLabel}
            dataPath="data"
            className="w-56"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      <DataTable
        columns={columns}
        data={visitors}
        keyExtractor={(row: VisitorRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/visitors/${row._id}`)}
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
          // gate and an empty filter are not the same thing.
          filtersActive ? (
            <EmptyState
              icon={<DoorOpen className="h-10 w-10" />}
              title="No visitor in this view"
              description="The server reports no visitor for the filters and the tab above."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : statusFilter === 'arrived' ? (
            <EmptyState
              icon={<DoorOpen className="h-10 w-10" />}
              title="Nobody is on site"
              description="Every visitor who came has been stamped out. The next step is the expected list: the passes that are waiting for their hour."
              action={{
                label: 'See who is expected',
                onClick: () => {
                  statusState.setValue('expected');
                  setPage(1);
                },
              }}
            />
          ) : statusFilter === 'expected' ? (
            <EmptyState
              icon={<DoorOpen className="h-10 w-10" />}
              title="Nobody is expected"
              description="No pass is waiting for its hour. The next step is the on-site list: the visitors who are inside the building right now."
              action={{
                label: 'See who is on site',
                onClick: () => {
                  statusState.setValue('arrived');
                  setPage(1);
                },
              }}
            />
          ) : (
            <EmptyState
              icon={<DoorOpen className="h-10 w-10" />}
              title="No visitor has been registered yet"
              description="A resident registers a guest from the portal, or the office registers one here. The pass lands as expected, and the gate stamps the arrival and the departure."
              action={{ label: 'Register a visitor', onClick: () => router.push('/visitors/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => {
          const gate = gateState(row);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/visitors/${row._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  {row.name}
                </Link>
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                />
              </div>
              <div className="text-xs text-(--color-text-muted)">
                <span className="capitalize">{row.purpose}</span> · {row.phone}
              </div>
              <div className="text-xs text-(--color-text-muted)">
                {row.tenant?._id ? (
                  <Link
                    href={`/tenants/${row.tenant._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {row.tenant.user?.name ?? 'View the resident'}
                  </Link>
                ) : (
                  'No resident'
                )}
                {row.tenant?.room?._id ? (
                  <>
                    {' · '}
                    <Link
                      href={`/rooms/${row.tenant.room._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-(--color-brand-600) hover:underline"
                    >
                      Room {row.tenant.room.roomNumber ?? '—'}
                    </Link>
                  </>
                ) : (
                  ''
                )}
                {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
              </div>
              <div className="text-xs text-(--color-text-muted)">
                Expected {formatDateTime(row.expectedArrival)} · {gate.label}
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/visitors/${row._id}`)}
                  onEdit={() => router.push(`/visitors/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                  extra={gateActionsOf(row)}
                />
              </div>
            </div>
          );
        }}
      />

      {/* What the columns and the numbers mean. A gate sheet is read fast, and
          a number nobody can place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every number in the band is the server&apos;s count over the whole filtered set (the
          search and the resident), not over the page on screen. The filters and the tab live in
          the address bar, so this view of the gate is a link.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">On site now</strong> is the number of
          passes the server still counts as arrived. A visitor stays on site until the gate stamps
          the departure, so a person who walked out without being stamped out is still on this
          number.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">At the gate</strong> is the clock of
          the pass: when it was expected, when it came in and when it left. The office stamps the
          arrival and the departure; the server keeps the timestamps.
        </p>
        <p>
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          The gate actions in the row are the ones the server allows for that state: a pass that is
          expected can arrive or be refused, a pass that arrived can leave, a cancelled pass can be
          approved again. The server refuses anything else.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete the pass"
        message={`The server deletes the record of ${deleteTarget?.name ?? 'this visitor'} and writes a delete entry in the audit log. The pass is gone: the gate sheet no longer shows the visit, and the resident is not told, so they still expect the visitor.${
          deleteTarget?.status === 'arrived'
            ? ' This visitor is on site right now: deleting the pass removes the record of who is inside.'
            : ''
        }`}
        confirmLabel="Delete the pass"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
