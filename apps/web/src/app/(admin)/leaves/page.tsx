'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`leaves/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchLeaves();
    } catch {
      setError('Failed to delete leave application');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<LeaveRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => <span className="text-[color:var(--color-text-primary)] font-semibold">{row.tenant?.user?.name ?? 'N/A'}</span>,
    },
    { header: 'Room', accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A' },
    { header: 'Start', accessor: (row) => new Date(row.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { header: 'End', accessor: (row) => new Date(row.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { header: 'Reason', accessor: (row) => <span className="text-[color:var(--color-text-muted)] block max-w-[200px] truncate text-xs">{row.reason ?? '—'}</span> },
    { header: 'Status', accessor: (row) => <StatusBadge variant={statusToVariant(row.status)} label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'} /> },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/leaves/${row._id}`); }} className="text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors" title="View"><Eye className="h-3 w-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); router.push(`/leaves/${row._id}/edit`); }} className="text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors" title="Edit"><Pencil className="h-3 w-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }} className="text-[color:var(--color-danger-600)] hover:bg-[color:var(--color-danger-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors" title="Delete"><Trash2 className="h-3 w-3" /></button>
        </div>
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select options={[{ value: '', label: 'All Statuses' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' }]} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="max-w-[200px]" />
      </div>
      <DataTable
        columns={columns}
        data={leaves}
        keyExtractor={(row: LeaveRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/leaves/${row._id}`)}
        pagination={{ page, perPage, total, onPageChange: setPage, onPerPageChange: (pp) => { setPerPage(pp); setPage(1); } }}
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
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                {row.tenant?.user?.name ?? 'N/A'}
              </span>
              <StatusBadge variant={statusToVariant(row.status)} label={row.status?.replace(/_/g, ' ') ?? 'Unknown'} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{new Date(row.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              <span>→</span>
              <span>{new Date(row.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button onClick={(e) => { e.stopPropagation(); router.push(`/leaves/${row._id}`); }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]">
                <Eye className="h-3 w-3" /> View
              </button>
              <button onClick={(e) => { e.stopPropagation(); router.push(`/leaves/${row._id}/edit`); }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)]">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          </div>
        )}
      />
      <ConfirmModal open={!!deleteTarget} title="Delete Leave Application" message={`Are you sure you want to delete this leave application? This action cannot be undone.`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
