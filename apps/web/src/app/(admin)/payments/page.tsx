'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Receipt, CheckCircle, XCircle, ShieldCheck, IndianRupee } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';
import { tenantDisplayName, tenantRoomNumber, type PopulatedTenantRef } from '@/lib/api-shapes';

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

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_verification', label: 'Pending verification' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

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
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<PaymentMonthSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<PaymentRow | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api
        .get('payments/summary')
        .json<{ success: boolean; data: PaymentMonthSummary }>();
      if (res.success) {
        setSummary(res.data);
      }
    } catch {
      // Summary load failure is non-blocking
    }
  }, []);

  const handleVerify = async (approved: boolean) => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      await api
        .post(`payments/${verifyTarget._id}/verify`, {
          json: { approved, notes: verifyNotes.trim() || undefined },
        })
        .json();
      setVerifyTarget(null);
      fetchPayments();
      fetchSummary();
    } catch {
      setError('Failed to process payment verification');
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

      const res = await api.get(`payments?${params.toString()}`).json<{
        success: boolean;
        data: PaymentRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setPayments(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, methodFilter, typeFilter, statusFilter]);

  useEffect(() => {
    fetchPayments();
    fetchSummary();
  }, [fetchPayments, fetchSummary]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`payments/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchPayments();
      fetchSummary();
    } catch {
      setError('Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {tenantDisplayName(row.tenantId)}
        </span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => tenantRoomNumber(row.tenantId),
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          ₹{row.amount.toLocaleString('en-IN')}
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
      header: 'Type',
      accessor: (row) => <span className="capitalize">{row.type ?? 'N/A'}</span>,
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
                    icon: (
                      <CheckCircle className="h-3.5 w-3.5 text-[color:var(--color-success-600)]" />
                    ),
                    onClick: () => {
                      setVerifyTarget(row);
                      setVerifyNotes('');
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
        description="Track rent and other payments across tenants"
        action={
          <Button onClick={() => router.push('/payments/new')}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title={`Collected (${summary.month})`}
            value={`₹${summary.collected.toLocaleString('en-IN')}`}
            variant="success"
            icon={<CheckCircle className="h-5 w-5 text-[color:var(--color-success-600)]" />}
          />
          <StatCard
            title={`Expected (${summary.month})`}
            value={`₹${summary.expected.toLocaleString('en-IN')}`}
            variant="brand"
            icon={<Receipt className="h-5 w-5 text-[color:var(--color-brand-600)]" />}
          />
          <StatCard
            title={`Pending (${summary.month})`}
            value={`₹${summary.pending.toLocaleString('en-IN')}`}
            variant={summary.pending > 0 ? 'warning' : 'default'}
            icon={<IndianRupee className="h-5 w-5 text-[color:var(--color-warning-600)]" />}
          />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select
            label="Method"
            options={METHOD_FILTERS}
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-44">
          <Select
            label="Type"
            options={TYPE_FILTERS}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-48">
          <Select
            label="Status"
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button
          variant={statusFilter === 'pending_verification' ? 'primary' : 'outline'}
          onClick={() => {
            setStatusFilter(statusFilter === 'pending_verification' ? '' : 'pending_verification');
            setPage(1);
          }}
        >
          Pending verification
        </Button>
      </div>

      {!isLoading && payments.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="No payments found"
          description="Record an offline payment or wait for UPI submissions."
          action={{
            label: 'Record Payment',
            onClick: () => router.push('/payments/new'),
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          keyExtractor={(row) => row._id}
          isLoading={isLoading}
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
          onRowClick={(row) => router.push(`/payments/${row._id}`)}
          mobileCardRenderer={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {tenantDisplayName(row.tenantId)}
                </span>
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
                <span className="font-semibold text-[color:var(--color-text-primary)]">
                  Rs. {row.amount.toLocaleString('en-IN')}
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
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/payments/${row._id}`)}
                  onEdit={() => router.push(`/payments/${row._id}/edit`)}
                  showDelete={false}
                />
              </div>
            </div>
          )}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete payment?"
        message="This cannot be undone. Paid payments may be blocked by the API."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[color:var(--color-text-primary)]">
                  Verify UPI Payment
                </h3>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  {tenantDisplayName(verifyTarget.tenantId)} · Room {tenantRoomNumber(verifyTarget.tenantId)}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-[color:var(--color-surface-50)] p-3 border border-[color:var(--border-color)] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[color:var(--color-text-muted)]">Amount:</span>
                <span className="font-bold text-[color:var(--color-text-primary)]">
                  ₹{verifyTarget.amount.toLocaleString('en-IN')}
                </span>
              </div>
              {verifyTarget.utrNumber && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--color-text-muted)]">UTR Number:</span>
                  <span className="font-mono font-bold text-[color:var(--color-brand-700)]">
                    {verifyTarget.utrNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[color:var(--color-text-muted)]">Submitted Date:</span>
                <span>
                  {new Date(verifyTarget.paidAt || verifyTarget.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[color:var(--color-text-secondary)] mb-1">
                Verification Note (Optional)
              </label>
              <input
                type="text"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="e.g. Bank statement matched"
                className="w-full rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[color:var(--color-brand-500)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                disabled={verifying}
                onClick={() => setVerifyTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={verifying}
                loading={verifying}
                onClick={() => handleVerify(false)}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="primary"
                disabled={verifying}
                loading={verifying}
                onClick={() => handleVerify(true)}
              >
                <CheckCircle className="h-4 w-4" />
                Approve Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
