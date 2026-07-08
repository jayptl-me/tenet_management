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

interface PaymentRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  amount: number;
  method: string;
  type: string;
  status: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [modeFilter, setModeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
      if (modeFilter) params.set('mode', modeFilter);
      if (categoryFilter) params.set('category', categoryFilter);

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
  }, [page, perPage, modeFilter, categoryFilter]);

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
        <span className="text-surface-900 font-semibold">{row.tenant?.user?.name ?? 'N/A'}</span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A',
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">₹{row.amount.toLocaleString()}</span>
      ),
    },
    {
      header: 'Mode',
      accessor: (row) => (
        <span className="capitalize">
          {row.method ? row.method.replace(/_/g, ' ') : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Category',
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
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/payments/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track all rent and service payments"
        action={
          <Button onClick={() => router.push('/payments/new')}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Modes' },
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
          ]}
          value={modeFilter}
          onChange={(e) => {
            setModeFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'All Categories' },
            { value: 'rent', label: 'Rent' },
            { value: 'deposit', label: 'Deposit' },
            { value: 'electricity', label: 'Electricity' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'laundry', label: 'Laundry' },
            { value: 'other', label: 'Other' },
          ]}
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={payments}
        keyExtractor={(row: PaymentRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/payments/${row._id}`)}
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
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title="No payments yet"
            description="Record your first payment to get started"
            action={{ label: 'Record Payment', onClick: () => router.push('/payments/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                ₹{row.amount.toLocaleString()}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.tenant?.user?.name ?? 'N/A'}</span>
              <span>{row.tenant?.room?.roomNumber ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span className="capitalize">{row.method ? row.method.replace(/_/g, ' ') : 'N/A'}</span>
              <span>{new Date(row.paidAt || row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/payments/${row._id}`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] transition-colors hover:bg-[color:var(--color-surface-100)]"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/payments/${row._id}/edit`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Payment"
        message={`Are you sure you want to delete this payment? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
