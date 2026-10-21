'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CalendarClock,
  Check,
  Download,
  Info,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { TableActions } from '@/components/ui/TableActions';
import { Textarea } from '@/components/ui/Textarea';
import { tenantLabel } from '@/lib/resource-select-presets';

// ── Shapes ────────────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET  /leaves             apps/api/src/routes/leaves.ts:329-411
//   GET  /leaves/:id         apps/api/src/routes/leaves.ts:450-494
//   PUT  /leaves/:id/approve apps/api/src/routes/leaves.ts:608-683
//   PUT  /leaves/:id/reject  apps/api/src/routes/leaves.ts:686-751
//   POST /leaves/:id/cancel  apps/api/src/routes/leaves.ts:497-574
//   DELETE /leaves/:id       apps/api/src/routes/leaves.ts:577-605

interface LeaveTenant {
  _id?: string;
  bedId?: string | null;
  user?: { _id?: string; name?: string; phone?: string } | null;
  room?: { _id?: string; roomNumber?: string; floor?: { label?: string } | null } | null;
}

interface LeaveRow {
  _id: string;
  tenant?: LeaveTenant | null;
  fromDate?: string;
  toDate?: string;
  /** The API also answers with fromDate/toDate aliased as startDate/endDate (leaves.ts:138-139). */
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  adminNotes?: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}

