'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
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

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      accessor: (row) => (
        <span className="text-surface-900 font-mono font-semibold">{row.invoiceNumber}</span>
      ),
    },
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">
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
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/invoices/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[90px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Invoices</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Manage tenant invoices and payments</p>
        </div>
        <Button onClick={() => router.push('/invoices/new')}>
          <Plus className="h-4 w-4" />
          Generate Invoice
        </Button>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

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
      />
    </div>
  );
}
