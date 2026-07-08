'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface TenantRow {
  _id: string;
  user?: { name: string; email: string; phone: string; _id: string };
  room?: { roomNumber: string };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  isActive: boolean;
  moveInDate: string;
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter);

      const res = await api.get(`tenants?${params.toString()}`).json<{
        success: boolean;
        data: TenantRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setTenants(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`tenants/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchTenants();
    } catch {
      setError('Failed to delete tenant');
      setDeleting(false);
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<TenantRow>[] = [
    {
      header: 'Name',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">{row.user?.name ?? 'N/A'}</span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => `${row.room?.roomNumber ?? 'N/A'} (Bed ${row.bedId})`,
    },
    {
      header: 'Contact',
      accessor: (row) => (
        <div className="flex flex-col text-xs">
          <span>{row.user?.email ?? 'N/A'}</span>
          <span className="text-surface-400">{row.user?.phone ?? 'N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Rent',
      accessor: (row) => `₹${row.monthlyRent.toLocaleString()}`,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'checked_out')}
          label={row.isActive ? 'Active' : 'Checked Out'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/tenants/${row._id}`); }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/tenants/${row._id}/edit`); }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[120px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage all PG residents"
        action={
          <Button onClick={() => router.push('/tenants/new')}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        }
      />
      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Search by name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select options={[{ value: '', label: 'All Status' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Checked Out' }]} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="max-w-[180px]" />
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        keyExtractor={(row: TenantRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/tenants/${row._id}`)}
        pagination={{ page, perPage, total, onPageChange: (p) => setPage(p), onPerPageChange: (pp) => { setPerPage(pp); setPage(1); } }}
        emptyState={
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No tenants yet"
            description="Add your first tenant to get started"
            action={{ label: 'Add Tenant', onClick: () => router.push('/tenants/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                {row.user?.name ?? 'N/A'}
              </span>
              <StatusBadge
                variant={statusToVariant(row.isActive ? 'active' : 'checked_out')}
                label={row.isActive ? 'Active' : 'Checked Out'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.room?.roomNumber ? `Room ${row.room.roomNumber}` : 'No Room'}</span>
              <span>₹{row.monthlyRent.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/tenants/${row._id}`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] transition-colors hover:bg-[color:var(--color-surface-100)]"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/tenants/${row._id}/edit`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Tenant"
        message={deleteTarget?.user?.name ? `Are you sure you want to delete "${deleteTarget.user.name}"? This action cannot be undone.` : 'Are you sure you want to delete this tenant? This action cannot be undone.'}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
