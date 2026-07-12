'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useRouter } from 'next/navigation';

interface NoticeRow {
  _id: string;
  title: string;
  content: string;
  pinned?: boolean;
  targetType?: string;
  createdAt: string;
}

export default function NoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [targetFilter, setTargetFilter] = useState('');
  const [search, setSearch] = useState('');
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
      if (search) params.set('search', search);
      if (targetFilter) params.set('targetType', targetFilter);

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
  }, [page, perPage, search, targetFilter]);

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
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.title}</span>
      ),
    },
    {
      header: 'Content',
      accessor: (row) => (
        <span className="block max-w-[250px] truncate text-xs text-[color:var(--color-text-muted)]">
          {row.content}
        </span>
      ),
    },
    {
      header: 'Audience',
      accessor: (row) => (
        <StatusBadge
          variant="info"
          label={(row.targetType ?? 'all').replace(/_/g, ' ')}
        />
      ),
    },
    {
      header: 'Pinned',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.pinned ? 'published' : 'draft')}
          label={row.pinned ? 'Pinned' : 'Normal'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/notices/${row._id}`)}
          onEdit={() => router.push(`/notices/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
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
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          options={[
            { value: '', label: 'All audiences' },
            { value: 'all', label: 'All tenants' },
            { value: 'floor', label: 'By floor' },
            { value: 'room', label: 'By room' },
            { value: 'individual', label: 'Individual' },
          ]}
          value={targetFilter}
          onChange={(e) => {
            setTargetFilter(e.target.value);
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
              <span className="max-w-[70%] truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.title}
              </span>
              <StatusBadge
                variant="info"
                label={(row.targetType ?? 'all').replace(/_/g, ' ')}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <StatusBadge
                variant={statusToVariant(row.pinned ? 'published' : 'draft')}
                label={row.pinned ? 'Pinned' : 'Normal'}
              />
              <span>
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/notices/${row._id}`)}
                onEdit={() => router.push(`/notices/${row._id}/edit`)}
                showDelete={false}
              />
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
