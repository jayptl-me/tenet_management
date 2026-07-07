'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ServiceStatusIndicator } from '@/components/ui/ServiceStatusIndicator';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface RoomRow {
  _id: string;
  roomNumber: string;
  floor?: { _id: string; label: string };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  beds?: { bedId: string; isOccupied: boolean; tenantId?: string }[];
  createdAt: string;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [sharingFilter, setSharingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('roomNumber', search);
      if (sharingFilter) params.set('sharingType', sharingFilter);
      if (statusFilter) params.set('isActive', statusFilter);

      const res = await api.get(`rooms?${params.toString()}`).json<{
        success: boolean;
        data: RoomRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setRooms(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search, sharingFilter, statusFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`rooms/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchRooms();
    } catch {
      setError('Failed to delete room');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<RoomRow>[] = [
    {
      header: 'Room',
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.roomNumber}</span>,
    },
    {
      header: 'Floor',
      accessor: (row) => row.floor?.label ?? 'N/A',
    },
    {
      header: 'Type',
      accessor: (row) => `${row.sharingType} Sharing`,
    },
    {
      header: 'Rent',
      accessor: (row) => `₹${row.monthlyRent.toLocaleString()}`,
    },
    {
      header: 'Beds',
      accessor: (row) => {
        const beds = row.beds ?? [];
        const available = beds.filter((b) => !b.isOccupied).length;
        return `${available}/${beds.length} available`;
      },
    },
    {
      header: 'Services',
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ServiceStatusIndicator floorId={row.floor?._id} compact />
        </div>
      ),
      className: 'w-[100px]',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'maintenance')}
          label={row.isActive ? 'Active' : 'Inactive'}
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
              router.push(`/rooms/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/rooms/${row._id}/edit`);
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
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Rooms</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Manage rooms and bed allocations</p>
        </div>
        <Button onClick={() => router.push('/rooms/new')}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by room number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: '2', label: '2 Sharing' },
            { value: '3', label: '3 Sharing' },
            { value: '4', label: '4 Sharing' },
          ]}
          value={sharingFilter}
          onChange={(e) => { setSharingFilter(e.target.value); setPage(1); }}
          className="max-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="max-w-[160px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={rooms}
        keyExtractor={(row: RoomRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/rooms/${row._id}`)}
        pagination={{ page, perPage, total, onPageChange: (p) => setPage(p), onPerPageChange: (pp) => { setPerPage(pp); setPage(1); } }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteTarget?.roomNumber}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
