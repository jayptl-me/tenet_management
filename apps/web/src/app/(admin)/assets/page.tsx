'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Wrench, Boxes, AlertTriangle, CalendarClock, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
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
import { StatCard } from '@/components/ui/StatCard';
import { LowStockBanner } from '@/components/ui/LowStockBanner';
import { ServiceDueBanner } from '@/components/ui/ServiceDueBanner';
import {
  AssetCategoryIcon,
  AssetStockMeter,
  assetCategoryLabel,
  isLowStock,
} from '@/components/ui/AssetVisuals';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface PopulatedRef {
  _id?: string;
  label?: string;
  floorNumber?: number;
  roomNumber?: string;
}

interface AssetRow {
  _id: string;
  name: string;
  category: string;
  location?: string;
  floorId?: PopulatedRef | string | null;
  roomId?: PopulatedRef | string | null;
  quantity?: number;
  lowStockThreshold?: number;
  nextServiceDate?: string;
  status: string;
  createdAt: string;
}

interface AssetsListBody {
  success: boolean;
  data: AssetRow[];
  meta: { total: number };
}

function floorText(floor: AssetRow['floorId']): string | null {
  if (!floor || typeof floor === 'string') return null;
  return floor.label ?? (floor.floorNumber != null ? `Floor ${floor.floorNumber}` : null);
}

const ASSETS_KEY = ['assets'] as const;
const ASSETS_LIST_KEY = ['assets', 'list'] as const;
const LOW_STOCK_KEY = ['assets', 'low-stock'] as const;
const SERVICE_DUE_KEY = ['assets', 'service-due'] as const;
const RETIRED_TOTAL_KEY = ['assets', 'retired-total'] as const;
// Stable empty fallback: `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_ASSETS: AssetRow[] = [];

