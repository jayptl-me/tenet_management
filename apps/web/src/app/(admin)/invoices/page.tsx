'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
  FileText,
  Wand2,
  Download,
  Send,
  Trash2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Users,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { PageBand } from '@/components/ui/PageBand';
import { AgingBars, type AgingBucket } from '@/components/ui/AgingBars';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { LineChart } from '@/components/ui/LineChart';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { tenantLabel } from '@/lib/resource-select-presets';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

interface InvoiceRow {
  _id: string;
  invoiceNumber: string;
  tenantId?: {
    _id?: string;
    userId?: { name?: string };
    roomId?: { _id?: string; roomNumber?: string };
  };
  totalAmount: number;
  rentAmount?: number;
  month: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  /** Server-computed settled sum (GET /invoices). */
  paidAmount?: number;
  /** Server-computed amount still due (GET /invoices). null when not reported. */
  balance?: number | null;
}

interface SummaryMonth {
  month: string;
  collected: number;
  expected: number;
  pending: number;
}

interface AgingData {
  buckets: Record<string, { count: number; amount: number }>;
  totalOutstanding: number;
}

interface TrendPoint {
  month: string;
  collected: number;
  expected: number;
}

interface BulkPreviewData {
  activeTenantsCount: number;
  alreadyInvoicedCount: number;
  toGenerateCount: number;
  estimatedTotalAmount: number;
}

/** The resident whose invoices are being filtered, read for the filter chip. */
interface TenantFilterLabel {
  user?: { name?: string };
  room?: { roomNumber?: string };
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** The statuses the API can hold, and the only values the status filter accepts. */
const STATUS_FILTERS = STATUS_TABS.map((tab) => tab.key).filter((key) => key !== '');

/** The status keys the count strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

/** A billing month is YYYY-MM. Anything else is not a month and is not sent. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const AGING_LABELS: Record<string, string> = {
  current: 'Current',
  days1_30: '1-30d',
  days31_60: '31-60d',
  days61_90: '61-90d',
  days90Plus: '90d+',
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * The balance cell of the invoice ledger.
 *
 * The amount is only shown for the statuses that can actually be paid. A
 * cancelled invoice is refused by the server, so it must not look like money
 * that can still be collected, and a settled invoice says so instead of
 * showing a zero that reads as a number the server never reported.
 */
function InvoiceBalanceCell({ row }: { row: InvoiceRow }) {
  if (row.status === 'cancelled') {
    return <span className="text-(--color-text-muted)">Not collectible</span>;
  }
  if (row.status === 'paid') {
    return <span className="text-(--color-success-700)">Settled</span>;
  }
  if (typeof row.balance !== 'number') {
    return <span className="text-(--color-text-muted)">Not reported</span>;
  }
  return (
    <span
      className={clsx(
        'font-semibold tabular-nums',
        row.balance > 0 ? 'text-(--color-danger-700)' : 'text-(--color-success-700)',
      )}
    >
      {fmtMoney(row.balance)}
    </span>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

interface InvoicesListBody {
  success: boolean;
  data: InvoiceRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const INVOICES_PREFIX = ['invoices'] as const;
const INVOICES_AGING_KEY = ['invoices', 'aging'] as const;
const PAYMENTS_SUMMARY_PREFIX = ['payments', 'summary'] as const;
const PAYMENTS_TREND_KEY = ['payments', 'trend', 6] as const;

/** The filters of the ledger, in one place, so every read sends the same set. */
interface LedgerFilters {
  status: string;
  month: string;
  tenantId: string;
  search: string;
}

const INVOICES_LIST_KEY = (page: number, perPage: number, filters: LedgerFilters) => [
  ...INVOICES_PREFIX,
  'list',
  page,
  perPage,
  filters,
];

const INVOICE_BULK_PREVIEW_KEY = (modalOpen: boolean, month: string) => [
  ...INVOICES_PREFIX,
  'preview-bulk',
  modalOpen,
  month,
];

const PAYMENTS_SUMMARY_KEY = (month: string) => [...PAYMENTS_SUMMARY_PREFIX, month];

const TENANT_FILTER_LABEL_KEY = (tenantId: string) =>
  ['tenants', 'filter-label', tenantId] as const;

function summaryMonths(): { thisMonth: string; prevMonth: string } {
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { thisMonth: fmt(now), prevMonth: fmt(prevDate) };
}

/**
 * The query parameters of the filtered set.
 *
 * Every read of the ledger sends the same set: the table, the counts behind
 * the status tabs and the CSV export. A number that answers a different
 * question than the rows would be a number the operator cannot trust.
 */
function filterParams(filters: LedgerFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.month) params.set('month', filters.month);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);
  if (filters.search) params.set('search', filters.search);
  return params;
}

/** The identity of a filter set: it changes whenever the filtered set changes. */
function filterScope(filters: LedgerFilters): string {
  return [filters.status, filters.month, filters.tenantId, filters.search].join('|');
}

function InvoicesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a triage link that carries a status
  // lands on the rows it names, and the view can be shared, bookmarked and
  // cited. A parameter that is not a value the API accepts reads as no
  // filter, so a broken link never empties the ledger.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const monthState = useUrlState<string>('month', { defaultValue: '' });
  const tenantState = useUrlState<string>('tenantId', { defaultValue: '' });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Mutation (delete/export) failures; list failures come from the query.
  const [error, setError] = useState('');
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk Generate state
  const [bulkMonth, setBulkMonth] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkGenerateOpen, setBulkGenerateOpen] = useState(false);

