'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useRouter } from 'next/navigation';

interface NoticeRow {
  _id: string;
  title: string;
  content: string;
  priority: string;
  isPublished: boolean;
  createdAt: string;
}

export default function NoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoticeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await api.get(`notices?${params.toString()}`).json<{
        success: boolean;
        data: NoticeRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setNotices(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load notices');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, priorityFilter]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`notices/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchNotices();
    } catch {
      setError('Failed to delete notice');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<NoticeRow>[] = [
    {
      header: 'Title',
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.title}</span>,
    },
    {
      header: 'Content',
      accessor: (row) => (
        <span className="text-surface-500 block max-w-[250px] truncate text-xs">{row.content}</span>
      ),
    },
    {
      header: 'Priority',
      accessor: (row) => (
        <StatusBadge
          variant={
            row.priority === 'emergency'
              ? 'danger'
              : row.priority === 'high'
                ? 'warning'
                : row.priority === 'medium'
                  ? 'info'
                  : 'neutral'
          }
          label={row.priority}
        />
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isPublished ? 'published' : 'draft')}
          label={row.isPublished ? 'Published' : 'Draft'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/notices/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/notices/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        description="Post announcements for tenants"
        action={
          <Button onClick={() => router.push('/notices/new')}>
            <Plus className="h-4 w-4" />
            Post Notice
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Priorities' },
            { value: 'emergency', label: 'Emergency' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={notices}
        keyExtractor={(row: NoticeRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/notices/${row._id}`)}
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
            icon={<Megaphone className="h-12 w-12" />}
            title="No notices yet"
            description="Post your first announcement to get started"
            action={{ label: 'Post Notice', onClick: () => router.push('/notices/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[color:var(--color-text-primary)] text-sm truncate max-w-[70%]">
                {row.title}
              </span>
              <StatusBadge
                variant={
                  row.priority === 'emergency' ? 'danger'
                    : row.priority === 'high' ? 'warning'
                    : row.priority === 'medium' ? 'info'
                    : 'neutral'
                }
                label={row.priority}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <StatusBadge
                variant={statusToVariant(row.isPublished ? 'published' : 'draft')}
                label={row.isPublished ? 'Published' : 'Draft'}
              />
              <span>{new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button onClick={(e) => { e.stopPropagation(); router.push(`/notices/${row._id}`); }} className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] hover:bg-[color:var(--color-surface-100)]">
                <Eye className="h-3 w-3" /> View
              </button>
              <button onClick={(e) => { e.stopPropagation(); router.push(`/notices/${row._id}/edit`); }} className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)]">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Notice"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
