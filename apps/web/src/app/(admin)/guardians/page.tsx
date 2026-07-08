'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface GuardianRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  isEmergencyContact: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function GuardiansPage() {
  const router = useRouter();
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GuardianRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGuardians = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);

      const res = await api.get(`guardians?${params.toString()}`).json<{
        success: boolean;
        data: GuardianRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setGuardians(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load guardians');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`guardians/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchGuardians();
    } catch {
      setError('Failed to delete guardian');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<GuardianRow>[] = [
    {
      header: 'Name',
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.name}</span>,
    },
    {
      header: 'Phone',
      accessor: (row) => row.phone,
    },
    {
      header: 'Relation',
      accessor: (row) => <span className="capitalize">{row.relation}</span>,
    },
    {
      header: 'Tenant',
      accessor: (row) => row.tenant?.user?.name ?? 'N/A',
    },
    {
      header: 'Emergency',
      accessor: (row) => (
        <StatusBadge
          variant={row.isEmergencyContact ? 'success' : 'neutral'}
          label={row.isEmergencyContact ? 'Yes' : 'No'}
        />
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
          label={row.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/guardians/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/guardians/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guardians"
        description="Manage tenant guardians & emergency contacts"
        action={
          <Button onClick={() => router.push('/guardians/new')}>
            <Plus className="h-4 w-4" />
            Add Guardian
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        data={guardians}
        keyExtractor={(row: GuardianRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/guardians/${row._id}`)}
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
            icon={<ShieldCheck className="h-12 w-12" />}
            title="No guardians yet"
            description="Add your first guardian to get started"
            action={{ label: 'Add Guardian', onClick: () => router.push('/guardians/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                {row.name}
              </span>
              <StatusBadge
                variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
                label={row.isActive ? 'Active' : 'Inactive'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.phone}</span>
              <span className="capitalize">{row.relation}</span>
              <span>{row.tenant?.user?.name ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button onClick={(e) => { e.stopPropagation(); router.push(`/guardians/${row._id}`); }} className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] hover:bg-[color:var(--color-surface-100)]">
                <Eye className="h-3 w-3" /> View
              </button>
              <button onClick={(e) => { e.stopPropagation(); router.push(`/guardians/${row._id}/edit`); }} className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)]">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Guardian"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
