'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CalendarClock, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { useRouter } from 'next/navigation';
import { parseApiError } from '@/lib/errorParser';
import { tenantLabel } from '@/lib/resource-select-presets';

interface LeaveRow {
  _id: string;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { name: string };
    room?: { roomNumber: string; floor?: { label?: string } | null };
  };
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  createdAt: string;
}

function durationDays(startDate: string, endDate: string): number {
  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  } catch {
    return 0;
  }
}

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export default function LeavesPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`leaves?${params.toString()}`).json<{
        success: boolean;
        data: LeaveRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setLeaves(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load leave applications');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, statusFilter, tenantFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`leaves/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchLeaves();
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
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`leaves?${params.toString()}`).json<{
        success: boolean;
        data: LeaveRow[];
      }>();

      const rows = res.data ?? [];
      const headers = [
        'ID',
        'Tenant',
        'Room',
        'Bed',
        'Floor',
        'Start Date',
        'End Date',
        'Duration (days)',
        'Reason',
        'Status',
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
            row.startDate,
            row.endDate,
            durationDays(row.startDate, row.endDate),
            row.reason ?? '',
            row.status,
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
      link.setAttribute('download', `leaves-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export leave applications');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<LeaveRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {row.tenant?.user?.name ?? 'N/A'}
        </span>
      ),
    },
    { header: 'Room', accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A' },
    {
      header: 'Period',
      accessor: (row) => {
        const fmt = (d: string) =>
          new Date(d).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        return `${fmt(row.startDate)} - ${fmt(row.endDate)}`;
      },
    },
    {
      header: 'Days',
      accessor: (row) => {
        const n = durationDays(row.startDate, row.endDate);
        return `${n} day${n !== 1 ? 's' : ''}`;
      },
    },
    {
      header: 'Reason',
      accessor: (row) => (
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-text-muted)]">
          {row.reason ?? '—'}
        </span>
      ),
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
          onView={() => router.push(`/leaves/${row._id}`)}
          onEdit={() => router.push(`/leaves/${row._id}/edit`)}
          showDelete={row.status === 'pending'}
          onDelete={row.status === 'pending' ? () => setDeleteTarget(row) : undefined}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Applications"
        description="Approve or reject tenant leave requests"
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
            <Button onClick={() => router.push('/leaves/new')}>
              <Plus className="h-4 w-4" />
              New Leave
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <Input
          placeholder="Search by tenant name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
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
          className="max-w-[240px]"
        />
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
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
        data={leaves}
        keyExtractor={(row: LeaveRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/leaves/${row._id}`)}
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
            icon={<CalendarClock className="h-12 w-12" />}
            title="No leave applications yet"
            description="Submit your first leave application to get started"
            action={{ label: 'New Leave', onClick: () => router.push('/leaves/new') }}
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
                label={row.status?.replace(/_/g, ' ') ?? 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>
                {new Date(row.startDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span className="text-[color:var(--color-text-secondary)]">{'→'}</span>
              <span>
                {new Date(row.endDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span>
                {row.tenant?.room?.roomNumber ? `Room ${row.tenant.room.roomNumber}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/leaves/${row._id}`)}
                onEdit={() => router.push(`/leaves/${row._id}/edit`)}
                showDelete={row.status === 'pending'}
                onDelete={row.status === 'pending' ? () => setDeleteTarget(row) : undefined}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Leave Application"
        message="Are you sure you want to delete this leave application? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
