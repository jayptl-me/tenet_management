'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, FileText } from 'lucide-react';
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

interface InvoiceRow {
  _id: string;
  invoiceNumber: string;
  tenantId?: { userId?: { name?: string }; roomId?: { roomNumber?: string } };
  totalAmount: number;
  rentAmount?: number;
  month: string;
  status: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`invoices?${params.toString()}`).json<{
        success: boolean;
        data: InvoiceRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`invoices/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchInvoices();
    } catch {
      setError('Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      accessor: (row) => (
        <span className="text-[color:var(--color-text-primary)] font-mono font-semibold">{row.invoiceNumber}</span>
      ),
    },
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="text-[color:var(--color-text-primary)] font-semibold">
          {row.tenantId?.userId?.name ?? 'N/A'}
        </span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => row.tenantId?.roomId?.roomNumber ?? 'N/A',
    },
    {
      header: 'Month',
      accessor: (row) => row.month,
    },
    {
      header: 'Amount',
      accessor: (row) => `₹${(row.totalAmount ?? 0).toLocaleString()}`,
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
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/invoices/${row._id}`);
            }}
            className="text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/invoices/${row._id}/edit`);
            }}
            className="text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-[color:var(--color-danger-600)] hover:bg-[color:var(--color-danger-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
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
        title="Invoices"
        description="Manage tenant invoices and payments"
        action={
          <Button onClick={() => router.push('/invoices/new')}>
            <Plus className="h-4 w-4" />
            Generate Invoice
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'partial', label: 'Partially Paid' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        keyExtractor={(row: InvoiceRow) => row._id}
        isLoading={isLoading}
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
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm font-mono">
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
              <span>₹{(row.totalAmount ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/invoices/${row._id}`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-100)]"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/invoices/${row._id}/edit`); }}
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
        title="Delete Invoice"
        message={`Are you sure you want to delete this invoice? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