interface LeavesListBody {
  success: boolean;
  data: LeaveRow[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

// ── Vocabulary ────────────────────────────────────────────────────────────────

/**
 * The tabs of the module. The queue comes first because it is the work: a
 * request that nobody answered is a resident waiting. The decisions follow,
 * and the whole set is the escape hatch.
 */
const STATUS_TABS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

/** The values the status parameter may take in the address bar. */
const STATUS_VALUES = STATUS_TABS.map((tab) => tab.key);

/**
 * The counts behind the tabs. The pending count comes from the queue query
 * itself, so only the other four are asked for separately.
 */
const COUNT_KEYS = ['approved', 'rejected', 'cancelled', 'all'] as const;

/** The queue is the first hundred pending requests; the server clamps a page to 100. */
const QUEUE_LIMIT = 100;

/** A date the API will accept: the server validates the format on some routes. */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Stable empty fallback. `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_LEAVES: LeaveRow[] = [];

const LEAVES_KEY = ['leaves'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The first day of the window. */
function fromOf(row: LeaveRow): string {
  return row.fromDate ?? row.startDate ?? '';
}

/** The last day of the window. */
function toOf(row: LeaveRow): string {
  return row.toDate ?? row.endDate ?? '';
}

/**
 * The days of the window, counted the way the server counts them: the first
 * day and the last day are both inside the window (leaves.ts:17-26).
 */
function inclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function residentName(row: LeaveRow): string {
  return row.tenant?.user?.name ?? 'Unknown resident';
}

/** The place of the resident, as one line: room, bed and floor. */
function residentPlace(row: LeaveRow): string {
  const parts: string[] = [];
  const room = row.tenant?.room?.roomNumber;
  if (room) parts.push(`Room ${room}`);
  const bed = row.tenant?.bedId;
  if (bed) parts.push(`Bed ${bed}`);
  const floor = row.tenant?.room?.floor?.label;
  if (floor) parts.push(floor);
  return parts.length > 0 ? parts.join(' · ') : 'No room on the record';
}

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// ── The queue card ────────────────────────────────────────────────────────────

interface QueueCardProps {
  leave: LeaveRow;
  /** Called after the server answered a decision, with what it committed. */
  onDecided: (message: string) => void;
}

/**
 * One request that waits for an answer.
 *
 * The card carries the three decisions the server accepts (approve, reject with
 * a reason, cancel) so the office answers from where it stands, and it states
 * what the answer does before the answer is given: the days it marks on the
 * attendance board, and the rent it does not touch.
 */
function LeaveQueueCard({ leave, onDecided }: QueueCardProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'cancel' | null>(null);

  const from = fromOf(leave);
  const to = toOf(leave);
  const days = inclusiveDays(from, to);
  const tenantId = leave.tenant?._id ?? '';

  const runDecision = async (action: 'approve' | 'reject' | 'cancel') => {
    setBusy(action);
    setError('');
    try {
      if (action === 'approve') {
        const res = await api
          .put(`leaves/${leave._id}/approve`, { json: {} })
          .json<{ success: boolean; data: LeaveRow }>();
        onDecided(
          `Approved. The server set the status to approved${
            res.data?.approvedByName ? ` by ${res.data.approvedByName}` : ''
          }${res.data?.approvedAt ? ` on ${formatDate(res.data.approvedAt)}` : ''}, marked the days of the window on the attendance board and pushed a service_update notification to the resident. The rent is untouched: the monthly bill is raised from the resident's own record.`,
        );
      } else if (action === 'reject') {
        const res = await api
          .put(`leaves/${leave._id}/reject`, { json: { adminNotes: reason.trim() } })
          .json<{ success: boolean; data: LeaveRow }>();
        onDecided(
          `Rejected. The server set the status to rejected and kept the reason in the office notes, and pushed a service_update notification to the resident: the reason travels in the body of that message, because the portal card does not show the office notes.${
            res.data?.approvedAt ? ` Decided on ${formatDate(res.data.approvedAt)}.` : ''
          }`,
        );
      } else {
        await api
          .post(`leaves/${leave._id}/cancel`, { json: {} })
          .json<{ success: boolean; data: LeaveRow }>();
        onDecided(
          `Cancelled. The server set the status to cancelled, wrote the entry in the audit log and pushed a service_update notification to the resident: the body says the leave was cancelled by the PG office. The attendance board is not touched.`,
        );
      }
      setShowReject(false);
      setReason('');
    } catch (err) {
      // The server's answer is the one that matters: it refuses with
      // LEAVE_NOT_PENDING or OVERLAPPING_LEAVE, and the office has to see it.
      setError((await parseApiError(err)).message);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <article className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-4 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={statusToVariant('pending')} label="Waiting" />
            <span className="text-2xs font-semibold text-(--color-text-muted)">
              applied {formatDate(leave.createdAt)}
            </span>
          </div>
          <h3 className="font-display mt-1.5 text-15 font-bold tracking-tight text-(--color-text-primary)">
            {tenantId ? (
              <Link
                href={`/tenants/${tenantId}`}
                className="text-(--color-brand-600) underline-offset-2 hover:underline"
              >
                {residentName(leave)}
              </Link>
            ) : (
              residentName(leave)
            )}
          </h3>
          <p className="text-xs font-medium text-(--color-text-secondary)">{residentPlace(leave)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-15 font-bold text-(--color-text-primary)">
            {formatDate(from)} - {formatDate(to)}
          </p>
          <p className="text-2xs font-semibold text-(--color-text-muted)">
            {days} day{days === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-(--color-text-secondary)">
        {leave.reason ? (
          leave.reason
        ) : (
          <span className="text-(--color-text-muted) italic">No reason given</span>
        )}
      </p>

      {/* What the answer costs. The office decides with this in front of it. */}
      <div className="mt-3 rounded-(--radius-md) border border-(--color-brand-200) bg-(--color-brand-50) p-3">
        <p className="text-2xs font-bold tracking-wider text-(--color-brand-800) uppercase">
          What approval writes
        </p>
        <ul className="mt-1.5 space-y-1 text-xs font-semibold text-(--color-brand-900)">
          <li>
            Each of the {days} day{days === 1 ? '' : 's'} of the window becomes an on-leave record
            on the attendance board. A day with a real on-site check-in is kept as it is.
          </li>
          <li>
            The rent does not change. The monthly bill is raised from the resident&apos;s own
            record, so a leave is not a deduction.
          </li>
        </ul>
      </div>

      {showReject && (
        <div className="mt-3 rounded-(--radius-md) border border-(--color-danger-200) bg-(--color-danger-50) p-3">
          <Textarea
            label="Reason for the rejection"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Why the leave is refused..."
            helperText="The reason travels to the resident in the notification. A rejection without a reason tells the resident nothing."
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'reject'}
              disabled={busy !== null || reason.trim().length === 0}
              onClick={() => void runDecision('reject')}
            >
              <X className="h-4 w-4" />
              Reject with this reason
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                setShowReject(false);
                setReason('');
              }}
            >
              Keep the request open
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-(--color-danger-600)">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-(--border-color) pt-3">
        <Button
          variant="primary"
          size="sm"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => setConfirm('approve')}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        {!showReject && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setShowReject(true)}
          >
            <X className="h-4 w-4" />
            Reject with a reason
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => setConfirm('cancel')}
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
        <Link
          href={`/leaves/${leave._id}`}
          className="ml-auto text-xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
        >
          Open the leave
        </Link>
      </div>

      <ConfirmModal
        open={confirm === 'approve'}
        title="Approve this leave"
        message={`The server sets the status to approved, marks each of the ${days} day${
          days === 1 ? '' : 's'
        } of the window as on leave on the attendance board (a day with a real on-site check-in is kept), writes the entry in the audit log and pushes a service_update notification to the resident. The rent does not change.`}
        confirmLabel="Approve it"
        cancelLabel="Not yet"
        variant="info"
        loading={busy === 'approve'}
        onConfirm={() => void runDecision('approve')}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmModal
        open={confirm === 'cancel'}
        title="Cancel this request"
        message="The server sets the status to cancelled, writes the entry in the audit log and pushes a service_update notification to the resident: the body says the leave was cancelled by the PG office. The attendance board is not touched, and the request cannot be answered afterwards."
        confirmLabel="Cancel the request"
        cancelLabel="Keep it open"
        variant="warning"
        loading={busy === 'cancel'}
        onConfirm={() => void runDecision('cancel')}
        onCancel={() => setConfirm(null)}
      />
    </article>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────

function LeavesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Every filter lives in the address bar: a queue, a resident or a window can
  // be linked, shared and reviewed, and every link that carries a parameter
  // lands filtered.
  const searchState = useUrlSearch('search');
  const tenantState = useUrlState<string>('tenantId', { defaultValue: '' });
  const statusState = useUrlState<string>('status', {
    defaultValue: 'pending',
    allowed: STATUS_VALUES,
  });
  const fromState = useUrlState<string>('fromDate', { defaultValue: '' });
  const toState = useUrlState<string>('toDate', { defaultValue: '' });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const tenantFilter = tenantState.value;
  const statusFilter = statusState.value;
  // A broken date in the address bar is ignored: it must never filter the list
  // to nothing and must never reach the server as a malformed range.
  const fromDate = YMD.test(fromState.value) ? fromState.value : '';
  const toDate = YMD.test(toState.value) ? toState.value : '';

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** The queue is the work; the other tabs are the ledger of what was decided. */
  const isQueue = statusFilter === 'pending';

  /**
   * The filters every read of this page sends, without the status and without
   * the page. A number that answers a different question than the rows would
   * be a number nobody can trust.
   */
  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tenantFilter) params.set('tenantId', tenantFilter);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params;
  }, [search, tenantFilter, fromDate, toDate]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams(baseParams.toString());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('page', String(isQueue ? 1 : page));
    params.set('limit', String(isQueue ? QUEUE_LIMIT : perPage));
    return params;
  }, [baseParams, isQueue, statusFilter, page, perPage]);

  /**
   * The rows of the view. In the queue the server answers with the pending
   * requests (the first hundred); in the ledger it answers with one page of
   * the tab that is open.
   */
  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<LeavesListBody>(
    [...LEAVES_KEY, 'list', isQueue ? 'queue' : 'ledger', page, perPage, search, tenantFilter, fromDate, toDate, statusFilter],
    `leaves?${listParams.toString()}`,
    { enabled: !isQueue },
  );

  /**
   * The pending set: the queue of the office and the days it costs.
   *
   * It is read for the same filters as the view, so the day count and the
   * queue describe one set and not two.
   */
  const pendingParams = useMemo(() => {
    const params = new URLSearchParams(baseParams.toString());
    params.set('status', 'pending');
    params.set('page', '1');
    params.set('limit', String(QUEUE_LIMIT));
    return params;
  }, [baseParams]);

  const {
    data: pendingBody,
    isPending: isPendingLoading,
    error: pendingError,
  } = useApiBodyQuery<LeavesListBody>(
    [...LEAVES_KEY, 'pending-set', search, tenantFilter, fromDate, toDate],
    `leaves?${pendingParams.toString()}`,
  );

  const pendingRows = pendingBody?.data ?? EMPTY_LEAVES;
  const pendingTotal = pendingBody?.meta?.total ?? 0;

  /**
   * The counts behind the tabs. They are read from the server for the SAME
   * filtered set the view shows, so a tab count is exactly the number of rows
   * the office gets after clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<LeavesListBody, Error> => {
      const params = new URLSearchParams(baseParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key !== 'all') params.set('status', key);
      return {
        queryKey: [...LEAVES_KEY, 'count', search, tenantFilter, fromDate, toDate, key],
        queryFn: () => queryJson<LeavesListBody>(`leaves?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {
    pending: pendingBody ? (pendingBody.meta?.total ?? null) : null,
  };
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta?.total ?? null;
  });

  /**
   * The days the pending requests cover.
   *
   * This is the number no other module can compute: the attendance board knows
   * who is away, but only the leave records know how many days are still
   * waiting for an answer.
   */
  const pendingDays = useMemo(
    () =>
      pendingRows.reduce((sum, row) => sum + inclusiveDays(fromOf(row), toOf(row)), 0),
    [pendingRows],
  );

  const rows = isQueue ? pendingRows : (listBody?.data ?? EMPTY_LEAVES);
  const total = isQueue ? pendingTotal : (listBody?.meta?.total ?? 0);

  /**
   * The name of the resident the filter points at.
   *
   * The server populates the resident on every row, so the chip names the
   * person whenever the rows of the set carry them.
   */
  const tenantFilterLabel = useMemo(() => {
    if (!tenantFilter) return '';
    const named = rows.find((row) => row.tenant?._id === tenantFilter);
    return named ? residentName(named) : `Resident ${tenantFilter.slice(-6)}`;
  }, [rows, tenantFilter]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
  }, [queryClient]);

  const handleDecided = useCallback(
    (message: string) => {
      setWriteResult(message);
      refresh();
    },
    [refresh],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`leaves/${deleteTarget._id}`).json();
      setWriteResult(
        'The server removed the leave record and wrote a delete entry in the audit log. The resident was not told: cancelling the request instead tells them.',
      );
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 rows, so the export walks the pages of the
   * filtered set instead of asking for one big page that silently arrives
   * truncated. The operator is told how many leaves the server reports and how
   * many the file carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const exported: LeaveRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(baseParams.toString());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        params.set('page', String(exportPage));
        params.set('limit', '100');
        const res = await api.get(`leaves?${params.toString()}`).json<LeavesListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        exported.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (exported.length === 0) {
        setWriteResult('Nothing to export: the server reports no leave for these filters.');
        return;
      }

      const headers = [
        'Resident',
        'Room',
        'Bed',
        'Floor',
        'From',
        'To',
        'Days',
        'Reason',
        'Status',
        'Decided by',
        'Office notes',
        'Applied at',
      ];
      const rowsCsv = exported.map((row) =>
        [
          residentName(row),
          row.tenant?.room?.roomNumber ?? '',
          row.tenant?.bedId ?? '',
          row.tenant?.room?.floor?.label ?? '',
          fromOf(row),
          toOf(row),
          inclusiveDays(fromOf(row), toOf(row)),
          row.reason ?? '',
          row.status ?? '',
          row.approvedByName ?? '',
          row.adminNotes ?? '',
          row.createdAt ?? '',
        ]
          .map(sanitizeCSVValue)
          .join(','),
      );
      const csvContent = [headers.map(sanitizeCSVValue).join(','), ...rowsCsv].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leaves-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        exported.length < reportedTotal
          ? `Export written with ${exported.length} of ${reportedTotal} leaves: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${exported.length} leaves the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({
      search: null,
      tenantId: null,
      fromDate: null,
      toDate: null,
    });
    setPage(1);
  };

  const filtersActive = Boolean(search || tenantFilter || fromDate || toDate);

  const chips = [
    ...(statusFilter !== 'pending'
      ? [
          {
            key: 'status',
            label: 'Status',
            value:
              STATUS_TABS.find((tab) => tab.key === statusFilter)?.label.toLowerCase() ??
              statusFilter,
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
            value: tenantFilterLabel,
            onRemove: () => {
              tenantState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(fromDate || toDate
      ? [
          {
            key: 'window',
            label: 'Window',
            value: `${fromDate || 'any'} to ${toDate || 'any'}`,
            onRemove: () => {
              writeUrl({ fromDate: null, toDate: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: 'search',
            label: 'Resident name',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<LeaveRow>[] = [
    {
      header: 'Resident',
      accessor: (row) => (
        <div>
          {row.tenant?._id ? (
            <Link
              href={`/tenants/${row.tenant._id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              {residentName(row)}
            </Link>
          ) : (
            <span className="font-semibold text-(--color-text-primary)">{residentName(row)}</span>
          )}
          <div className="text-2xs text-(--color-text-muted)">{residentPlace(row)}</div>
        </div>
      ),
    },
    {
      header: 'Window',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-(--color-text-primary)">
            {formatDate(fromOf(row))} - {formatDate(toOf(row))}
          </div>
          <div className="text-2xs text-(--color-text-muted)">
            {inclusiveDays(fromOf(row), toOf(row))} day
            {inclusiveDays(fromOf(row), toOf(row)) === 1 ? '' : 's'}
          </div>
        </div>
      ),
    },
    {
      header: 'Reason',
      accessor: (row) => (
        <span className="block max-w-50 truncate text-xs text-(--color-text-muted)">
          {row.reason ?? '—'}
        </span>
      ),
    },
    {
      header: 'Decision',
      accessor: (row) => (
        <div>
          <div className="text-xs font-semibold text-(--color-text-primary)">
            {row.approvedByName ?? 'Not decided'}
          </div>
          <div className="text-2xs text-(--color-text-muted)">
            {row.approvedAt ? formatDate(row.approvedAt) : ''}
          </div>
          {row.adminNotes ? (
            <div className="text-2xs text-(--color-text-secondary)">{row.adminNotes}</div>
          ) : null}
        </div>
      ),
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
          onView={() => router.push(`/leaves/${row._id}`)}
          onEdit={() => router.push(`/leaves/${row._id}/edit`)}
          showDelete={row.status === 'pending' || row.status === 'cancelled'}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leaves"
        description="Whose absence is waiting for an answer, and what the answer writes on the attendance board"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              loading={exporting}
              disabled={exporting}
              onClick={() => void handleExportCsv()}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/leaves/new')}>
              <Plus className="h-4 w-4" />
              New Leave
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || errorMessage(pendingError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers, the tabs and the filters in one surface,
          so the queue is reachable without scrolling past half a screen of
          chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Waiting for a decision',
            value: pendingBody ? String(pendingTotal) : '-',
            hint: 'requests the office has to answer',
            tone: pendingTotal > 0 ? 'warning' : 'success',
          },
          {
            label: 'Leave days pending',
            value: pendingBody ? String(pendingDays) : '-',
            hint: 'the days the waiting requests cover',
            tone: 'brand',
          },
          {
            label: 'Leaves on record',
            value: counts.all != null ? String(counts.all) : '-',
            hint: 'every request, answered or not',
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
              tab.key === 'pending'
                ? 'warning'
                : tab.key === 'approved'
                  ? 'success'
                  : tab.key === 'rejected'
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
              placeholder="Search by resident name..."
              aria-label="Search by resident name"
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
            className="w-64"
          />
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(val: string) => {
              fromState.setValue(val);
              setPage(1);
            }}
            onToChange={(val: string) => {
              toState.setValue(val);
              setPage(1);
            }}
            compact
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {isQueue ? (
        <div className="space-y-3">
          {isPendingLoading ? (
            <p className="text-xs font-semibold text-(--color-text-muted)">
              Loading the queue...
            </p>
          ) : rows.length === 0 ? (
            filtersActive ? (
              <EmptyState
                icon={<CalendarClock className="h-10 w-10" />}
                title="No request is waiting under these filters"
                description="The server reports no pending leave for the filters above."
                action={{ label: 'Clear the filters', onClick: clearAllFilters }}
              />
            ) : (
              <EmptyState
                icon={<CalendarClock className="h-10 w-10" />}
                title="Nothing is waiting for an answer"
                description="Every request the residents filed has been decided. Record a leave for a resident, or read the decided ones on the other tabs."
                action={{ label: 'Record a leave', onClick: () => router.push('/leaves/new') }}
              />
            )
          ) : (
            <>
              {pendingTotal > rows.length && (
                <p className="text-2xs font-medium text-(--color-text-secondary)">
                  The queue shows the first {rows.length} of the {pendingTotal} pending requests the
                  server reports for these filters: the server serves at most {QUEUE_LIMIT} rows in
                  one page.
                </p>
              )}
              {rows.map((row) => (
                <LeaveQueueCard key={row._id} leave={row} onDecided={handleDecided} />
              ))}
            </>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(row: LeaveRow) => row._id}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/leaves/${row._id}`)}
          pagination={{
            page,
            perPage,
            total,
            onPageChange: setPage,
            onPerPageChange: (pp) => {
              setPerPage(pp);
              setPage(1);
            },
          }}
          emptyState={
            filtersActive ? (
              <EmptyState
                icon={<CalendarClock className="h-10 w-10" />}
                title="No leave matches these filters"
                description="The server reports no leave for the filters above."
                action={{ label: 'Clear the filters', onClick: clearAllFilters }}
              />
            ) : (
              <EmptyState
                icon={<CalendarClock className="h-10 w-10" />}
                title="No leave on record"
                description="Record the first leave: the request waits for a decision and the answer marks the days on the attendance board."
                action={{ label: 'Record a leave', onClick: () => router.push('/leaves/new') }}
              />
            )
          }
          mobileCardRenderer={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {row.tenant?._id ? (
                  <Link
                    href={`/tenants/${row.tenant._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {residentName(row)}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-(--color-text-primary)">
                    {residentName(row)}
                  </span>
                )}
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status?.replace(/_/g, ' ') ?? 'Unknown'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-muted)">
                <span>
                  {formatDate(fromOf(row))} - {formatDate(toOf(row))}
                </span>
                <span>{residentPlace(row)}</span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/leaves/${row._id}`)}
                  onEdit={() => router.push(`/leaves/${row._id}/edit`)}
                  showDelete={row.status === 'pending' || row.status === 'cancelled'}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          )}
        />
      )}

      {/* What the numbers and the columns mean. A day count nobody can place is
          a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          The filters live in the address bar, so this view is a link:{' '}
          <span className="font-mono">/leaves?status=pending</span> is the queue the office works
          from.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Waiting for a decision</strong> is the
          number of pending requests the server reports for these filters. The other tabs carry the
          same count for their own status, so a tab count is the number of rows you get after
          clicking it.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Leave days pending</strong> is the
          number of days those requests cover, counted the way the server counts them: the first
          day and the last day are both inside the window.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Window</strong> narrows the requests to
          the ones that overlap the days you pick. The rent is never part of this: the monthly bill
          is raised from the resident&apos;s own record, so a leave is not a deduction.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this leave record"
        message="The server removes the record and writes a delete entry in the audit log. The resident is not told: cancelling the request instead pushes a notification that says the leave was cancelled by the PG office."
        confirmLabel="Delete the record"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function LeavesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <LeavesContent />
    </Suspense>
  );
}
