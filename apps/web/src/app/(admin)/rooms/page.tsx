'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, DoorOpen, LayoutList, LayoutGrid, Download, Wrench, X } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ServiceStatusIndicator } from '@/components/ui/ServiceStatusIndicator';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { BedOccupancyGrid } from '@/components/ui/BedOccupancyGrid';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { floorLabel } from '@/lib/resource-select-presets';
import { useRouter } from 'next/navigation';

type ViewMode = 'table' | 'matrix';
type AvailabilityFilter = '' | 'vacant' | 'full';

interface RoomRow {
  _id: string;
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  beds?: { bedId: string; isOccupied: boolean; tenantId?: string; tenantName?: string }[];
  createdAt: string;
}

interface ReconcileReport {
  dryRun: boolean;
  scannedRooms: number;
  scannedTenants: number;
  fixedRooms: number;
  occupiedBeds: number;
  freedBeds: number;
  conflicts: Array<{
    roomId: string;
    roomNumber: string;
    bedId: string;
    tenantIds: string[];
    tenantNames: string[];
    keptTenantId: string;
  }>;
  orphans: Array<{
    tenantId: string;
    tenantName: string;
    roomId: string;
    bedId: string;
    reason: string;
  }>;
  invalidRooms: Array<{
    roomId: string;
    roomNumber: string;
    sharingType: number;
    bedCount: number;
  }>;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [sharingFilter, setSharingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reconcileConfirm, setReconcileConfirm] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileReport | null>(null);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('roomNumber', search);
      if (sharingFilter) params.set('sharingType', sharingFilter);
      if (statusFilter) params.set('isActive', statusFilter);
      if (floorFilter) params.set('floorId', floorFilter);

      const res = await api.get(`rooms?${params.toString()}`).json<{
        success: boolean;
        data: RoomRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setRooms(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, sharingFilter, statusFilter, floorFilter]);

  const visibleRooms = useMemo(() => {
    if (!availabilityFilter) return rooms;
    return rooms.filter((r) => {
      const beds = r.beds ?? [];
      const vacant = beds.some((b) => !b.isOccupied);
      return availabilityFilter === 'vacant' ? vacant : !vacant;
    });
  }, [rooms, availabilityFilter]);

