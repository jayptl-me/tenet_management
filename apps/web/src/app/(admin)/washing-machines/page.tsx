'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, WashingMachine, Timer, User, Building2 } from 'lucide-react';
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

interface MachineRow {
  _id: string;
  machineNumber: number;
  label: string;
  status: string;
  floorLabel?: string;
  floorNumber?: number;
  currentUser?: { name?: string; room?: string } | null;
  timerEndsAt?: string | null;
  notes?: string;
}

export default function WashingMachinesPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MachineRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMachines = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`washing-machines?${params.toString()}`).json<{
        success: boolean;
        data: MachineRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setMachines(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load washing machines');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const handleRelease = async (id: string) => {
    try {
      await api.post(`washing-machines/${id}/release`).json();
      fetchMachines();
    } catch {
      setError('Failed to release machine');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`washing-machines/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchMachines();
    } catch {
      setError('Failed to delete washing machine');
    } finally {
      setDeleting(false);
    }
  };


  const columns: DataTableColumn<MachineRow>[] = [
    {
      header: 'Machine',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {row.label || `Machine ${row.machineNumber}`}
          </span>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            #{row.machineNumber}
          </p>
        </div>
      ),
    },
    {
      header: 'Floor',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Building2 className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
          {row.floorLabel ?? `Floor ${row.floorNumber ?? '—'}`}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge variant={statusToVariant(row.status)} label={row.status.replace(/_/g, ' ')} />
      ),
    },
    {
      header: 'Claimed By',
      accessor: (row) =>
        row.currentUser ? (
          <div>
            <span className="flex items-center gap-1 text-sm font-medium text-[color:var(--color-text-primary)]">
              <User className="h-3 w-3" /> {row.currentUser.name}
            </span>
            <p className="text-xs text-[color:var(--color-text-muted)]">Room {row.currentUser.room}</p>
          </div>
        ) : (
          <span className="text-sm text-[color:var(--color-text-muted)]">—</span>
        ),
    },
    {
      header: 'Timer',
      accessor: (row) =>
        row.timerEndsAt ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--color-text-secondary)]">
            <Timer className="h-3 w-3" />
            {new Date(row.timerEndsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-sm text-[color:var(--color-text-muted)]">—</span>
        ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'in_use' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRelease(row._id);
              }}
              className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
              title="Release machine"
            >
              <Timer className="h-3 w-3" />
              Release
            </button>
          )}
          <TableActions
            onView={() => router.push(`/washing-machines/${row._id}`)}
            onEdit={() => router.push(`/washing-machines/${row._id}/edit`)}
            onDelete={() => setDeleteTarget(row)}
          />
        </div>
      ),
      className: 'w-[200px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Washing Machines"
        description="Manage per-floor washing machines"
        action={
          <Button onClick={() => router.push('/washing-machines/new')}>
            <Plus className="h-4 w-4" />
            Add Machine
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'available', label: 'Available' },
            { value: 'in_use', label: 'In Use' },
            { value: 'under_maintenance', label: 'Under Maintenance' },
            { value: 'down', label: 'Down' },
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
        data={machines}
        keyExtractor={(row) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/washing-machines/${row._id}`)}
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
            icon={<WashingMachine className="h-12 w-12" />}
            title="No washing machines yet"
            description="Add your first washing machine for a floor"
            action={{ label: 'Add Machine', onClick: () => router.push('/washing-machines/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.label || `Machine ${row.machineNumber}`}
              </span>
              <StatusBadge variant={statusToVariant(row.status)} label={row.status.replace(/_/g, ' ')} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {row.floorLabel ?? `Floor ${row.floorNumber ?? '—'}`}
              </span>
              {row.currentUser && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {row.currentUser.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/washing-machines/${row._id}`)}
                onEdit={() => router.push(`/washing-machines/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Washing Machine"
        message={`Are you sure you want to delete "${deleteTarget?.label || `Machine ${deleteTarget?.machineNumber}`}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
