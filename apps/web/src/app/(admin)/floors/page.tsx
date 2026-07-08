'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface FloorRow {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  createdAt: string;
}

export default function FloorsPage() {
  const router = useRouter();
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FloorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFloors = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('floors').json<{
        success: boolean;
        data: FloorRow[];
      }>();
      setFloors(res.data);
    } catch {
      setError('Failed to load floors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`floors/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      await fetchFloors();
    } catch {
      setError('Failed to delete floor');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<FloorRow>[] = [
    {
      header: 'Floor',
      accessor: (row) => <span className="font-semibold text-[color:var(--color-surface-900)]">{row.label}</span>,
    },
    {
      header: 'Floor #',
      accessor: (row) => row.floorNumber,
    },
    {
      header: 'Rooms',
      accessor: (row) => row.totalRooms,
    },
    {
      header: 'Services',
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()} className="min-w-[140px]">
          <FloorServiceGrid floorId={row._id} compact />
        </div>
      ),
      className: 'w-[180px]',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/floors/${row._id}`);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)]"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/floors/${row._id}/edit`);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-50)]"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-danger-50)]"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[120px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Floors"
        description="Manage building floors"
        action={
          <Button onClick={() => router.push('/floors/new')}>
            <Plus className="h-4 w-4" />
            Add Floor
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <DataTable
        columns={columns}
        data={floors}
        keyExtractor={(row: FloorRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/floors/${row._id}`)}
        emptyState={
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="No floors yet"
            description="Add your first floor to get started"
            action={{ label: 'Add Floor', onClick: () => router.push('/floors/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                {row.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-text-muted)]">
                Floor #{row.floorNumber}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.totalRooms} Room{row.totalRooms !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/floors/${row._id}`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] transition-colors hover:bg-[color:var(--color-surface-100)]"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/floors/${row._id}/edit`); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Floor"
        message={`Are you sure you want to delete "${deleteTarget?.label}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
