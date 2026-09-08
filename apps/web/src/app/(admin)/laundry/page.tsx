'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Shirt, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { tenantLabel } from '@/lib/resource-select-presets';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface LaundryRow {
  _id: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    user?: { name: string };
    room?: { roomNumber: string; floor?: { label?: string } | null };
  };
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export default function LaundryPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<LaundryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
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
      if (dateFilter) params.set('slotDate', dateFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`laundry-slots?${params.toString()}`).json<{
        success: boolean;
        data: LaundryRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setSlots(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, dateFilter, tenantFilter]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleStatusUpdate = async (id: string, status: string) => {
    setIsUpdating(true);
    try {
      await api.put(`laundry-slots/${id}`, { json: { status } }).json();
      fetchSlots();
    } catch (err) {
      setError((await parseApiError(err)).message);
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
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFilter) params.set('slotDate', dateFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`laundry-slots?${params.toString()}`).json<{
        success: boolean;
        data: LaundryRow[];
      }>();

      const rows = res.data ?? [];
      const headers = [
        'ID',
        'Tenant',
        'Room',
        'Bed',
        'Floor',
        'Slot Date',
        'Slot Time',
        'Items',
        'Status',
        'Notes',
        'Created At',
      ];

      const csvLines = [
        headers.map(sanitizeCSVValue).join(','),
        ...rows.map((row) =>
          [
            row._id,
            row.tenant?.user?.name ?? '',
            row.tenant?.room?.roomNumber ?? '',
            row.tenant?.bedId ?? '',
            row.tenant?.room?.floor?.label ?? '',
            row.slotDate,
            row.slotTime,
            row.items ?? 1,
            row.status,
            row.notes ?? '',
            row.createdAt,
          ]
            .map(sanitizeCSVValue)
            .join(','),
        ),
      ];

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `laundry-slots-export-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsExporting(false);
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
            {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
            {row.tenant?.room?.floor?.label ? ` · ${row.tenant.room.floor.label}` : ''}
          </p>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (row) => row.slotDate,
    },
    {
      header: 'Time',
      accessor: (row) => <span className="font-mono text-sm">{row.slotTime}</span>,
    },
    {
      header: 'Items',
      accessor: (row) => row.items ?? 1,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'booked' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(row._id, 'confirmed')}
              title="Confirm slot"
            >
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </Button>
          )}
          {row.status === 'confirmed' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(row._id, 'completed')}
              title="Mark completed"
            >
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {row.status !== 'cancelled' && row.status !== 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(row._id, 'cancelled')}
              title="Cancel slot"
            >
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              loading={isExporting}
              disabled={isExporting}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/laundry/new')}>
              <Plus className="h-4 w-4" />
              New Slot
            </Button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <DatePicker
          aria-label="Filter by slot date"
          placeholder="Filter by slot date..."
          value={dateFilter}
          onChange={(val: string) => {
            setDateFilter(val);
            setPage(1);
          }}
          className="w-full sm:w-[180px]"
        />
        <ResourceSelect
          endpoint="tenants"
          value={tenantFilter}
          onChange={(val) => {
            setTenantFilter(val);
            setPage(1);
          }}
          placeholder="All Tenants"
          valueKey="_id"
          labelKey={tenantLabel}
          dataPath="data"
          className="w-full sm:w-[240px]"
        />
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
          className="w-full sm:w-[200px]"
          aria-label="Filter by status"
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
