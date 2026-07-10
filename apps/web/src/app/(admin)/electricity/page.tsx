'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
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
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.month}</span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          ₹{row.totalBillAmount.toLocaleString()}
        </span>
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
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-text-muted)]">
          {row.notes ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/electricity/${row._id}`)}
          onEdit={() => router.push(`/electricity/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Electricity Bills"
        description="Track electricity usage and billing by month"
        action={
          <Button onClick={() => router.push('/electricity/new')}>
            <Plus className="h-4 w-4" />
            Record Bill
          </Button>
        }
      />

      <ErrorBanner message={error} />

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
        onRowClick={(row) => router.push(`/electricity/${row._id}`)}
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
            icon={<Zap className="h-12 w-12" />}
            title="No electricity bills yet"
            description="Record your first electricity bill to get started"
            action={{ label: 'Record Bill', onClick: () => router.push('/electricity/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.month}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>₹{row.totalBillAmount.toLocaleString()}</span>
              <span>{row.roomEntries?.length ?? 0} rooms</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/electricity/${row._id}`)}
                onEdit={() => router.push(`/electricity/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Electricity Bill"
        message="Are you sure you want to delete this electricity bill? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
