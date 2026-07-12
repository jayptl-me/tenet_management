'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { TodayAttendanceBoard } from '@/components/ui/TodayAttendanceBoard';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);
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
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`attendance/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchRecords();
    } catch {
      setError('Failed to delete attendance record');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<AttendanceRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {row.tenant?.user?.name ?? 'N/A'}
        </span>
      ),
    },
    { header: 'Room', accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A' },
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
        <TableActions
          onView={() => router.push(`/attendance/${row._id}`)}
          onEdit={() => router.push(`/attendance/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Track daily tenant attendance"
        action={
          <Button onClick={() => router.push('/attendance/new')}>
            <Plus className="h-4 w-4" />
            Mark Attendance
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <TodayAttendanceBoard />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by tenant name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
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
        emptyState={
          <EmptyState
            icon={<ClipboardCheck className="h-12 w-12" />}
            title="No attendance records yet"
            description="Mark your first attendance record to get started"
            action={{ label: 'Mark Attendance', onClick: () => router.push('/attendance/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.tenant?.user?.name ?? 'N/A'}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.tenant?.room?.roomNumber ?? 'N/A'}</span>
              <span>
                {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
              {row.checkInTime && (
                <span>
                  In:{' '}
                  {new Date(row.checkInTime).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {row.checkOutTime && (
                <span>
                  Out:{' '}
                  {new Date(row.checkOutTime).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/attendance/${row._id}`)}
                onEdit={() => router.push(`/attendance/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
