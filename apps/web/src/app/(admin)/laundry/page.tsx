'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Shirt } from 'lucide-react';
import { api } from '@/lib/api';
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
import { useRouter } from 'next/navigation';

interface LaundryRow {
  _id: string;
  tenant?: { _id: string; user?: { name: string }; room?: { roomNumber: string } };
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

export default function LaundryPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<LaundryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LaundryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`laundry-slots?${params.toString()}`).json<{
        success: boolean;
        data: LaundryRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setSlots(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load laundry slots');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleStatusUpdate = async (id: string, status: string) => {
    setIsUpdating(true);
    try {
      await api.put(`laundry-slots/${id}`, { json: { status } }).json();
      fetchSlots();
    } catch {
      setError('Failed to update slot status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`laundry-slots/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchSlots();
    } catch {
      setError('Failed to delete laundry slot');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<LaundryRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {row.tenant?.user?.name ?? 'N/A'}
          </span>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Room {row.tenant?.room?.roomNumber ?? '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (row) =>
        new Date(row.slotDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
    },
    {
      header: 'Time',
      accessor: (row) => row.slotTime,
    },
    {
      header: 'Items',
      accessor: (row) => (row.items != null ? String(row.items) : '—'),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge variant={statusToVariant(row.status)} label={row.status.replace(/_/g, ' ')} />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'booked' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(row._id, 'completed');
              }}
              className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-success-600)] transition-colors hover:bg-[color:var(--color-success-50)]"
              title="Mark completed"
              disabled={isUpdating}
            >
              <CheckCircle className="h-3 w-3" />
            </button>
          )}
          {(row.status === 'booked' ||
            row.status === 'completed' ||
            row.status === 'confirmed') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(row._id, 'cancelled');
              }}
              className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
              title="Cancel slot"
              disabled={isUpdating}
            >
              <XCircle className="h-3 w-3" />
            </button>
          )}
          <TableActions
            onView={() => router.push(`/laundry/${row._id}`)}
            onEdit={() => router.push(`/laundry/${row._id}/edit`)}
            onDelete={() => setDeleteTarget(row)}
          />
        </div>
      ),
      className: 'w-[180px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laundry Slots"
        description="Manage laundry slot bookings"
        action={
          <Button onClick={() => router.push('/laundry/new')}>
            <Plus className="h-4 w-4" />
            New Slot
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'booked', label: 'Booked' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'completed', label: 'Completed' },
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
        data={slots}
        keyExtractor={(row: LaundryRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/laundry/${row._id}`)}
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
            icon={<Shirt className="h-12 w-12" />}
            title="No laundry slots yet"
            description="Book your first laundry slot to get started"
            action={{ label: 'New Slot', onClick: () => router.push('/laundry/new') }}
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
                label={row.status.replace(/_/g, ' ')}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>
                {new Date(row.slotDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span>{row.slotTime}</span>
              <span>{row.items != null ? `${row.items} items` : '—'}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/laundry/${row._id}`)}
                onEdit={() => router.push(`/laundry/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Laundry Slot"
        message="Are you sure you want to delete this laundry slot? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
