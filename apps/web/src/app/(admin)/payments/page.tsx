'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Receipt, CheckCircle2, ShieldCheck, Download, IndianRupee } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
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
import { StatCard } from '@/components/ui/StatCard';
import {
  VerifyPaymentModal,
  type VerifyPaymentTarget,
} from '@/components/admin/VerifyPaymentModal';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';
import {
  tenantDisplayName,
  tenantRoomNumber,
  tenantBedId,
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

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [methodFilter, setMethodFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<PaymentMonthSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<PaymentMonthSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<VerifyPaymentTarget | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const searchInit = useRef(false);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchSummary = useCallback(async () => {
    try {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const [cur, prev] = await Promise.all([
        api.get(`payments/summary?month=${thisMonth}`).json<{
          success: boolean;
          data: PaymentMonthSummary;
        }>(),
        api.get(`payments/summary?month=${prevMonth}`).json<{
          success: boolean;
          data: PaymentMonthSummary;
        }>(),
      ]);
      setSummary(cur.data);
      setPrevSummary(prev.data);
    } catch {
      // Summary load failure is non-blocking
    }
  }, []);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await api.get('payments/status-counts').json<{
        success: boolean;
        data: Record<string, number>;
      }>();
      setStatusCounts(res.data);
    } catch {
      // Status counts load failure is non-blocking
    }
  }, []);

  const handleVerify = async (approved: boolean, notes: string) => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      await api
        .post(`payments/${verifyTarget._id}/verify`, {
          json: { approved, notes: notes || undefined },
        })
        .json();
      toast.success(approved ? 'Payment approved' : 'Payment rejected');
      setVerifyTarget(null);
      fetchPayments();
      fetchSummary();
      fetchStatusCounts();
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setVerifying(false);
    }
  };

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (methodFilter) params.set('method', methodFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await api.get(`payments?${params.toString()}`).json<{
        success: boolean;
        data: PaymentRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setPayments(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, methodFilter, typeFilter, statusFilter, fromDate, toDate, debouncedSearch]);

  useEffect(() => {
    fetchPayments();
    fetchSummary();
    fetchStatusCounts();
  }, [fetchPayments, fetchSummary, fetchStatusCounts]);

  // Client-side search fallback (tenant, UTR, invoice number, amount)
  const visiblePayments = useMemo(() => {
    if (!debouncedSearch) return payments;
    const q = debouncedSearch.toLowerCase();
    return payments.filter((row) => {
      const name = tenantDisplayName(row.tenantId).toLowerCase();
      const room = tenantRoomNumber(row.tenantId).toLowerCase();
      const utr = (row.utrNumber ?? '').toLowerCase();
      const inv = invoiceNumberOf(row).toLowerCase();
      return (
        name.includes(q) ||
        room.includes(q) ||
        utr.includes(q) ||
        inv.includes(q) ||
        String(row.amount).includes(q)
      );
    });
  }, [payments, debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`payments/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      toast.success('Payment deleted');
      fetchPayments();
      fetchSummary();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (methodFilter) params.set('method', methodFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`payments?${params.toString()}`).json<{
        success: boolean;
        data: PaymentRow[];
      }>();
      const exportRows = res.data ?? [];
      if (exportRows.length === 0) return;
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
      const rows = exportRows.map((p) => [
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
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `payments-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
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

  const chips = [
    ...(methodFilter
      ? [
          {
            key: 'method',
            label: 'Method',
            value: METHOD_FILTERS.find((m) => m.value === methodFilter)?.label ?? methodFilter,
            onRemove: () => {
              setMethodFilter('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(typeFilter
      ? [
          {
            key: 'type',
            label: 'Type',
            value: TYPE_FILTERS.find((t) => t.value === typeFilter)?.label ?? typeFilter,
            onRemove: () => {
              setTypeFilter('');
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
              setStatusFilter('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(fromDate
      ? [
          {
            key: 'from',
            label: 'From',
            value: fromDate,
            onRemove: () => {
              setFromDate('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(toDate
      ? [
          {
            key: 'to',
            label: 'To',
            value: toDate,
            onRemove: () => {
              setToDate('');
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
    setMethodFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-(--color-text-primary)">
            {tenantDisplayName(row.tenantId)}
          </span>
          <span className="block text-xs text-(--color-text-muted)">
            {tenantRoomNumber(row.tenantId) !== 'N/A'
              ? `Room ${tenantRoomNumber(row.tenantId)}${tenantBedId(row.tenantId) ? ` · Bed ${tenantBedId(row.tenantId)}` : ''}`
              : '—'}
          </span>
        </div>
      ),
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
        return (
          <div className="space-y-0.5">
            {utr ? (
              <span className="block font-mono text-xs font-bold text-(--color-brand-700)">
                {utr}
              </span>
            ) : (
              <span className="block text-xs text-(--color-text-muted)">No UTR</span>
            )}
            {inv && (
              <span className="text-2xs block font-mono text-(--color-text-muted)">{inv}</span>
            )}
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
    <div className="space-y-6">
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

      {error && <ErrorBanner message={error} />}

      {/* Executive Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Collected · ${summary?.month ?? 'This Month'}`}
          value={fmtMoney(summary?.collected ?? 0)}
          delta={
            summary
              ? {
                  value: delta(summary.collected, prevSummary?.collected).label,
                  direction:
                    (summary.collected ?? 0) >= (prevSummary?.collected ?? 0) ? 'up' : 'down',
                  label: '',
                }
              : undefined
          }
          tone="success"
          icon={<CheckCircle2 />}
        />
        <StatCard
          title={`Expected · ${summary?.month ?? 'This Month'}`}
          value={fmtMoney(summary?.expected ?? 0)}
          delta={
            summary
              ? {
                  value: delta(summary.expected, prevSummary?.expected).label,
                  direction:
                    (summary.expected ?? 0) >= (prevSummary?.expected ?? 0) ? 'up' : 'down',
                  label: '',
                }
              : undefined
          }
          tone="brand"
          icon={<IndianRupee />}
        />
        <StatCard
          title={`Pending · ${summary?.month ?? 'This Month'}`}
          value={fmtMoney(summary?.pending ?? 0)}
          subtitle={
            summary && summary.expected > 0
              ? `${Math.max(0, Math.round((1 - summary.collected / summary.expected) * 100))}% uncollected`
              : undefined
          }
          tone={(summary?.pending ?? 0) > 0 ? 'warning' : 'success'}
          icon={<IndianRupee />}
        />
        <StatCard
          title="Awaiting Verification"
          value={statusCounts.pending_verification ?? 0}
          subtitle="Click to filter to verify queue"
          tone={(statusCounts.pending_verification ?? 0) > 0 ? 'danger' : 'default'}
          icon={<ShieldCheck />}
          onClick={() => {
            setStatusFilter('pending_verification');
            setPage(1);
          }}
        />
      </div>

      {/* Status tab strip */}
      <StatusTabs
        tabs={STATUS_TABS.map((s) => ({
          key: s.key,
          label: s.label,
          count: statusCounts[s.key || 'all'] ?? null,
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
          setStatusFilter(key);
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={visiblePayments}
        keyExtractor={(row) => row._id}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search tenant, UTR, invoice, amount..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          if (searchInit.current) setPage(1);
          searchInit.current = true;
        }}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <Select
                aria-label="Filter by method"
                options={METHOD_FILTERS}
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-40">
              <Select
                aria-label="Filter by type"
                options={TYPE_FILTERS}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={(val: string) => {
                setFromDate(val);
                setPage(1);
              }}
              onToChange={(val: string) => {
                setToDate(val);
                setPage(1);
              }}
              compact
            />
            <Button variant="outline" onClick={handleExportCsv} disabled={payments.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <FilterChips chips={chips} onClearAll={clearAllFilters} />
          </div>
        }
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
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="No payments found"
            description="Record an offline payment or wait for UPI submissions."
            action={{
              label: 'Record Payment',
              onClick: () => router.push('/payments/new'),
            }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-(--color-text-primary)">
                {tenantDisplayName(row.tenantId)}
              </span>
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
        )}
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
