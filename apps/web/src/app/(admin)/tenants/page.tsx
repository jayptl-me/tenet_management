'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface TenantRow {
  _id: string;
  user?: { name: string; email: string; phone: string; _id: string };
  room?: { roomNumber: string; floor?: { label?: string; floorNumber?: number } | null };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  isActive: boolean;
  moveInDate: string;
  documents?: {
    aadhaarUrl?: string;
    photoUrl?: string;
    isVerified?: boolean;
  };
}

function tenantRoomLabel(t: TenantRow): string {
  const room = t.room?.roomNumber ?? 'N/A';
  const floor = t.room?.floor?.label;
  return floor ? `${floor} - ${room}` : room;
}

/** KYC review state derived from the tenant document record. */
function kycStatus(t: TenantRow): { label: string; variant: 'success' | 'warning' | 'neutral' } {
  if (t.documents?.isVerified) return { label: 'KYC Verified', variant: 'success' };
  if (t.documents?.aadhaarUrl || t.documents?.photoUrl) {
    return { label: 'KYC Pending', variant: 'warning' };
  }
  return { label: 'No Docs', variant: 'neutral' };
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
  const [floorFilter, setFloorFilter] = useState('');
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
      if (floorFilter) params.set('floorId', floorFilter);

      const res = await api.get(`tenants?${params.toString()}`).json<{
        success: boolean;
        data: TenantRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setTenants(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, statusFilter, floorFilter]);

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
    } catch (err) {
      setError((await parseApiError(err)).message);
      setDeleting(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    if (tenants.length === 0) return;
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Room',
      'Bed',
      'Monthly Rent',
      'Deposit Paid',
      'Status',
      'KYC',
      'Move-in Date',
    ];
    const escapeCsv = (val: unknown) => {
      let str = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = tenants.map((t) => [
      escapeCsv(t.user?.name ?? '—'),
      escapeCsv(t.user?.email ?? '—'),
      escapeCsv(t.user?.phone ?? '—'),
      escapeCsv(t.room?.roomNumber ?? '—'),
      escapeCsv(t.bedId ?? '—'),
      escapeCsv(t.monthlyRent),
      escapeCsv(t.depositPaid),
      escapeCsv(t.isActive ? 'Active' : 'Checked Out'),
      escapeCsv(kycStatus(t).label),
      escapeCsv(t.moveInDate ? new Date(t.moveInDate).toISOString().slice(0, 10) : '—'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tenants-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<TenantRow>[] = [
    {
      header: 'Name',
      accessor: (row) => (
        <span className="font-semibold text-(--color-text-primary)">{row.user?.name ?? 'N/A'}</span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => `${tenantRoomLabel(row)} (Bed ${row.bedId})`,
    },
    {
      header: 'KYC',
      accessor: (row) => {
        const kyc = kycStatus(row);
        return <StatusBadge variant={kyc.variant} label={kyc.label} />;
      },
    },
    {
      header: 'Contact',
      accessor: (row) => (
        <div className="flex flex-col text-xs">
          <span>{row.user?.email ?? 'N/A'}</span>
          <span className="text-(--color-text-muted)">{row.user?.phone ?? 'N/A'}</span>
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
        <TableActions
          onView={() => router.push(`/tenants/${row._id}`)}
          onEdit={() => router.push(`/tenants/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
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
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Checked Out' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
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
          labelKey={(item) => {
            const f = item as unknown as { label: string; floorNumber?: number };
            return f.label ?? `Floor ${f.floorNumber ?? ''}`;
          }}
          dataPath="data"
          className="max-w-[200px]"
        />
        <Button variant="outline" onClick={handleExportCsv} disabled={tenants.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        keyExtractor={(row: TenantRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/tenants/${row._id}`)}
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
            icon={<Users className="h-12 w-12" />}
            title="No tenants yet"
            description="Add your first tenant to get started"
            action={{ label: 'Add Tenant', onClick: () => router.push('/tenants/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-(--color-text-primary)">
                {row.user?.name ?? 'N/A'}
              </span>
              <StatusBadge
                variant={statusToVariant(row.isActive ? 'active' : 'checked_out')}
                label={row.isActive ? 'Active' : 'Checked Out'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
              <span>{row.room?.roomNumber ? `Room ${tenantRoomLabel(row)}` : 'No Room'}</span>
              <span>₹{row.monthlyRent.toLocaleString()}</span>
              <StatusBadge variant={kycStatus(row).variant} label={kycStatus(row).label} />
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/tenants/${row._id}`)}
                onEdit={() => router.push(`/tenants/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Tenant Permanently"
        message={
          deleteTarget?.user?.name
            ? `Permanently delete "${deleteTarget.user.name}" and ALL associated records: payments, invoices, complaints, visitors, guardians (including their portal logins), laundry slots, meal feedback, attendance, and leaves. Their bed is freed and their login is disabled. This cannot be undone - prefer Check Out for normal move-outs.`
            : 'Permanently delete this tenant and ALL associated records (payments, invoices, complaints, visitors, guardians, attendance, leaves)? Their bed is freed and their login is disabled. This cannot be undone.'
        }
        confirmLabel="Delete Permanently"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
