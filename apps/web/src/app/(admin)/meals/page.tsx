'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface MealFeedbackRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  mealType: string;
  rating: number;
  comment?: string;
  status: string;
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
  const [error, setError] = useState('');

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (mealFilter) params.set('mealType', mealFilter);
      if (ratingFilter) params.set('rating', ratingFilter);

      const res = await api.get(`meals?${params.toString()}`).json<{
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
  }, [page, perPage, mealFilter, ratingFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const columns: DataTableColumn<MealFeedbackRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">{row.tenant?.user?.name ?? 'N/A'}</span>
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
      header: 'Rating',
      accessor: (row) => (
        <span className="text-warning-500 font-display text-sm font-bold">
          {row.rating}/5
        </span>
      ),
    },
    {
      header: 'Comment',
      accessor: (row) => (
        <span className="text-surface-500 block max-w-[200px] truncate text-xs">
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
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/meals/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/meals/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[90px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Meal Feedback</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Track meal ratings and comments</p>
        </div>
        <Button onClick={() => router.push('/meals/new')}>
          <Plus className="h-4 w-4" />
          Add Feedback
        </Button>
      </div>
      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
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
      />
    </div>
  );
}
