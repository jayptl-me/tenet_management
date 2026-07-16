'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
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
  const [bulkMonth, setBulkMonth] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

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
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || 'Failed to delete invoice');
      toast.error(parsed.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
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
        fetchInvoices();
      }
    } catch {
      toast.error('Failed to generate invoices');
    } finally {
      setBulkLoading(false);
    }
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
        <span className="font-semibold text-[color:var(--color-text-primary)]">
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
        description="Manage tenant invoices and payments"
        action={
          <Button onClick={() => router.push('/invoices/new')}>
            <Plus className="h-4 w-4" />
            Generate Invoice
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-sm)]">
        <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
          Bulk Generate Invoices
        </p>
        <div className="flex items-center gap-3">
          <Input
            placeholder="YYYY-MM"
            value={bulkMonth}
            onChange={(e) => setBulkMonth(e.target.value)}
            className="max-w-[160px]"
            maxLength={7}
          />
          <Button
            variant="outline"
            size="sm"
            loading={bulkLoading}
            disabled={!bulkMonth || bulkLoading}
            onClick={handleBulkGenerate}
          >
            <Wand2 className="mr-1 h-3.5 w-3.5" />
            Generate All
          </Button>
        </div>
      </div>

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
              <span>₹{(row.totalAmount ?? 0).toLocaleString()}</span>
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