  const handleExportCsv = () => {
    if (visibleRooms.length === 0) return;
    const headers = ['Room', 'Floor', 'Type', 'Monthly Rent', 'Available', 'Total Beds', 'Status'];
    const escapeCsv = (val: unknown) => {
      let str = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = visibleRooms.map((r) => {
      const beds = r.beds ?? [];
      const available = beds.filter((b) => !b.isOccupied).length;
      return [
        escapeCsv(r.roomNumber),
        escapeCsv(r.floor?.label ?? '—'),
        escapeCsv(`${r.sharingType} Sharing`),
        escapeCsv(r.monthlyRent),
        escapeCsv(available),
        escapeCsv(beds.length || r.sharingType),
        escapeCsv(r.isActive ? 'Active' : 'Inactive'),
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rooms-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`rooms/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchRooms();
    } catch {
      setError('Failed to delete room');
    } finally {
      setDeleting(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setError('');
    try {
      const res = await api.post('rooms/reconcile-occupancy', { json: {} }).json<{
        success: boolean;
        data: ReconcileReport;
      }>();
      setReconcileConfirm(false);
      setReconcileResult(res.data);
      fetchRooms();
    } catch (err) {
      setReconcileConfirm(false);
      setError((await parseApiError(err)).message);
    } finally {
      setReconciling(false);
    }
  };

  const columns: DataTableColumn<RoomRow>[] = [
    {
      header: 'Room',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {row.roomNumber}
        </span>
      ),
    },
    {
      header: 'Floor',
      accessor: (row) => row.floor?.label ?? 'N/A',
    },
    {
      header: 'Type',
      accessor: (row) => `${row.sharingType} Sharing`,
    },
    {
      header: 'Rent',
      accessor: (row) => `₹${row.monthlyRent.toLocaleString()}`,
    },
    {
      header: 'Beds',
      accessor: (row) => {
        const beds = row.beds ?? [];
        const available = beds.filter((b) => !b.isOccupied).length;
        return `${available}/${beds.length} available`;
      },
    },
    {
      header: 'Services',
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ServiceStatusIndicator floorId={row.floor?._id} compact />
        </div>
      ),
      className: 'w-[100px]',
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
          onView={() => router.push(`/rooms/${row._id}`)}
          onEdit={() => router.push(`/rooms/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Manage rooms and bed allocations"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReconcileResult(null);
                setReconcileConfirm(true);
              }}
              title="Rebuild bed assignments from active tenants"
            >
              <Wrench className="h-4 w-4" />
              Reconcile
            </Button>
            <div className="flex overflow-hidden rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)]">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                  viewMode === 'table'
                    ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)]'
                    : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                }`}
                aria-label="Table view"
              >
                <LayoutList className="mr-1 inline h-3.5 w-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                  viewMode === 'matrix'
                    ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)]'
                    : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                }`}
                aria-label="Bed Matrix view"
              >
                <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
                Bed Matrix
              </button>
            </div>
            <Button onClick={() => router.push('/rooms/new')}>
              <Plus className="h-4 w-4" />
              Add Room
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />

      {reconcileResult && (
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
                Occupancy reconciled — {reconcileResult.fixedRooms} room
                {reconcileResult.fixedRooms === 1 ? '' : 's'} repaired
              </p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-secondary)]">
                Scanned {reconcileResult.scannedRooms} rooms · {reconcileResult.scannedTenants}{' '}
                active tenants · {reconcileResult.occupiedBeds} beds occupied ·{' '}
                {reconcileResult.freedBeds} stale beds freed
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss reconcile result"
              onClick={() => setReconcileResult(null)}
              className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-field-bg)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {reconcileResult.conflicts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-[color:var(--color-danger-700)]">
                Bed conflicts ({reconcileResult.conflicts.length}) — earliest move-in kept, transfer
                the rest manually
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.conflicts.map((cf) => (
                  <li
                    key={`${cf.roomId}-${cf.bedId}`}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-card-bg)] px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[color:var(--color-text-primary)]">
                      Room {cf.roomNumber} · Bed {cf.bedId}
                    </span>
                    <span className="ml-2 text-[color:var(--color-text-secondary)]">
                      {cf.tenantNames.join(', ')}
                    </span>
                    <span className="ml-2">
                      {cf.tenantIds
                        .filter((tid) => tid !== cf.keptTenantId)
                        .map((tid) => (
                          <button
                            key={tid}
                            type="button"
                            onClick={() => router.push(`/tenants/${tid}`)}
                            className="mr-1 font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                          >
                            Move tenant
                          </button>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reconcileResult.orphans.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-[color:var(--color-warning-800)]">
                Orphaned tenants ({reconcileResult.orphans.length}) — no valid bed slot found
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.orphans.map((o) => (
                  <li
                    key={o.tenantId}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-warning-200)] bg-[color:var(--color-card-bg)] px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/tenants/${o.tenantId}`)}
                      className="font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                    >
                      {o.tenantName}
                    </button>
                    <span className="ml-2 text-[color:var(--color-text-secondary)]">
                      Bed {o.bedId} · {o.reason.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reconcileResult.invalidRooms.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-[color:var(--color-warning-800)]">
                Invalid rooms ({reconcileResult.invalidRooms.length}) — bed count mismatches sharing
                type
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {reconcileResult.invalidRooms.map((r) => (
                  <li
                    key={r.roomId}
                    className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/rooms/${r.roomId}`)}
                      className="font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                    >
                      Room {r.roomNumber}
                    </button>
                    <span className="ml-2 text-[color:var(--color-text-secondary)]">
                      {r.bedCount} beds for {r.sharingType} sharing
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="Search by room number..."
          aria-label="Search by room number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter by sharing type"
          options={[
            { value: '', label: 'All Types' },
            { value: '2', label: '2 Sharing' },
            { value: '3', label: '3 Sharing' },
            { value: '4', label: '4 Sharing' },
          ]}
          value={sharingFilter}
          onChange={(e) => {
            setSharingFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[170px]"
        />
        <Select
          aria-label="Filter by room status"
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[160px]"
        />
        <ResourceSelect
          endpoint="floors"
          value={floorFilter}
          onChange={(val) => {
            setFloorFilter(val);
            setPage(1);
          }}
          placeholder="All Floors"
          valueKey="_id"
          labelKey={floorLabel}
          dataPath="data"
          className="w-full sm:w-[200px]"
        />
        <Select
          aria-label="Filter by bed availability"
          options={[
            { value: '', label: 'All Availability' },
            { value: 'vacant', label: 'Has Vacancy' },
            { value: 'full', label: 'Full' },
          ]}
          value={availabilityFilter}
          onChange={(e) => {
            setAvailabilityFilter(e.target.value as AvailabilityFilter);
          }}
          className="w-full sm:w-[195px]"
        />
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={visibleRooms.length === 0}
          className="flex items-center gap-1.5"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {viewMode === 'matrix' ? (
        <BedOccupancyGrid rooms={visibleRooms} isLoading={isLoading} />
      ) : (
        <DataTable
          columns={columns}
          data={visibleRooms}
          keyExtractor={(row: RoomRow) => row._id}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/rooms/${row._id}`)}
          pagination={{
            page,
            perPage,
            total,
            onPageChange: (p) => setPage(p),
            onPerPageChange: (pp) => {
              setPerPage(pp);
              setPage(1);
            },
          }}
          emptyState={
            <EmptyState
              icon={<DoorOpen className="h-12 w-12" />}
              title="No rooms yet"
              description="Add your first room to get started"
              action={{ label: 'Add Room', onClick: () => router.push('/rooms/new') }}
            />
          }
          mobileCardRenderer={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  Room {row.roomNumber}
                </span>
                <StatusBadge
                  variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
                  label={row.isActive ? 'Active' : 'Inactive'}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
                <span>{row.floor?.label ?? 'N/A'}</span>
                <span>{row.sharingType} Sharing</span>
                <span>₹{row.monthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/rooms/${row._id}`)}
                  onEdit={() => router.push(`/rooms/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          )}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deactivate Room"
        message={`Deactivate room "${deleteTarget?.roomNumber}"? It will be marked inactive and hidden from new assignments. Active tenants must be moved first.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={reconcileConfirm}
        title="Reconcile Occupancy"
        message="Rebuild every room's bed assignments from active tenants? Beds pointing at checked-out or missing tenants will be freed. Rooms with two active tenants on one bed keep the earliest move-in; the rest are listed for manual transfer."
        loading={reconciling}
        onConfirm={handleReconcile}
        onCancel={() => setReconcileConfirm(false)}
      />
    </div>
  );
}
