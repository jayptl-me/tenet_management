'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Utensils } from 'lucide-react';
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
import { FeedbackSummaryStrip } from '@/components/ui/FeedbackSummaryStrip';
import { StarRating } from '@/components/ui/StarRating';
import { useRouter } from 'next/navigation';

interface MealFeedbackRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  mealType: string;
  rating: number;
  comment?: string;
  status: string;
  date?: string;
  createdAt: string;
}

export default function MealsPage() {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<MealFeedbackRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [mealFilter, setMealFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MealFeedbackRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);
      if (mealFilter) params.set('mealType', mealFilter);
      if (ratingFilter) params.set('rating', ratingFilter);
      if (dateFilter) params.set('date', dateFilter);

      const res = await api.get(`meals/feedback?${params.toString()}`).json<{
        success: boolean;
        data: MealFeedbackRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setFeedbacks(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load meal feedback');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, mealFilter, ratingFilter, dateFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`meals/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchFeedbacks();
    } catch {
      setError('Failed to delete meal feedback');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<MealFeedbackRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {row.tenant?.user?.name ?? 'N/A'}
        </span>
      ),
    },
    {
      header: 'Room',
      accessor: (row) => row.tenant?.room?.roomNumber ?? 'N/A',
    },
    {
      header: 'Meal',
      accessor: (row) => <span className="capitalize">{row.mealType}</span>,
    },
    {
      header: 'Date',
      accessor: (row) => {
        const dateStr = row.date ?? row.createdAt;
        if (!dateStr) return '—';
        try {
          return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          return '—';
        }
      },
    },
    {
      header: 'Rating',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <StarRating value={row.rating} readonly size="sm" />
          <span className="font-display text-xs font-bold text-[color:var(--color-warning-500)]">
            {row.rating}/5
          </span>
        </div>
      ),
    },
    {
      header: 'Comment',
      accessor: (row) => (
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-text-muted)]">
          {row.comment ?? '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge variant={statusToVariant(row.status)} label={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/meals/${row._id}`)}
          onEdit={() => router.push(`/meals/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meal Feedback"
        description="Track meal ratings and comments"
        action={
          <Button onClick={() => router.push('/meals/new')}>
            <Plus className="h-4 w-4" />
            Add Feedback
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <FeedbackSummaryStrip />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by tenant name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
        <Select
          options={[
            { value: '', label: 'All Meals' },
            { value: 'breakfast', label: 'Breakfast' },
            { value: 'lunch', label: 'Lunch' },
            { value: 'dinner', label: 'Dinner' },
          ]}
          value={mealFilter}
          onChange={(e) => {
            setMealFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
        <Select
          options={[
            { value: '', label: 'All Ratings' },
            { value: '5', label: '5 Stars' },
            { value: '4', label: '4 Stars' },
            { value: '3', label: '3 Stars' },
            { value: '2', label: '2 Stars' },
            { value: '1', label: '1 Star' },
          ]}
          value={ratingFilter}
          onChange={(e) => {
            setRatingFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={feedbacks}
        keyExtractor={(row: MealFeedbackRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/meals/${row._id}`)}
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
            icon={<Utensils className="h-12 w-12" />}
            title="No meal feedback yet"
            description="Submit your first meal feedback to get started"
            action={{ label: 'Add Feedback', onClick: () => router.push('/meals/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.tenant?.user?.name ?? 'N/A'}
              </span>
              <StarRating value={row.rating} readonly size="sm" />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span className="capitalize">{row.mealType}</span>
              {(row.date ?? row.createdAt) && (
                <span>
                  {new Date(row.date ?? row.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              )}
              <StatusBadge variant={statusToVariant(row.status)} label={row.status} />
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/meals/${row._id}`)}
                onEdit={() => router.push(`/meals/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Meal Feedback"
        message={`Are you sure you want to delete this feedback? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
