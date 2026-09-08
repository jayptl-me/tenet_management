'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, DoorOpen, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusFilterSelect } from '@/components/ui/StatusFilterSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { tenantLabel } from '@/lib/resource-select-presets';
import { useRouter } from 'next/navigation';

interface VisitorRow {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: {
    _id?: string;
    bedId?: string;
    user?: { name: string };
    room?: { roomNumber: string; floor?: { label?: string } };
  };
  expectedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: string;
  createdAt: string;
}

function formatShortDate(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function VisitorsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VisitorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleExport = () => {
    if (visitors.length === 0) return;
    const sanitize = (val: string | number | undefined | null) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = [
      'Visitor Name',
      'Phone',
      'Purpose',
      'Tenant',
      'Room',
      'Bed',
      'Floor',
      'Expected Arrival',
      'Check In',
      'Check Out',
      'Status',
      'Created At',
    ];
    const rows = visitors.map((v) => [
      sanitize(v.name),
      sanitize(v.phone),
      sanitize(v.purpose),
      sanitize(v.tenant?.user?.name ?? 'N/A'),
      sanitize(v.tenant?.room?.roomNumber ?? 'N/A'),
      sanitize(v.tenant?.bedId ?? 'N/A'),
      sanitize(v.tenant?.room?.floor?.label ?? 'N/A'),
      sanitize(v.expectedArrival ?? ''),
      sanitize(v.actualArrival ?? ''),
      sanitize(v.actualDeparture ?? ''),
      sanitize(v.status),
      sanitize(v.createdAt),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `visitors_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchVisitors = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (tenantFilter) params.set('tenantId', tenantFilter);

      const res = await api.get(`visitors?${params.toString()}`).json<{
        success: boolean;
        data: VisitorRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setVisitors(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, search, tenantFilter]);

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
    } catch (err) {
      setError((await parseApiError(err)).message);
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
      header: 'Room',
      accessor: (row) =>
        row.tenant?.room?.roomNumber
          ? `${row.tenant.room.roomNumber}${row.tenant.bedId ? ` (Bed ${row.tenant.bedId})` : ''}`
          : 'N/A',
    },
    {
      header: 'Expected',
      accessor: (row) => formatShortDate(row.expectedArrival),
    },
    {
      header: 'Check In',
      accessor: (row) => formatShortDate(row.actualArrival),
    },
    {
      header: 'Check Out',
      accessor: (row) => formatShortDate(row.actualDeparture),
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={visitors.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/visitors/new')}>
              <Plus className="h-4 w-4" />
              Register Visitor
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by visitor name or phone..."
          aria-label="Search visitors"
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
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>
                {row.tenant?.room?.roomNumber
                  ? `Room ${row.tenant.room.roomNumber}${row.tenant.bedId ? ` · Bed ${row.tenant.bedId}` : ''}`
                  : 'No room'}
              </span>
              <span>{formatShortDate(row.expectedArrival)}</span>
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
