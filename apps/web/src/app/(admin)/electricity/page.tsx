'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';

interface RoomEntry {
  roomId?: { roomNumber?: string };
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

interface ElectricityBillRow {
  _id: string;
  month: string;
  totalBillAmount: number;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  createdAt: string;
}

export default function ElectricityPage() {
  const router = useRouter();
  const [bills, setBills] = useState<ElectricityBillRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ElectricityBillRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`electricity?${params.toString()}`).json<{
        success: boolean;
        data: ElectricityBillRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setBills(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load electricity bills');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`electricity/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchBills();
    } catch {
      setError('Failed to delete electricity bill');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<ElectricityBillRow>[] = [
    {
      header: 'Month',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">{row.month}</span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">₹{row.totalBillAmount.toLocaleString()}</span>
      ),
    },
    {
      header: 'Rooms',
      accessor: (row) => `${row.roomEntries?.length ?? 0}`,
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
      header: 'Notes',
      accessor: (row) => (
        <span className="text-surface-500 block max-w-[200px] truncate text-xs">
          {row.notes ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/electricity/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/electricity/${row._id}/edit`);
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
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Electricity Bills
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Track electricity usage and billing by month</p>
        </div>
        <Button onClick={() => router.push('/electricity/new')}>
          <Plus className="h-4 w-4" />
          Record Bill
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
            { value: 'finalized', label: 'Finalized' },
            { value: 'distributed', label: 'Distributed' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={bills}
        keyExtractor={(row: ElectricityBillRow) => row._id}
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
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Electricity Bill"
        message={`Are you sure you want to delete this electricity bill? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
