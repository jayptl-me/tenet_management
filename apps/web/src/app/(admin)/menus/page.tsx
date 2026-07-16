'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardList, List, CalendarRange } from 'lucide-react';
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
import { WeekMenuPlanner } from '@/components/ui/WeekMenuPlanner';
import type { StatusVariant } from '@pg/types';
import { useRouter } from 'next/navigation';

interface MenuRow {
  _id: string;
  date: string;
  dayOfWeek?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Derives a status label and badge variant from the menu date.
 * Past menus (date < today) get a neutral "Past" badge instead of
 * the misleading "Draft" label. Today = "Active", future = "Scheduled".
 */
function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMenuStatusInfo(date: string): { label: string; variant: StatusVariant } {
  const today = localTodayYmd();
  if (date < today) return { label: 'Past', variant: statusToVariant('past') };
  if (date === today) return { label: 'Active', variant: statusToVariant('active') };
  return { label: 'Scheduled', variant: 'info' };
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
  const [view, setView] = useState<'list' | 'week'>('list');

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
      accessor: (row) => {
        const info = getMenuStatusInfo(row.date);
        return <StatusBadge variant={info.variant} label={info.label} />;
      },
    },
    {
      header: 'Actions',
      accessor: (row) => {
        const isPast = row.date.slice(0, 10) < localTodayYmd();
        return (
          <TableActions
            onView={() => router.push(`/menus/${row._id}`)}
            showEdit={!isPast}
            onEdit={() => router.push(`/menus/${row._id}/edit`)}
            onDelete={() => setDeleteTarget(row)}
          />
        );
      },
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Menus"
        description="Plan daily meals for tenants"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-0.5">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  view === 'list'
                    ? 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]'
                }`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  view === 'week'
                    ? 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> Week
              </button>
            </div>
            <Button onClick={() => router.push('/menus/new')}>
              <Plus className="h-4 w-4" /> Create Menu
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      {view === 'week' ? (
        <WeekMenuPlanner
          onDayClick={(date, menu) =>
            router.push(menu?._id ? `/menus/${menu._id}` : `/menus/new?date=${date}`)
          }
        />
      ) : (
        <>
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
            { value: 'true', label: 'Active & Upcoming' },
            { value: 'false', label: 'Past' },
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
              {(() => {
                const info = getMenuStatusInfo(row.date);
                return <StatusBadge variant={info.variant} label={info.label} />;
              })()}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/menus/${row._id}`)}
                showEdit={row.date.slice(0, 10) >= localTodayYmd()}
                onEdit={() => router.push(`/menus/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
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
        </>
      )}
    </div>
  );
}
