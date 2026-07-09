'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';
import {
  tenantDisplayName,
  tenantRoomNumber,
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
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  }, [fetchPayments]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`payments/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchPayments();
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
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/payments/${row._id}`);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-100)]"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/payments/${row._id}/edit`);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
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
            onPerPageChange: setPerPage,
          }}
          onRowClick={(row) => router.push(`/payments/${row._id}`)}
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
    </div>
  );
}
