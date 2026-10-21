'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  Download,
  ArrowDownRight,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import {
  useUrlSearch,
  useUrlState,
  useUrlStateWriter,
  readUrlDateRange,
} from '@/hooks/useUrlState';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { PageBand } from '@/components/ui/PageBand';
import {
  VerifyPaymentModal,
  type VerifyPaymentTarget,
} from '@/components/admin/VerifyPaymentModal';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  tenantDisplayName,
  tenantRoomNumber,
  tenantBedId,
  tenantIdOf,
  invoiceIdOf,
  type PopulatedTenantRef,
} from '@/lib/api-shapes';

interface PaymentRow {
  _id: string;
  tenantId?: PopulatedTenantRef | string;
  amount: number;
  method: string;
  type: string;
  status: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  utrNumber?: string;
  screenshotUrl?: string;
  invoiceNumber?: string;
  invoiceId?: string | { _id?: string; invoiceNumber?: string; month?: string };
}

interface PaymentMonthSummary {
  month: string;
  collected: number;
  expected: number;
  pending: number;
}

const METHOD_FILTERS = [
  { value: '', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'other', label: 'Other' },
];

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending_verification', label: 'To verify' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** The statuses the API can hold, and the only values the status filter accepts. */
const STATUS_FILTERS = STATUS_TABS.map((tab) => tab.key).filter((key) => key !== '');

/** The values the method and type filters accept, for the address bar reader. */
const METHOD_VALUES = METHOD_FILTERS.map((option) => option.value);
const TYPE_VALUES = TYPE_FILTERS.map((option) => option.value);

/** The status keys the count strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtCompact(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

function invoiceNumberOf(row: PaymentRow): string {
  const inv = row.invoiceId;
  if (inv && typeof inv === 'object') return inv.invoiceNumber ?? inv._id ?? '';
  return row.invoiceNumber ?? (inv as string) ?? '';
}

/** The room of a populated tenant, as the id the room screen is addressed by. */
function roomIdOf(tenant: PopulatedTenantRef | string | null | undefined): string {
  if (!tenant || typeof tenant === 'string') return '';
  const room = tenant.roomId ?? tenant.room;
  if (!room) return '';
  return String(room._id ?? room.id ?? '');
}

interface PaymentsListBody {
  success: boolean;
  data: PaymentRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** The filters the ledger reads, in one place, so every read sends the same set. */
interface LedgerFilters {
  method: string;
  type: string;
  search: string;
  fromDate: string;
  toDate: string;
}

const PAYMENTS_PREFIX = ['payments'] as const;
const INVOICES_PREFIX = ['invoices'] as const;
/** Stable empty fallback: `?? []` would allocate a fresh array on every render
 * while the query is pending, breaking referential stability for useMemo deps. */
const EMPTY_PAYMENTS: PaymentRow[] = [];

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

/** The most rows one export carries. Past this the operator is told, not cut. */
const MAX_EXPORT_ROWS = 10_000;

const PAYMENTS_LIST_KEY = (
  page: number,
  perPage: number,
  filters: LedgerFilters,
  status: string,
) => [...PAYMENTS_PREFIX, 'list', page, perPage, filters, status];

const PAYMENTS_SUMMARY_KEY = (month: string) => [...PAYMENTS_PREFIX, 'summary', month];

function summaryMonths(): { thisMonth: string; prevMonth: string } {
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { thisMonth: fmt(now), prevMonth: fmt(prevDate) };
}

/** The month a YYYY-MM-DD date belongs to, or an empty string when it is not a date. */
function monthOf(date: string): string {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : '';
}

/** The month before a YYYY-MM month. */
function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year ?? 0, (monthNumber ?? 1) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The query parameters of the filtered set.
 *
 * Every read of the ledger sends the same set: the table, the counts behind the
 * status tabs and the CSV export. A number that answers a different question
 * than the rows would be a number the operator cannot trust.
 */
function filterParams(filters: LedgerFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.method) params.set('method', filters.method);
  if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  return params;
}