export default function AssetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Alert modes show the dedicated server endpoints (full sets) instead of
  // intersecting IDs with the current page, so counts and pagination are exact.
  const [alertMode, setAlertMode] = useState<'all' | 'low' | 'due'>('all');

  const matchesFilters = useCallback(
    (row: AssetRow) => {
      if (
        search &&
        !`${row.name ?? ''} ${row.location ?? ''}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (statusFilter && row.status !== statusFilter) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      return true;
    },
    [search, statusFilter, categoryFilter],
  );

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(perPage));
  if (search) params.set('search', search);
  if (statusFilter) params.set('status', statusFilter);
  if (categoryFilter) params.set('category', categoryFilter);

  const {
    data: listBody,
    isPending: listPending,
    error: listError,
  } = useApiBodyQuery<AssetsListBody>(
    [...ASSETS_LIST_KEY, page, perPage, search, statusFilter, categoryFilter],
    `assets?${params.toString()}`,
    { enabled: alertMode === 'all' },
  );

  // Cached full alert sets double as StatCard counts (single fetch each).
  const { data: lowStockRows, isPending: lowStockPending, error: lowStockError } =
    useApiQuery<AssetRow[]>(LOW_STOCK_KEY, 'assets/low-stock');
  const { data: serviceDueRows, isPending: serviceDuePending, error: serviceDueError } =
    useApiQuery<AssetRow[]>(SERVICE_DUE_KEY, 'assets/service-due');
  const { data: retiredBody } = useApiBodyQuery<{ meta: { total: number } }>(
    RETIRED_TOTAL_KEY,
    'assets?status=retired&limit=1',
  );
  const retiredTotal = retiredBody?.meta?.total ?? 0;

  const isLoading =
    alertMode === 'all'
      ? listPending
      : alertMode === 'low'
        ? lowStockPending
        : serviceDuePending;
  const fetchErrorMessage =
    alertMode === 'all'
      ? errorMessage(listError)
      : errorMessage(alertMode === 'low' ? lowStockError : serviceDueError);

  const handleFilterLowStock = useCallback(async () => {
    setAlertMode((mode) => (mode === 'low' ? 'all' : 'low'));
    setPage(1);
  }, []);

  const handleFilterServiceDue = useCallback(async () => {
    setAlertMode((mode) => (mode === 'due' ? 'all' : 'due'));
    setPage(1);
  }, []);

  const alertRows =
    alertMode === 'low' ? lowStockRows : alertMode === 'due' ? serviceDueRows : null;
  const filteredAlertRows = useMemo(
    () => (alertRows ?? []).filter(matchesFilters),
    [alertRows, matchesFilters],
  );
  const assets = alertMode === 'all' ? (listBody?.data ?? EMPTY_ASSETS) : filteredAlertRows;
  const total = alertMode === 'all' ? (listBody?.meta.total ?? 0) : filteredAlertRows.length;

  const displayedAssets = useMemo(() => {
    if (alertMode === 'all') return assets;
    return assets.slice((page - 1) * perPage, page * perPage);
  }, [assets, alertMode, page, perPage]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`assets/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      toast.success('Asset retired');
      setError('');
      await queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
    } catch (err) {
      const message = (await parseApiError(err)).message;
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<AssetRow>[] = [
    {
      header: 'Asset',
      accessor: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) [&_svg]:h-4 [&_svg]:w-4">
            <AssetCategoryIcon category={row.category} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-(--color-text-primary)">
              {row.name}
            </span>
            <span className="block text-xs font-medium text-(--color-text-muted)">
              {assetCategoryLabel(row.category)}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: 'Placement',
      accessor: (row) => {
        const floor = floorText(row.floorId);
        const room =
          row.roomId && typeof row.roomId === 'object' ? (row.roomId.roomNumber ?? null) : null;
        if (!floor && !room) return <span className="text-(--color-text-muted)">—</span>;
        return (
          <span className="text-13 font-medium text-(--color-text-secondary)">
            {[floor, room ? `Room ${room}` : null].filter(Boolean).join(' · ')}
          </span>
        );
      },
    },
    {
      header: 'Location',
      accessor: (row) => row.location ?? '—',
    },
    {
      header: 'Stock',
      accessor: (row) => {
        const low = isLowStock(row.quantity, row.lowStockThreshold);
        return (
          <div className="flex min-w-[140px] items-center gap-2">
            <span className="font-semibold tabular-nums">{row.quantity ?? '—'}</span>
            {low && <StatusBadge variant="warning" label="Low" />}
            <AssetStockMeter
              quantity={row.quantity}
              threshold={row.lowStockThreshold}
              className="hidden w-24 xl:block"
            />
          </div>
        );
      },
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
      <ErrorBanner message={fetchErrorMessage || error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total assets"
          value={total}
          icon={<Boxes className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Low stock"
          value={lowStockRows ? lowStockRows.length : '—'}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="warning"
          onClick={handleFilterLowStock}
        />
        <StatCard
          title="Service due (30d)"
          value={serviceDueRows ? serviceDueRows.length : '—'}
          icon={<CalendarClock className="h-4 w-4" />}
          variant="brand"
          onClick={handleFilterServiceDue}
        />
        <StatCard
          title="Retired"
          value={lowStockRows && serviceDueRows ? retiredTotal : '—'}
          icon={<Archive className="h-4 w-4" />}
          variant="default"
        />
      </div>
      <LowStockBanner onFilterLowStock={handleFilterLowStock} />
      <ServiceDueBanner onFilterServiceDue={handleFilterServiceDue} />
      {alertMode !== 'all' && (
        <div className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-sm">
          <span className="font-semibold text-(--color-text-secondary)">
            {alertMode === 'low'
              ? `Showing low-stock assets only (${total} total)`
              : `Showing assets due for service (${total} total)`}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setAlertMode('all')}>
            Clear filter
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name, location, or notes..."
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
          className="w-full sm:w-[210px]"
        />
        <Select
          options={[
            { value: '', label: 'All Categories' },
            { value: 'furniture', label: 'Furniture' },
            { value: 'appliance', label: 'Appliance' },
            { value: 'electronics', label: 'Electronics' },
            { value: 'cleaning', label: 'Cleaning' },
            { value: 'other', label: 'Other' },
          ]}
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[190px]"
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
          total,
          onPageChange: setPage,
          onPerPageChange: (pp) => {
            setPerPage(pp);
            setPage(1);
          },
        }}
        emptyState={
          <EmptyState
            icon={<Wrench className="h-12 w-12" />}
            title={alertMode !== 'all' ? 'No matching assets' : 'No assets yet'}
            description={
              alertMode !== 'all'
                ? 'Try clearing the active filter'
                : 'Add your first asset to start tracking equipment'
            }
            action={
              alertMode !== 'all'
                ? {
                    label: 'Clear filter',
                    onClick: () => {
                      setAlertMode('all');
                    },
                  }
                : { label: 'Add Asset', onClick: () => router.push('/assets/new') }
            }
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
                <AssetCategoryIcon
                  category={row.category}
                  className="h-4 w-4 shrink-0 text-(--color-text-muted)"
                />
                <span className="truncate">{row.name}</span>
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <AssetStockMeter quantity={row.quantity} threshold={row.lowStockThreshold} />
            <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
              <span>{assetCategoryLabel(row.category)}</span>
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
