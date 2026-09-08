'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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

function GuardiansList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantIdFilter = searchParams.get('tenantId') ?? '';
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
      if (tenantIdFilter) params.set('tenantId', tenantIdFilter);

      const res = await api.get(`guardians?${params.toString()}`).json<{
        success: boolean;
        data: GuardianRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setGuardians(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, tenantIdFilter]);

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
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<GuardianRow>[] = [
    {
      header: 'Name',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.name}</span>
      ),
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
      header: 'Room',
      accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A',
    },
    {
      header: 'Email',
      accessor: (row) => (
        <span className="text-xs text-[color:var(--color-text-secondary)]">{row.email ?? '—'}</span>
      ),
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
        <TableActions
          onView={() => router.push(`/guardians/${row._id}`)}
          onEdit={() => router.push(`/guardians/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenantIdFilter ? 'Guardians (Filtered by Tenant)' : 'Guardians'}
        description={
          tenantIdFilter
            ? `Showing guardians linked to tenant ${tenantIdFilter}`
            : 'Manage tenant guardians & emergency contacts'
        }
        action={
          <div className="flex items-center gap-2">
            {tenantIdFilter && (
              <Button variant="outline" onClick={() => router.push('/guardians')}>
                Clear Filter
              </Button>
            )}
            <Button
              onClick={() =>
                router.push(
                  tenantIdFilter ? `/guardians/new?tenantId=${tenantIdFilter}` : '/guardians/new',
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add Guardian
            </Button>
          </div>
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
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
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
              <TableActions
                onView={() => router.push(`/guardians/${row._id}`)}
                onEdit={() => router.push(`/guardians/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Deactivate Guardian"
        message={`Deactivate guardian "${deleteTarget?.name}"? They will be marked inactive and lose portal access. You can reinstate them later if needed.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function GuardiansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <GuardiansList />
    </Suspense>
  );
}