  // Bulk Actions
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const filters = useMemo<LedgerFilters>(
    () => ({
      status: statusState.value,
      // A month that is not YYYY-MM is not sent to the server.
      month: MONTH_PATTERN.test(monthState.value) ? monthState.value : '',
      tenantId: tenantState.value,
      search: searchState.value.trim(),
    }),
    [statusState.value, monthState.value, tenantState.value, searchState.value],
  );

  const scope = filterScope(filters);

  const listParams = filterParams(filters);
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<InvoicesListBody>(
    INVOICES_LIST_KEY(page, perPage, filters),
    `invoices?${listParams.toString()}`,
  );

  const invoices = listBody?.data ?? [];
  const total = listBody?.meta.total ?? 0;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it. The all-time counts of the status endpoint would disagree
   * with the rows under a month, a resident or a search filter, and a number
   * that disagrees with the rows is a number nobody trusts.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<InvoicesListBody, Error> => {
      const params = filterParams({ ...filters, status: key });
      params.set('page', '1');
      params.set('limit', '1');
      return {
        queryKey: [...INVOICES_PREFIX, 'count', scope, key],
        queryFn: () => queryJson<InvoicesListBody>(`invoices?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta.total ?? null;
  });

  // The resident behind the tenant filter, so the chip names a person and not
  // an id. The server is the only source of the name.
  const { data: tenantFilterTenant = null } = useApiQuery<TenantFilterLabel>(
    TENANT_FILTER_LABEL_KEY(filters.tenantId),
    `tenants/${filters.tenantId}`,
    { enabled: Boolean(filters.tenantId) },
  );

  // Executive analytics: month summaries, aging buckets, and the trend chart.
  const { thisMonth, prevMonth } = summaryMonths();
  const { data: summary } = useApiQuery<SummaryMonth>(
    PAYMENTS_SUMMARY_KEY(thisMonth),
    `payments/summary?month=${thisMonth}`,
  );
  const { data: prevSummary } = useApiQuery<SummaryMonth>(
    PAYMENTS_SUMMARY_KEY(prevMonth),
    `payments/summary?month=${prevMonth}`,
  );
  const { data: aging = null, isPending: agingLoading } = useApiQuery<AgingData>(
    INVOICES_AGING_KEY,
    'invoices/aging',
  );
  const { data: trend = [], isPending: trendLoading } = useApiQuery<TrendPoint[]>(
    PAYMENTS_TREND_KEY,
    'payments/trend?months=6',
  );

  // Pre-flight preview for the bulk generate modal.
  const { data: bulkPreview = null, isPending: previewLoading } = useApiQuery<BulkPreviewData>(
    INVOICE_BULK_PREVIEW_KEY(bulkGenerateOpen, bulkMonth),
    `invoices/preview-bulk?month=${bulkMonth}`,
    { enabled: bulkGenerateOpen && Boolean(bulkMonth) },
  );

  const refreshAfterMutation = useCallback(async () => {
    // A fresh list run used to clear the banner along with refetching data.
    setError('');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
      queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_PREFIX }),
      queryClient.invalidateQueries({ queryKey: PAYMENTS_TREND_KEY }),
    ]);
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`invoices/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      await refreshAfterMutation();
      setWriteResult('Deletion saved. The server no longer lists this invoice.');
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkMarkSent = async () => {
    const keys = [...selectedKeys];
    let ok = 0;
    let failed = 0;
    for (const id of keys) {
      const row = invoices.find((inv) => inv._id === id);
      if (!row || row.status !== 'draft') continue;
      try {
        await api.put(`invoices/${id}`, { json: { status: 'sent' } }).json();
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setSelectedKeys(new Set());
    await refreshAfterMutation();
    setWriteResult(
      `Mark sent: ${ok} invoice(s) confirmed by the server, ${failed} rejected. The list below shows the server status.`,
    );
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    const keys = [...selectedKeys];
    let ok = 0;
    let failed = 0;
    for (const id of keys) {
      try {
        await api.delete(`invoices/${id}`).json();
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkDeleteLoading(false);
    setBulkDeleteOpen(false);
    setSelectedKeys(new Set());
    await refreshAfterMutation();
    setWriteResult(
      `Delete: ${ok} invoice(s) removed by the server, ${failed} kept (paid or has payments).`,
    );
  };

  const handleBulkGenerate = async () => {
    if (!bulkMonth) return;
    setBulkLoading(true);
    try {
      const res = await api
        .post('invoices/generate-bulk', { json: { month: bulkMonth } })
        .json<{ success: boolean; data: { generated: number; skipped: number; errors: number } }>();
      if (res.success) {
        setBulkMonth('');
        setBulkGenerateOpen(false);
        await refreshAfterMutation();
        setWriteResult(
          `Server generated ${res.data.generated} invoice(s) for ${bulkMonth}. Skipped: ${res.data.skipped}. Errors: ${res.data.errors}.`,
        );
      }
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setBulkLoading(false);
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
      const rows: InvoiceRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = filterParams(filters);
        params.set('page', String(exportPage));
        params.set('limit', '100');
        const res = await api.get(`invoices?${params.toString()}`).json<InvoicesListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no invoice for these filters.');
        return;
      }

      const headers = [
        'Invoice #',
        'Tenant',
        'Room',
        'Month',
        'Rent Amount',
        'Total Amount',
        'Settled',
        'Balance',
        'Status',
        'Due Date',
        'Created At',
      ];
      const exportRows = rows.map((row) => [
        sanitizeCSVValue(row.invoiceNumber),
        sanitizeCSVValue(row.tenantId?.userId?.name ?? ''),
        sanitizeCSVValue(row.tenantId?.roomId?.roomNumber ?? ''),
        sanitizeCSVValue(row.month),
        sanitizeCSVValue(row.rentAmount ?? 0),
        sanitizeCSVValue(row.totalAmount ?? 0),
        sanitizeCSVValue(typeof row.paidAmount === 'number' ? row.paidAmount : 'Not reported'),
        sanitizeCSVValue(typeof row.balance === 'number' ? row.balance : 'Not reported'),
        sanitizeCSVValue(row.status),
        sanitizeCSVValue(row.dueDate ?? ''),
        sanitizeCSVValue(row.createdAt),
      ]);
      const csvContent = [
        headers.map(sanitizeCSVValue).join(','),
        ...exportRows.map((r) => r.join(',')),
      ].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} invoices: the file is short of the whole set.`
          : `Export written with all ${rows.length} invoices the server reports for these filters.`,
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
    writeUrl({ status: null, month: null, tenantId: null, search: null });
    setPage(1);
  };

  const agingBuckets: AgingBucket[] = aging
    ? Object.entries(AGING_LABELS).map(([key, label]) => ({
        key,
        label,
        count: aging.buckets[key]?.count ?? 0,
        amount: aging.buckets[key]?.amount ?? 0,
      }))
    : [];

  const trendData = trend.map((t) => ({ collected: t.collected, expected: t.expected }));
  const trendLabels = trend.map((t) => {
    const [, m] = t.month.split('-');
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return monthNames[Number(m) - 1] ?? t.month;
  });

  /**
   * What an aging row does when it is clicked.
   *
   * The bucket is the only server-side read of "how old is this debt", so it
   * lands on the status tab that holds the same invoices. The note under the
   * bars says what the two reads do not share.
   */
  const onAgingSelect = (bucket: AgingBucket) => {
    statusState.setValue(bucket.key === 'current' ? 'sent' : 'overdue');
    setPage(1);
  };

  const tenantFilterLabel =
    tenantFilterTenant?.user?.name ??
    (filters.tenantId ? `Resident ${filters.tenantId.slice(-6)}` : '');

  const chips = [
    ...(filters.month
      ? [
          {
            key: 'month',
            label: 'Month',
            value: filters.month,
            onRemove: () => {
              monthState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.tenantId
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
    ...(filters.status
      ? [
          {
            key: 'status',
            label: 'Status',
            value: STATUS_TABS.find((s) => s.key === filters.status)?.label ?? filters.status,
            onRemove: () => {
              statusState.reset();
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
    STATUS_TABS.find((tab) => tab.key === filters.status)?.label.toLowerCase() ?? filters.status;

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      accessor: (row) => (
        <Link
          href={`/invoices/${row._id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono font-semibold text-(--color-brand-600) hover:underline"
        >
          {row.invoiceNumber}
        </Link>
      ),
    },
    {
      header: 'Resident',
      accessor: (row) => {
        const tenantId = row.tenantId?._id ?? '';
        const roomId = row.tenantId?.roomId?._id ?? '';
        const roomNumber = row.tenantId?.roomId?.roomNumber;
        const name = row.tenantId?.userId?.name ?? 'N/A';
        return (
          <div>
            {tenantId ? (
              <Link
                href={`/tenants/${tenantId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-(--color-text-primary)">{name}</span>
            )}
            {roomNumber ? (
              roomId ? (
                <Link
                  href={`/rooms/${roomId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block text-xs text-(--color-brand-600) hover:underline"
                >
                  Room {roomNumber}
                </Link>
              ) : (
                <span className="block text-xs text-(--color-text-muted)">Room {roomNumber}</span>
              )
            ) : (
              <span className="block text-xs text-(--color-text-muted)">—</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Month',
      accessor: (row) => row.month,
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="font-semibold text-(--color-text-primary) tabular-nums">
          {fmtMoney(row.totalAmount)}
        </span>
      ),
    },
    {
      header: 'Balance',
      accessor: (row) => <InvoiceBalanceCell row={row} />,
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
          onView={() => router.push(`/invoices/${row._id}`)}
          onEdit={() => router.push(`/invoices/${row._id}/edit`)}
          showDelete={row.status !== 'paid'}
          onDelete={row.status !== 'paid' ? () => setDeleteTarget(row) : undefined}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  const openInvoicesCount = agingBuckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Generate, track, and reconcile tenant invoices"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkGenerateOpen(true)}>
              <Wand2 className="h-4 w-4" />
              Bulk Generate
            </Button>
            <Button onClick={() => router.push('/invoices/new')}>
              <Plus className="h-4 w-4" />
              Generate Invoice
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

      {/* The compact band: numbers, status tabs and filters in one surface, so
          the first data row is reachable without scrolling past half a screen
          of chrome. Every number and every filter is the one it was. */}
      <PageBand
        metrics={[
          {
            label: `Collected · ${summary?.month ?? 'This Month'}`,
            value: fmtMoney(summary?.collected ?? 0),
            hint: summary ? delta(summary.collected, prevSummary?.collected).label : undefined,
            icon: summary ? deltaIcon(summary.collected, prevSummary?.collected) : undefined,
            tone: 'success',
          },
          {
            label: `Expected · ${summary?.month ?? 'This Month'}`,
            value: fmtMoney(summary?.expected ?? 0),
            hint: summary ? delta(summary.expected, prevSummary?.expected).label : undefined,
            icon: summary ? deltaIcon(summary.expected, prevSummary?.expected) : undefined,
            tone: 'brand',
          },
          {
            label: 'Outstanding · all months',
            value: agingLoading ? '—' : fmtMoney(aging?.totalOutstanding ?? 0),
            hint: agingLoading ? undefined : `${openInvoicesCount} open invoice(s) · aging report`,
            tone: 'warning',
          },
          {
            label: `Pending · ${summary?.month ?? 'This Month'}`,
            value: fmtMoney(summary?.pending ?? 0),
            hint:
              summary && summary.expected > 0
                ? `${Math.max(0, Math.round((1 - summary.collected / summary.expected) * 100))}% uncollected`
                : undefined,
            tone: (summary?.pending ?? 0) > 0 ? 'danger' : 'success',
          },
        ]}
      >
        {/* Status tab strip. The counts are the rows the tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: counts[t.key] ?? null,
            tone:
              t.key === 'overdue'
                ? 'danger'
                : t.key === 'paid'
                  ? 'success'
                  : t.key === 'partial'
                    ? 'warning'
                    : 'default',
          }))}
          active={filters.status}
          onChange={(key) => {
            statusState.setValue(key);
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search invoice, resident, room, month..."
              aria-label="Search invoice, resident, room, month..."
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <DatePicker
            type="month"
            aria-label="Filter by month"
            value={filters.month}
            onChange={(val: string) => {
              monthState.setValue(val);
              setPage(1);
            }}
            className="w-[170px]"
          />
          <ResourceSelect
            endpoint="tenants?limit=100"
            value={filters.tenantId}
            onChange={(val) => {
              tenantState.setValue(val);
              setPage(1);
            }}
            placeholder="All residents"
            valueKey="_id"
            labelKey={tenantLabel}
            dataPath="data"
            className="w-[220px]"
          />
          <Button
            variant="outline"
            onClick={() => void handleExportCsv()}
            disabled={exporting || invoices.length === 0}
            loading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {/* Aging + collection trend row lives under the table: it is analysis of
          the list, and above the table it pushed the first data row off the
          screen. */}
      <DataTable
        columns={columns}
        data={invoices}
        keyExtractor={(row: InvoiceRow) => row._id}
        isLoading={isLoading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        bulkActions={
          <>
            <Button size="sm" variant="outline" onClick={handleBulkMarkSent}>
              <Send className="h-3.5 w-3.5" />
              Mark sent
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExportCsv()}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" variant="danger" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        }
        onRowClick={(row) => router.push(`/invoices/${row._id}`)}
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
          // filter is not the same as an empty ledger.
          filters.status ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title={`No ${statusLabel} invoice in this view`}
              description="The server reports no invoice for the filters above."
              action={{
                label: 'Back to the whole ledger',
                onClick: () => {
                  statusState.reset();
                  setPage(1);
                },
              }}
            />
          ) : filters.month || filters.tenantId || filters.search ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No invoice in this view"
              description="The server reports no invoice for the filters above."
              action={{
                label: 'Clear the filters',
                onClick: clearAllFilters,
              }}
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No invoices yet"
              description="Issue the month bills for the active residents."
              action={{ label: 'Generate Invoice', onClick: () => router.push('/invoices/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Link
                href={`/invoices/${row._id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm font-semibold text-(--color-brand-600) hover:underline"
              >
                {row.invoiceNumber}
              </Link>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
              <span>{row.tenantId?.userId?.name ?? 'N/A'}</span>
              <span>{row.month}</span>
              <span>{fmtMoney(row.totalAmount)}</span>
              {row.status === 'cancelled' ? (
                <span className="font-semibold text-(--color-text-muted)">Not collectible</span>
              ) : row.status === 'paid' ? (
                <span className="font-semibold text-(--color-success-700)">Settled</span>
              ) : typeof row.balance === 'number' ? (
                <span className="font-semibold text-(--color-text-primary)">
                  {fmtMoney(row.balance)} due
                </span>
              ) : (
                <span className="font-semibold text-(--color-text-muted)">
                  Balance not reported
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/invoices/${row._id}`)}
                onEdit={() => router.push(`/invoices/${row._id}/edit`)}
                showDelete={row.status !== 'paid'}
                onDelete={row.status !== 'paid' ? () => setDeleteTarget(row) : undefined}
              />
            </div>
          </div>
        )}
      />

      {/* Aging + collection trend row: analysis of the list, so it sits under
          the table instead of pushing the first data row off the screen. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AgingBars
            buckets={agingBuckets}
            totalOutstanding={aging?.totalOutstanding ?? 0}
            isLoading={agingLoading}
            onSelect={onAgingSelect}
          />
          <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
            The aging report counts every open invoice by how many days past its due date it is. The
            status filter reads the status the daily sweep wrote, so an invoice that is past due but
            not swept yet shows in the bars and not in the overdue tab.
          </p>
        </div>
        <div className={clsx(surfaceCardClass, 'p-5 lg:col-span-2')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                <TrendingUp className="mr-1.5 inline h-4 w-4 text-(--color-brand-500)" />
                Collection trend
              </h3>
              <p className="mt-0.5 text-xs text-(--color-text-muted)">
                Collected vs expected, last 6 months
              </p>
            </div>
          </div>
          <div className="mt-4">
            {trendLoading ? (
              <div className="flex h-[160px] items-center justify-center text-xs font-medium text-(--color-text-muted)">
                Loading trend...
              </div>
            ) : (
              <LineChart
                data={trendData}
                labels={trendLabels}
                lines={[
                  { key: 'collected', color: 'var(--color-success-500)', label: 'Collected' },
                  { key: 'expected', color: 'var(--color-brand-500)', label: 'Expected' },
                ]}
                height={150}
                isCurrency
                showLegend
              />
            )}
          </div>
        </div>
      </div>

      {/* Bulk generate modal with pre-flight intelligence */}
      <Modal
        open={bulkGenerateOpen}
        onClose={() => {
          setBulkGenerateOpen(false);
        }}
        title="Bulk generate invoices"
        description="Creates invoices for all eligible active tenants for the selected month. Existing invoices are automatically skipped."
        loading={bulkLoading}
        footer={
          <>
            <Button
              variant="outline"
              disabled={bulkLoading}
              onClick={() => {
                setBulkGenerateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={bulkLoading}
              disabled={!bulkMonth || previewLoading || (bulkPreview?.toGenerateCount ?? 0) === 0}
              onClick={handleBulkGenerate}
            >
              <Wand2 className="h-4 w-4" />
              Generate All {bulkPreview?.toGenerateCount ? `(${bulkPreview.toGenerateCount})` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className={clsx(surfaceNestedClass, 'flex items-center gap-3 p-4')}>
            <DatePicker
              type="month"
              aria-label="Bulk invoice month"
              value={bulkMonth}
              onChange={(val: string) => setBulkMonth(val)}
              placeholder="Select month..."
              className="w-full"
            />
          </div>

          {/* Pre-flight summary */}
          {bulkMonth && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-surface) p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-4 text-xs text-(--color-text-muted)">
                  Calculating eligible tenants and billing estimates...
                </div>
              ) : bulkPreview ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-(--color-text-primary)">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-(--color-brand-500)" />
                      Pre-flight Analysis for {bulkMonth}
                    </span>
                    <span className="font-mono text-(--color-brand-600)">
                      Est. Total: {fmtMoney(bulkPreview.estimatedTotalAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-sunken) p-2.5">
                      <span className="text-2xs block text-(--color-text-muted)">
                        Active Tenants
                      </span>
                      <span className="text-base font-bold text-(--color-text-primary)">
                        {bulkPreview.activeTenantsCount}
                      </span>
                    </div>
                    <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-sunken) p-2.5">
                      <span className="text-2xs block text-(--color-text-muted)">
                        Already Invoiced
                      </span>
                      <span className="text-base font-bold text-(--color-warning-600)">
                        {bulkPreview.alreadyInvoicedCount}
                      </span>
                    </div>
                    <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-sunken) p-2.5">
                      <span className="text-2xs block text-(--color-text-muted)">To Generate</span>
                      <span className="text-base font-bold text-(--color-success-600)">
                        {bulkPreview.toGenerateCount}
                      </span>
                    </div>
                  </div>

                  {bulkPreview.toGenerateCount === 0 ? (
                    <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--color-warning-300) bg-(--color-warning-50) p-3 text-xs text-(--color-warning-800)">
                      <AlertCircle className="h-4 w-4 shrink-0 text-(--color-warning-600)" />
                      <span>All active tenants already have an invoice for this month.</span>
                    </div>
                  ) : (
                    <p className="text-xs text-(--color-text-muted)">
                      Invoices will be seeded from each tenant&apos;s base rent plus any finalized
                      electricity meter share. The server issues them as sent, opens a pending
                      payment for the full amount and notifies the resident.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk delete confirm */}
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedKeys.size} invoice(s)?`}
        message="Paid invoices and invoices with payment records cannot be deleted and will be skipped. This cannot be undone for the rest."
        confirmLabel={`Delete ${selectedKeys.size}`}
        loading={bulkDeleteLoading}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Single delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone, and the resident is not notified by the server when the record is removed."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <InvoicesContent />
    </Suspense>
  );
}
