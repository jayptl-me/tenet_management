'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
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

  const columns: DataTableColumn<FloorRow>[] = [
    {
      header: 'Floor',
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.label}</span>,
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
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/floors/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/floors/${row._id}/edit`);
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
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Floors</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Manage building floors</p>
        </div>
        <Button onClick={() => router.push('/floors/new')}>
          <Plus className="h-4 w-4" />
          Add Floor
        </Button>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={floors}
        keyExtractor={(row: FloorRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/floors/${row._id}`)}
      />
    </div>
  );
}
