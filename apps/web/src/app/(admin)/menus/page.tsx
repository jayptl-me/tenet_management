'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useRouter } from 'next/navigation';

interface MenuRow {
  _id: string;
  date: string;
  dayOfWeek?: string;
  isActive: boolean;
  createdAt: string;
}

export default function MenusPage() {
  const router = useRouter();
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MenuRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMenus = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter);

      const res = await api.get(`menus?${params.toString()}`).json<{
        success: boolean;
        data: MenuRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setMenus(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load menus');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`menus/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchMenus();
    } catch {
      setError('Failed to delete menu');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<MenuRow>[] = [
    {
      header: 'Date',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {new Date(row.date).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Day',
      accessor: (row) =>
        row.dayOfWeek ?? new Date(row.date).toLocaleDateString('en-IN', { weekday: 'long' }),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'draft')}
          label={row.isActive ? 'Active' : 'Draft'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/menus/${row._id}`)}
          onEdit={() => router.push(`/menus/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Menus"
        description="Plan daily meals for tenants"
        action={
          <Button onClick={() => router.push('/menus/new')}>
            <Plus className="h-4 w-4" /> Create Menu
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by date..."
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
            { value: 'false', label: 'Draft' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={menus}
        keyExtractor={(row: MenuRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/menus/${row._id}`)}
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
            icon={<ClipboardList className="h-12 w-12" />}
            title="No menus yet"
            description="Create your first daily menu to get started"
            action={{ label: 'Create Menu', onClick: () => router.push('/menus/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {new Date(row.date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <StatusBadge
                variant={statusToVariant(row.isActive ? 'active' : 'draft')}
                label={row.isActive ? 'Active' : 'Draft'}
              />
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/menus/${row._id}`)}
                onEdit={() => router.push(`/menus/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Menu"
        message={`Are you sure you want to delete this menu? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