/** The identity of a filter set: it changes whenever the filtered set changes. */
function filterScope(filters: LedgerFilters): string {
  return [filters.method, filters.type, filters.search, filters.fromDate, filters.toDate].join('|');
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // The filters live in the address bar: the triage link of the dashboard
  // ("Verify UTR") lands on the verification queue instead of the whole ledger,
  // and the view can be shared, bookmarked and cited.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const methodState = useUrlState<string>('method', { defaultValue: '', allowed: METHOD_VALUES });
  const typeState = useUrlState<string>('type', { defaultValue: '', allowed: TYPE_VALUES });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const urlDates = readUrlDateRange(searchParams);

  const filters = useMemo<LedgerFilters>(
    () => ({
      method: methodState.value,
      type: typeState.value,
      search: searchState.value.trim(),
      fromDate: urlDates.fromDate,
      toDate: urlDates.toDate,
    }),
    [methodState.value, typeState.value, searchState.value, urlDates.fromDate, urlDates.toDate],
  );

  const statusFilter = statusState.value;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Mutation (delete/export) failures; list failures come from the query.
  const [error, setError] = useState('');
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<VerifyPaymentTarget | null>(null);
  const [verifying, setVerifying] = useState(false);

  const scope = filterScope(filters);

  const refreshAfterMutation = useCallback(async () => {
    // Mirrors the old fetch runs: clear the stale banner, then re-read the
    // server. A verification also moves the invoice status and balance, so
    // the invoice queries are re-read too.
    setError('');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PAYMENTS_PREFIX }),
      queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
    ]);
  }, [queryClient]);

  const handleVerify = async (approved: boolean, notes: string) => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      const res = await api
        .post(`payments/${verifyTarget._id}/verify`, {
          json: { approved, notes: notes || undefined },
        })
        .json<{ success: boolean; data?: { status?: string } }>();
      setVerifyTarget(null);
      await refreshAfterMutation();
      const serverStatus = res.data?.status?.replace(/_/g, ' ') ?? 'unknown';
      setWriteResult(
        approved
          ? `Verification saved. Server status of the payment: ${serverStatus}.`
          : `Rejection saved. Server status of the payment: ${serverStatus}.`,
      );
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setVerifying(false);
    }
  };

  const listParams = filterParams(filters);
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));
  if (statusFilter) listParams.set('status', statusFilter);

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<PaymentsListBody>(
    PAYMENTS_LIST_KEY(page, perPage, filters, statusFilter),
    `payments?${listParams.toString()}`,
  );

  const payments = listBody?.data ?? EMPTY_PAYMENTS;
  const total = listBody?.meta.total ?? 0;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it. The all-time count of the status endpoint could disagree with
   * the rows under a date, method or type filter, and a number that
   * disagrees with the rows is a number nobody trusts.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<PaymentsListBody, Error> => {
      const params = filterParams(filters);
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('status', key);
      return {
        queryKey: [...PAYMENTS_PREFIX, 'count', scope, key],
        queryFn: () => queryJson<PaymentsListBody>(`payments?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta.total ?? null;
  });

  // Month summaries for the money cards (non-blocking).
  const { thisMonth, prevMonth } = summaryMonths();
  // The money cards cover one month. When the date filter names exactly one
  // month, the cards follow it; otherwise they stay on the current month and
  // say so, because a month is the only scope the server can report.
  const rangeMonth =
    urlDates.fromDate !== '' && urlDates.toDate !== ''
      ? monthOf(urlDates.fromDate) === monthOf(urlDates.toDate)
        ? monthOf(urlDates.fromDate)
        : ''
      : '';
  const summaryMonth = rangeMonth || thisMonth;
  const compareMonth = rangeMonth ? previousMonth(rangeMonth) : prevMonth;
  const moneyScopeNote =
    (urlDates.fromDate !== '' || urlDates.toDate !== '') && rangeMonth === ''
      ? ' · the money cards cover one month'
      : '';

  const { data: summary } = useApiQuery<PaymentMonthSummary>(
    PAYMENTS_SUMMARY_KEY(summaryMonth),
    `payments/summary?month=${summaryMonth}`,
  );
  const { data: prevSummary } = useApiQuery<PaymentMonthSummary>(
    PAYMENTS_SUMMARY_KEY(compareMonth),
    `payments/summary?month=${compareMonth}`,
  );

  const hasFilters =
    filters.method !== '' ||
    filters.type !== '' ||
    filters.search !== '' ||
    filters.fromDate !== '' ||
    filters.toDate !== '';
  const countScopeHint = hasFilters ? 'in the filtered set' : 'all payments';

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`payments/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      await refreshAfterMutation();
      setWriteResult('Deletion saved. The server no longer lists this payment.');
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
   * truncated. The filters and the search of the view travel with it, and the
   * operator is told how many rows the server reported and how many the file
   * carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const rows: PaymentRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = filterParams(filters);
        if (statusFilter) params.set('status', statusFilter);
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`payments?${params.toString()}`).json<PaymentsListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        if (rows.length >= MAX_EXPORT_ROWS) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no payment for these filters.');
        return;
      }

      const headers = [
        'Tenant',
        'Room',
        'Bed',
        'Amount',
        'Method',
        'Type',
        'Status',
        'UTR Number',
        'Invoice',
        'Date',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((p) => [
        escapeCsv(tenantDisplayName(p.tenantId)),
        escapeCsv(tenantRoomNumber(p.tenantId)),
        escapeCsv(tenantBedId(p.tenantId) || '—'),
        escapeCsv(p.amount),
        escapeCsv(p.method),
        escapeCsv(p.type),
        escapeCsv(p.status),
        escapeCsv(p.utrNumber ?? '—'),
        escapeCsv(invoiceNumberOf(p) || '—'),
        escapeCsv(new Date(p.paidAt || p.createdAt).toISOString().slice(0, 10)),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `payments-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} payments: the export stops at ${MAX_EXPORT_ROWS} rows, so the file is short of the whole set.`
          : `Export written with all ${rows.length} payments the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const delta = (
    cur: number,
    prev: number | undefined,
  ): { percent: number | null; label: string } => {
    if (prev == null || prev === 0) return { percent: null, label: 'no prior month' };
    const pct = ((cur - prev) / prev) * 100;
    return { percent: pct, label: `vs ${fmtCompact(prev)} last month` };
  };

  /** Direction cue for a comparison, same rule the metric tiles used. */
  const deltaIcon = (cur: number, prev: number | undefined) =>
    (cur ?? 0) >= (prev ?? 0) ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : (
      <ArrowDownRight className="h-3.5 w-3.5" />
    );

  const clearAllFilters = () => {
    writeUrl({
      method: null,
      type: null,
      search: null,
      fromDate: null,
      toDate: null,
      date: null,
    });
    setPage(1);
  };

  const chips = [
    ...(filters.method
      ? [
          {
            key: 'method',
            label: 'Method',
            value: METHOD_FILTERS.find((m) => m.value === filters.method)?.label ?? filters.method,
            onRemove: () => {
              methodState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.type
      ? [
          {
            key: 'type',
            label: 'Type',
            value: TYPE_FILTERS.find((t) => t.value === filters.type)?.label ?? filters.type,
            onRemove: () => {
              typeState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'Status',
            value: STATUS_TABS.find((s) => s.key === statusFilter)?.label ?? statusFilter,
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.fromDate
      ? [
          {
            key: 'from',
            label: 'From',
            value: filters.fromDate,
            onRemove: () => {
              writeUrl({ fromDate: null, date: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.toDate
      ? [
          {
            key: 'to',
            label: 'To',
            value: filters.toDate,
            onRemove: () => {
              writeUrl({ toDate: null, date: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.search
      ? [
          {
            key: 'search',
            label: 'Search',
            value: filters.search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const statusLabel =
    STATUS_TABS.find((tab) => tab.key === statusFilter)?.label.toLowerCase() ?? statusFilter;

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => {
        const tenantId = tenantIdOf(row.tenantId);
        const roomId = roomIdOf(row.tenantId);
        const roomText =
          tenantRoomNumber(row.tenantId) !== 'N/A'
            ? `Room ${tenantRoomNumber(row.tenantId)}${tenantBedId(row.tenantId) ? ` · Bed ${tenantBedId(row.tenantId)}` : ''}`
            : '—';
        return (
          <div>
            {tenantId ? (
              <Link
                href={`/tenants/${tenantId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                {tenantDisplayName(row.tenantId)}
              </Link>
            ) : (
              <span className="font-semibold text-(--color-text-primary)">
                {tenantDisplayName(row.tenantId)}
              </span>
            )}
            {roomId ? (
              <Link
                href={`/rooms/${roomId}`}
                onClick={(e) => e.stopPropagation()}
                className="block text-xs text-(--color-brand-600) hover:underline"
              >
                {roomText}
              </Link>
            ) : (
              <span className="block text-xs text-(--color-text-muted)">{roomText}</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="font-semibold text-(--color-text-primary) tabular-nums">
          {fmtMoney(row.amount)}
        </span>
      ),
    },
    {
      header: 'Method',
      accessor: (row) => (
        <span className="capitalize">{row.method ? row.method.replace(/_/g, ' ') : 'N/A'}</span>
      ),
    },
    {
      header: 'UTR / Invoice',
      accessor: (row) => {
        const utr = row.utrNumber;
        const inv = invoiceNumberOf(row);
        const invoiceId = invoiceIdOf(row.invoiceId);
        return (
          <div className="space-y-0.5">
            {utr ? (
              <span className="block font-mono text-xs font-bold text-(--color-brand-700)">
                {utr}
              </span>
            ) : (
              <span className="block text-xs text-(--color-text-muted)">No UTR</span>
            )}
            {invoiceId ? (
              <Link
                href={`/invoices/${invoiceId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-2xs block font-mono text-(--color-brand-600) hover:underline"
              >
                {inv || invoiceId.slice(-6)}
              </Link>
            ) : inv ? (
              <span className="text-2xs block font-mono text-(--color-text-muted)">{inv}</span>
            ) : null}
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
      header: 'Date',
      accessor: (row) =>
        new Date(row.paidAt || row.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/payments/${row._id}`)}
          onEdit={() => router.push(`/payments/${row._id}/edit`)}
          onDelete={row.status === 'paid' ? undefined : () => setDeleteTarget(row)}
          showDelete={row.status !== 'paid'}
          extra={
            row.status === 'pending_verification'
              ? [
                  {
                    label: 'Verify UTR',
                    icon: <CheckCircle2 className="h-3.5 w-3.5 text-(--color-success-600)" />,
                    onClick: () => {
                      const inv = row.invoiceId;
                      setVerifyTarget({
                        _id: row._id,
                        tenantName: tenantDisplayName(row.tenantId),
                        roomNumber: tenantRoomNumber(row.tenantId),
                        amount: row.amount,
                        utrNumber: row.utrNumber,
                        screenshotUrl: row.screenshotUrl,
                        paidAt: row.paidAt,
                        createdAt: row.createdAt,
                        status: row.status,
                        invoiceNumber:
                          inv && typeof inv === 'object'
                            ? (inv.invoiceNumber ?? undefined)
                            : undefined,
                      });
                    },
                  },
                ]
              : undefined
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Track, verify, and reconcile tenant payments"
        action={
          <Button onClick={() => router.push('/payments/new')}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {/* The compact band: numbers, status tabs and filters in one surface, so
          the first data row is reachable without scrolling past half a screen
          of chrome. Every number and every filter is the one it was. */}
      <PageBand
        metrics={[
          {
            label: `Collected · ${summary?.month ?? summaryMonth}`,
            value: fmtMoney(summary?.collected ?? 0),
            hint: summary
              ? `${delta(summary.collected, prevSummary?.collected).label}${moneyScopeNote}`
              : undefined,
            icon: summary ? deltaIcon(summary.collected, prevSummary?.collected) : undefined,
            tone: 'success',
          },
          {
            label: `Expected · ${summary?.month ?? summaryMonth}`,
            value: fmtMoney(summary?.expected ?? 0),
            hint: summary ? delta(summary.expected, prevSummary?.expected).label : undefined,
            icon: summary ? deltaIcon(summary.expected, prevSummary?.expected) : undefined,
            tone: 'brand',
          },
          {
            label: `Pending · ${summary?.month ?? summaryMonth}`,
            value: fmtMoney(summary?.pending ?? 0),
            hint:
              summary && summary.expected > 0
                ? `${Math.max(0, Math.round((1 - summary.collected / summary.expected) * 100))}% uncollected`
                : undefined,
            tone: (summary?.pending ?? 0) > 0 ? 'warning' : 'success',
          },
          {
            label: 'Awaiting Verification',
            value: String(counts.pending_verification ?? 0),
            hint: countScopeHint,
            tone: (counts.pending_verification ?? 0) > 0 ? 'danger' : 'default',
            onClick: () => {
              statusState.setValue('pending_verification');
              setPage(1);
            },
          },
        ]}
      >
        {/* Status tab strip. The counts are the rows the tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((s) => ({
            key: s.key,
            label: s.label,
            count: counts[s.key] ?? null,
            tone:
              s.key === 'pending_verification'
                ? 'danger'
                : s.key === 'paid'
                  ? 'success'
                  : s.key === 'overdue'
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
              placeholder="Search tenant, phone, room, invoice, UTR..."
              aria-label="Search tenant, phone, room, invoice, UTR..."
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-40">
            <Select
              aria-label="Filter by method"
              options={METHOD_FILTERS}
              value={filters.method}
              onChange={(e) => {
                methodState.setValue(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Select
              aria-label="Filter by type"
              options={TYPE_FILTERS}
              value={filters.type}
              onChange={(e) => {
                typeState.setValue(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <DateRangePicker
            fromDate={filters.fromDate}
            toDate={filters.toDate}
            onFromChange={(val: string) => {
              writeUrl({ fromDate: val || null, date: null });
              setPage(1);
            }}
            onToChange={(val: string) => {
              writeUrl({ toDate: val || null, date: null });
              setPage(1);
            }}
            compact
          />
          <Button
            variant="outline"
            onClick={() => void handleExportCsv()}
            disabled={exporting || payments.length === 0}
            loading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      <DataTable
        columns={columns}
        data={payments}
        keyExtractor={(row) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/payments/${row._id}`)}
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
          // The empty state answers the question the operator asked. An empty
          // verification queue is good news and says so; an empty ledger says
          // what to do next.
          statusFilter === 'pending_verification' ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10" />}
              title="The verification queue is empty"
              description="No payment in this view is waiting for a UTR check."
              action={{
                label: 'Back to the whole ledger',
                onClick: () => {
                  statusState.reset();
                  setPage(1);
                },
              }}
            />
          ) : statusFilter ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title={`No ${statusLabel} payment in this view`}
              description="The server reports no payment for the filters above."
              action={{
                label: 'Back to the whole ledger',
                onClick: () => {
                  statusState.reset();
                  setPage(1);
                },
              }}
            />
          ) : (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title="No payments found"
              description="Record an offline payment or wait for UPI submissions."
              action={{
                label: 'Record Payment',
                onClick: () => router.push('/payments/new'),
              }}
            />
          )
        }
        mobileCardRenderer={(row) => {
          const tenantId = tenantIdOf(row.tenantId);
          const invoiceId = invoiceIdOf(row.invoiceId);
          const invoiceText = invoiceNumberOf(row);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {tenantId ? (
                  <Link
                    href={`/tenants/${tenantId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {tenantDisplayName(row.tenantId)}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-(--color-text-primary)">
                    {tenantDisplayName(row.tenantId)}
                  </span>
                )}
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
                <span className="font-semibold text-(--color-text-primary)">
                  {fmtMoney(row.amount)}
                </span>
                <span className="capitalize">
                  {row.method ? row.method.replace(/_/g, ' ') : 'N/A'}
                </span>
                <span>
                  {new Date(row.paidAt || row.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              {row.utrNumber && (
                <p className="text-2xs font-mono font-bold text-(--color-brand-700)">
                  {row.utrNumber}
                </p>
              )}
              {invoiceId && (
                <Link
                  href={`/invoices/${invoiceId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-2xs block font-mono text-(--color-brand-600) hover:underline"
                >
                  {invoiceText || invoiceId.slice(-6)}
                </Link>
              )}
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/payments/${row._id}`)}
                  onEdit={() => router.push(`/payments/${row._id}/edit`)}
                  showDelete={false}
                  extra={
                    row.status === 'pending_verification'
                      ? [
                          {
                            label: 'Verify',
                            icon: <ShieldCheck className="h-3.5 w-3.5" />,
                            onClick: () => {
                              const inv = row.invoiceId;
                              setVerifyTarget({
                                _id: row._id,
                                tenantName: tenantDisplayName(row.tenantId),
                                roomNumber: tenantRoomNumber(row.tenantId),
                                amount: row.amount,
                                utrNumber: row.utrNumber,
                                screenshotUrl: row.screenshotUrl,
                                paidAt: row.paidAt,
                                createdAt: row.createdAt,
                                status: row.status,
                                invoiceNumber:
                                  inv && typeof inv === 'object'
                                    ? (inv.invoiceNumber ?? undefined)
                                    : undefined,
                              });
                            },
                          },
                        ]
                      : undefined
                  }
                />
              </div>
            </div>
          );
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete payment?"
        message="This cannot be undone. Paid payments may be blocked by the API."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <VerifyPaymentModal
        target={verifyTarget}
        loading={verifying}
        onDecide={handleVerify}
        onClose={() => setVerifyTarget(null)}
      />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}
