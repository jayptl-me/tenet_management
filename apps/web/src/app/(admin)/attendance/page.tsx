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

interface AttendanceRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  createdAt: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`attendance?${params.toString()}`).json<{
        success: boolean;
        data: AttendanceRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setRecords(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load attendance records');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const columns: DataTableColumn<AttendanceRow>[] = [
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
      header: 'Date',
      accessor: (row) =>
        new Date(row.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
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
      header: 'Check In',
      accessor: (row) =>
        row.checkInTime
          ? new Date(row.checkInTime).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      header: 'Check Out',
      accessor: (row) =>
        row.checkOutTime
          ? new Date(row.checkOutTime).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/attendance/${row._id}`);
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
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Attendance</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Track daily tenant attendance</p>
        </div>
        <Button onClick={() => router.push('/attendance/new')}>
          <Plus className="h-4 w-4" />
          Mark Attendance
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
            { value: 'present', label: 'Present' },
            { value: 'absent', label: 'Absent' },
            { value: 'on_leave', label: 'On Leave' },
            { value: 'late', label: 'Late' },
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
        data={records}
        keyExtractor={(row: AttendanceRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/attendance/${row._id}`)}
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
