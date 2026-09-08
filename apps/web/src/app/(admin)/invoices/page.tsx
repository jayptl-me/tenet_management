'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  FileText,
  Wand2,
  Download,
  Send,
  Trash2,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FilterChips } from '@/components/ui/FilterChips';
import { KpiHeader } from '@/components/ui/KpiHeader';
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
  tenantId?: { userId?: { name?: string }; roomId?: { roomNumber?: string } };
  totalAmount: number;
  rentAmount?: number;
  month: string;
  status: string;
  dueDate?: string;
  createdAt: string;
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


const STATUS_META: Array<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [tenantFilterLabel, setTenantFilterLabel] = useState('');
  // Deep link from electricity detail ("View Invoices") and other month-scoped flows
  const [monthFilter, setMonthFilter] = useState(() => searchParams.get('month') ?? '');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkMonth, setBulkMonth] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkGenerateOpen, setBulkGenerateOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryMonth | null>(null);
  const [prevSummary, setPrevSummary] = useState<SummaryMonth | null>(null);
  const [aging, setAging] = useState<AgingData | null>(null);
  const [agingLoading, setAgingLoading] = useState(true);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);
      if (monthFilter) params.set('month', monthFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await api.get(`invoices?${params.toString()}`).json<{
        success: boolean;
        data: InvoiceRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, monthFilter, tenantFilter, debouncedSearch]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const [sumRes, prevRes] = await Promise.all([
        api.get(`payments/summary?month=${thisMonth}`).json<{
          success: boolean;
          data: SummaryMonth;
        }>(),
        api.get(`payments/summary?month=${prevMonth}`).json<{
          success: boolean;
          data: SummaryMonth;
        }>(),
      ]);
      setSummary(sumRes.data);
      setPrevSummary(prevRes.data);

      const [agingRes, trendRes] = await Promise.all([
        api.get('invoices/aging').json<{ success: boolean; data: AgingData }>(),
        api.get('payments/trend?months=6').json<{ success: boolean; data: TrendPoint[] }>(),
      ]);
      setAging(agingRes.data);
      setTrend(trendRes.data);
    } catch {
      // Analytics are non-blocking
    } finally {
      setAgingLoading(false);
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Client-side search fallback when API doesn't support `search` yet
  const visibleInvoices = useMemo(() => {
    if (!debouncedSearch) return invoices;
    const q = debouncedSearch.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.tenantId?.userId?.name ?? '').toLowerCase().includes(q) ||
        (inv.tenantId?.roomId?.roomNumber ?? '').toLowerCase().includes(q) ||
        inv.month.includes(q),
    );
  }, [invoices, debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`invoices/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      toast.success('Invoice deleted');
      fetchInvoices();
      fetchAnalytics();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || 'Failed to delete invoice');
      toast.error(parsed.message || 'Failed to delete invoice');
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
    toast.success(`Marked ${ok} invoice(s) sent${failed ? `, ${failed} failed` : ''}.`);
    setSelectedKeys(new Set());
    fetchInvoices();
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
    toast.success(`Deleted ${ok} invoice(s)${failed ? `, ${failed} skipped (paid or has payments)` : ''}.`);
    setSelectedKeys(new Set());
    fetchInvoices();
    fetchAnalytics();
  };

  const handleBulkGenerate = async () => {
    if (!bulkMonth) return;
    setBulkLoading(true);
    try {
      const res = await api
        .post('invoices/generate-bulk', { json: { month: bulkMonth } })
        .json<{ success: boolean; data: { generated: number; skipped: number; errors: number } }>();
      if (res.success) {
        toast.success(
          `Generated ${res.data.generated} invoices for ${bulkMonth}. Skipped: ${res.data.skipped}. Errors: ${res.data.errors}.`,
        );
        setBulkMonth('');
        setBulkGenerateOpen(false);
        fetchInvoices();
      }
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      if (monthFilter) params.set('month', monthFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`invoices?${params.toString()}`).json<{
        success: boolean;
        data: InvoiceRow[];
      }>();

      const rows = res.data ?? [];
      const headers = [
        'Invoice #',
        'Tenant',
        'Room',
        'Month',
        'Rent Amount',
        'Total Amount',
        'Status',
        'Created At',
      ];

      const csvLines = [
        headers.map(sanitizeCSVValue).join(','),
        ...rows.map((row) =>
          [
            row.invoiceNumber,
            row.tenantId?.userId?.name ?? '',
            row.tenantId?.roomId?.roomNumber ?? '',
            row.month,
            row.rentAmount ?? 0,
            row.totalAmount ?? 0,
            row.status,
            row.createdAt,
          ]
            .map(sanitizeCSVValue)
            .join(','),
        ),
      ];

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const delta = (cur: number, prev: number | undefined): { percent: number | null; label: string } => {
    if (prev == null || prev === 0) return { percent: null, label: 'no prior month' };
    const pct = ((cur - prev) / prev) * 100;
    return { percent: pct, label: `vs ${fmtCompact(prev)} last month` };
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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[Number(m) - 1] ?? t.month;
  });

  const chips = [
    ...(monthFilter
      ? [
          {
            key: 'month',
            label: 'Month',
            value: monthFilter,
            onRemove: () => {
              setMonthFilter('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(tenantFilter
      ? [
          {
            key: 'tenant',
            label: 'Tenant',
            value: tenantFilterLabel || tenantFilter,
            onRemove: () => {
              setTenantFilter('');
              setTenantFilterLabel('');
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
            value: STATUS_META.find((s) => s.value === statusFilter)?.label ?? statusFilter,
            onRemove: () => {
              setStatusFilter('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(debouncedSearch
      ? [
          {
            key: 'search',
            label: 'Search',
            value: debouncedSearch,
            onRemove: () => {
              setSearch('');
              setDebouncedSearch('');
            },
          },
        ]
      : []),
  ];

  const clearAllFilters = () => {
    setMonthFilter('');
    setTenantFilter('');
    setTenantFilterLabel('');
    setStatusFilter('');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const onAgingSelect = (bucket: AgingBucket) => {
    // Aging maps to overdue-ish statuses; 90d+ and 61-90d usually overdue, current -> sent
    if (bucket.key === 'current') {
      setStatusFilter('sent');
    } else {
      setStatusFilter('overdue');
    }
    setPage(1);
  };

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      accessor: (row) => (
        <span className="font-mono font-semibold text-[color:var(--color-text-primary)]">
          {row.invoiceNumber}
        </span>
      ),
    },
    {
      header: 'Tenant',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {row.tenantId?.userId?.name ?? 'N/A'}
          </span>
          <span className="block text-xs text-[color:var(--color-text-muted)]">
            {row.tenantId?.roomId?.roomNumber ? `Room ${row.tenantId.roomId.roomNumber}` : '—'}
          </span>
        </div>
      ),
    },
    {
      header: 'Month',
      accessor: (row) => row.month,
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)] tabular-nums">
          {fmtMoney(row.totalAmount)}
        </span>
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
          onView={() => router.push(`/invoices/${row._id}`)}
          onEdit={() => router.push(`/invoices/${row._id}/edit`)}
          showDelete={row.status !== 'paid'}
          onDelete={row.status !== 'paid' ? () => setDeleteTarget(row) : undefined}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Generate, track, and collect tenant invoices"
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

      <ErrorBanner message={error} />

      {/* KPI strip */}
      <KpiHeader
        items={[
          {
            label: `Collected · ${summary?.month ?? 'this month'}`,
            value: fmtMoney(summary?.collected ?? 0),
            delta: delta(summary?.collected ?? 0, prevSummary?.collected),
            tone: 'success',
          },
          {
            label: `Expected · ${summary?.month ?? 'this month'}`,
            value: fmtMoney(summary?.expected ?? 0),
            delta: delta(summary?.expected ?? 0, prevSummary?.expected),
            tone: 'brand',
          },
          {
            label: 'Outstanding balance',
            value: agingLoading ? '—' : fmtMoney(aging?.totalOutstanding ?? 0),
            sub: agingLoading
              ? undefined
              : `${agingBuckets.reduce((s, b) => s + b.count, 0)} open invoice(s)`,
            tone: 'warning',
          },
          {
            label: `Pending · ${summary?.month ?? 'this month'}`,
            value: fmtMoney(summary?.pending ?? 0),
            sub:
              summary && summary.expected > 0
                ? `${Math.max(0, Math.round((1 - summary.collected / summary.expected) * 100))}% uncollected`
                : undefined,
            tone: (summary?.pending ?? 0) > 0 ? 'danger' : 'success',
          },
        ]}
      />

      {/* Aging + trend row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AgingBars
            buckets={agingBuckets}
            totalOutstanding={aging?.totalOutstanding ?? 0}
            isLoading={agingLoading}
            onSelect={onAgingSelect}
          />
        </div>
        <div className={clsx(surfaceCardClass, 'p-5 lg:col-span-2')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                <TrendingUp className="mr-1.5 inline h-4 w-4 text-[color:var(--color-brand-500)]" />
                Collection trend
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                Collected vs expected, last 6 months
              </p>
            </div>
          </div>
          <div className="mt-4">
            {trendLoading ? (
              <div className="flex h-[160px] items-center justify-center text-xs font-medium text-[color:var(--color-text-muted)]">
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

      <DataTable
        columns={columns}
        data={visibleInvoices}
        keyExtractor={(row: InvoiceRow) => row._id}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search invoice, tenant, room, month..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        bulkActions={
          <>
            <Button size="sm" variant="outline" onClick={handleBulkMarkSent}>
              <Send className="h-3.5 w-3.5" />
              Mark sent
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCsv}>
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
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <DatePicker
              type="month"
              aria-label="Filter by month"
              value={monthFilter}
              onChange={(val: string) => {
                setMonthFilter(val);
                setPage(1);
              }}
              className="w-[170px]"
            />
            <ResourceSelect
              endpoint="tenants"
              value={tenantFilter}
              onChange={(val) => {
                setTenantFilter(val);
                setTenantFilterLabel('');
                setPage(1);
              }}
              placeholder="All Tenants"
              valueKey="_id"
              labelKey={tenantLabel}
              dataPath="data"
              className="w-[220px]"
            />
            <FilterChips chips={chips} onClearAll={clearAllFilters} />
          </div>
        }
        emptyState={
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="No invoices yet"
            description="Generate your first invoice to get started"
            action={{ label: 'Generate Invoice', onClick: () => router.push('/invoices/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.invoiceNumber}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.tenantId?.userId?.name ?? 'N/A'}</span>
              <span>{row.month}</span>
              <span>{fmtMoney(row.totalAmount)}</span>
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

      {/* Bulk generate modal */}
      <Modal
        open={bulkGenerateOpen}
        onClose={() => setBulkGenerateOpen(false)}
        title="Bulk generate invoices"
        description="Creates invoices for every active tenant for the selected month. Existing invoices are skipped."
        loading={bulkLoading}
        footer={
          <>
            <Button variant="outline" disabled={bulkLoading} onClick={() => setBulkGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={bulkLoading}
              disabled={!bulkMonth}
              onClick={handleBulkGenerate}
            >
              <Wand2 className="h-4 w-4" />
              Generate All
            </Button>
          </>
        }
      >
        <div className={clsx(surfaceNestedClass, 'flex items-center gap-3 p-4')}>
          <LayoutGrid className="h-4 w-4 shrink-0 text-[color:var(--color-brand-500)]" />
          <DatePicker
            type="month"
            aria-label="Bulk invoice month"
            value={bulkMonth}
            onChange={(val: string) => setBulkMonth(val)}
            placeholder="Select month..."
            className="w-full"
          />
        </div>
        <p className="mt-3 text-xs font-medium text-[color:var(--color-text-muted)]">
          Line items are seeded from each tenant&apos;s monthly rent plus any finalized electricity
          share for the month.
        </p>
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
        message="Are you sure you want to delete this invoice? This action cannot be undone."
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
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <InvoicesContent />
    </Suspense>
  );
}

