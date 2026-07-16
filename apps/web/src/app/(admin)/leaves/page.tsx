'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CalendarClock } from 'lucide-react';
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
import { useRouter } from 'next/navigation';
import { parseApiError } from '@/lib/errorParser';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search.trim()) params.set('search', search.trim());
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
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`leaves/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchLeaves();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<LeaveRow>[] = [
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
      header: 'Period',
      accessor: (row) => {
        const fmt = (d: string) =>
          new Date(d).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        return `${fmt(row.startDate)} - ${fmt(row.endDate)}`;
      },
    },
    {
      header: 'Reason',
      accessor: (row) => (
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-text-muted)]">
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
        <TableActions
          onView={() => router.push(`/leaves/${row._id}`)}
          onEdit={() => router.push(`/leaves/${row._id}/edit`)}
          showEdit
          showDelete={row.status === 'pending'}
          onDelete={row.status === 'pending' ? () => setDeleteTarget(row) : undefined}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Applications"
        description="Approve or reject tenant leave requests"
        action={
          <Button onClick={() => router.push('/leaves/new')}>
            <Plus className="h-4 w-4" />
            New Leave
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
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
        emptyState={
          <EmptyState
            icon={<CalendarClock className="h-12 w-12" />}
            title="No leave applications yet"
            description="Submit your first leave application to get started"
            action={{ label: 'New Leave', onClick: () => router.push('/leaves/new') }}
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
                label={row.status?.replace(/_/g, ' ') ?? 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>
                {new Date(row.startDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span className="text-[color:var(--color-text-secondary)]">{'→'}</span>
              <span>
                {new Date(row.endDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/leaves/${row._id}`)}
                onEdit={() => router.push(`/leaves/${row._id}/edit`)}
                showDelete={row.status === 'pending'}
                onDelete={row.status === 'pending' ? () => setDeleteTarget(row) : undefined}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Leave Application"
        message="Are you sure you want to delete this leave application? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
