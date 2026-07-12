'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, DoorOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusFilterSelect } from '@/components/ui/StatusFilterSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface VisitorRow {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  actualArrival?: string;
  actualDeparture?: string;
  status: string;
  createdAt: string;
}

export default function VisitorsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VisitorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVisitors = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`visitors?${params.toString()}`).json<{
        success: boolean;
        data: VisitorRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setVisitors(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load visitors');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`visitors/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchVisitors();
    } catch {
      setError('Failed to delete visitor');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<VisitorRow>[] = [
    {
      header: 'Visitor',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.name}</span>
      ),
    },
    {
      header: 'Phone',
      accessor: (row) => row.phone,
    },
    {
      header: 'Purpose',
      accessor: (row) => <span className="capitalize">{row.purpose}</span>,
    },
    {
      header: 'Tenant',
      accessor: (row) => row.tenant?.user?.name ?? 'N/A',
    },
    {
      header: 'Check In',
      accessor: (row) =>
        row.actualArrival
          ? new Date(row.actualArrival).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      header: 'Check Out',
      accessor: (row) =>
        row.actualDeparture
          ? new Date(row.actualDeparture).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
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
          onView={() => router.push(`/visitors/${row._id}`)}
          onEdit={() => router.push(`/visitors/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Track visitor entries and exits"
        action={
          <Button onClick={() => router.push('/visitors/new')}>
            <Plus className="h-4 w-4" />
            Register Visitor
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatusFilterSelect
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          statuses={['expected', 'arrived', 'departed', 'cancelled']}
          className="max-w-[200px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={visitors}
        keyExtractor={(row: VisitorRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/visitors/${row._id}`)}
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
            icon={<DoorOpen className="h-12 w-12" />}
            title="No visitors yet"
            description="Register your first visitor to get started"
            action={{ label: 'Register Visitor', onClick: () => router.push('/visitors/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.name}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span className="capitalize">{row.purpose}</span>
              <span>{row.tenant?.user?.name ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/visitors/${row._id}`)}
                onEdit={() => router.push(`/visitors/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Visitor"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
