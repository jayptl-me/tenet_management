'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { LowStockBanner } from '@/components/ui/LowStockBanner';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface AssetRow {
  _id: string;
  name: string;
  category: string;
  location?: string;
  quantity?: number;
  status: string;
  createdAt: string;
}

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lowStockIds, setLowStockIds] = useState<Set<string> | null>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`assets?${params.toString()}`).json<{
        success: boolean;
        data: AssetRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setAssets(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleFilterLowStock = useCallback(async () => {
    if (lowStockIds) {
      setLowStockIds(null);
      return;
    }
    try {
      const res = await api.get('assets/low-stock').json<{
        success: boolean;
        data: { _id: string }[];
      }>();
      setLowStockIds(new Set((res.data ?? []).map((item) => item._id)));
    } catch {
      toast.error('Failed to load low-stock assets');
    }
  }, [lowStockIds]);

  const displayedAssets = useMemo(() => {
    if (!lowStockIds) return assets;
    return assets.filter((a) => lowStockIds.has(a._id));
  }, [assets, lowStockIds]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`assets/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      toast.success('Asset retired');
      fetchAssets();
    } catch {
      setError('Failed to retire asset');
      toast.error('Failed to retire asset');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<AssetRow>[] = [
    {
      header: 'Name',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.name}</span>
      ),
    },
    {
      header: 'Category',
      accessor: (row) => <span className="capitalize">{row.category}</span>,
    },
    {
      header: 'Location',
      accessor: (row) => row.location ?? '—',
    },
    {
      header: 'Qty',
      accessor: (row) => row.quantity ?? '—',
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
          onView={() => router.push(`/assets/${row._id}`)}
          onEdit={() => router.push(`/assets/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Track PG furniture, appliances & equipment"
        action={
          <Button onClick={() => router.push('/assets/new')}>
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <LowStockBanner onFilterLowStock={handleFilterLowStock} />
      {lowStockIds && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm">
          <span className="font-semibold text-[color:var(--color-text-secondary)]">
            Showing low-stock assets only ({displayedAssets.length} on this page)
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setLowStockIds(null)}>
            Clear filter
          </Button>
        </div>
      )}
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
        <Select
          options={[
            { value: '', label: 'All Status' },
            { value: 'available', label: 'Available' },
            { value: 'in_use', label: 'In Use' },
            { value: 'under_maintenance', label: 'Under Maintenance' },
            { value: 'damaged', label: 'Damaged' },
            { value: 'retired', label: 'Retired' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={displayedAssets}
        keyExtractor={(row: AssetRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/assets/${row._id}`)}
        pagination={{
          page,
          perPage,
          total: lowStockIds ? displayedAssets.length : total,
          onPageChange: setPage,
          onPerPageChange: (pp) => {
            setPerPage(pp);
            setPage(1);
          },
        }}
        emptyState={
          <EmptyState
            icon={<Wrench className="h-12 w-12" />}
            title={lowStockIds ? 'No low-stock assets on this page' : 'No assets yet'}
            description={
              lowStockIds
                ? 'Try another page or clear the low-stock filter'
                : 'Add your first asset to start tracking equipment'
            }
            action={
              lowStockIds
                ? { label: 'Clear filter', onClick: () => setLowStockIds(null) }
                : { label: 'Add Asset', onClick: () => router.push('/assets/new') }
            }
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
              <span className="capitalize">{row.category}</span>
              <span>{row.location ?? '—'}</span>
              <span>Qty {row.quantity ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/assets/${row._id}`)}
                onEdit={() => router.push(`/assets/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Retire asset"
        message={`Retire "${deleteTarget?.name}"? The asset will be marked as retired (not permanently deleted).`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
