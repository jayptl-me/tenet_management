'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface LeaveRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  createdAt: string;
}

export default function LeavesPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`leaves?${params.toString()}`).json<{
        success: boolean;
        data: LeaveRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setLeaves(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load leave applications');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const columns: DataTableColumn<LeaveRow>[] = [
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
      header: 'Start',
      accessor: (row) =>
        new Date(row.startDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      header: 'End',
      accessor: (row) =>
        new Date(row.endDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      header: 'Reason',
      accessor: (row) => (
        <span className="text-surface-500 block max-w-[200px] truncate text-xs">
          {row.reason ?? '—'}
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/leaves/${row._id}`);
          }}
          className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors duration-[var(--transition-duration)]"
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      ),
      className: 'w-[80px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Leave Applications
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Approve or reject tenant leave requests</p>
        </div>
        <Button onClick={() => router.push('/leaves/new')}>
          <Plus className="h-4 w-4" />
          New Leave
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
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
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
        data={leaves}
        keyExtractor={(row: LeaveRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/leaves/${row._id}`)}
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
    </div>
  );
}
