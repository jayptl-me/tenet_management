'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';

interface RoomEntry {
  roomId?: { roomNumber?: string };
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

interface ElectricityBillRow {
  _id: string;
  month: string;
  totalBillAmount: number;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  createdAt: string;
}

export default function ElectricityPage() {
  const [bills, setBills] = useState<ElectricityBillRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`electricity?${params.toString()}`).json<{
        success: boolean;
        data: ElectricityBillRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setBills(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load electricity bills');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const columns: DataTableColumn<ElectricityBillRow>[] = [
    {
      header: 'Month',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">{row.month}</span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (row) => (
        <span className="text-surface-900 font-semibold">₹{row.totalBillAmount.toLocaleString()}</span>
      ),
    },
    {
      header: 'Rooms',
      accessor: (row) => `${row.roomEntries?.length ?? 0}`,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
        />
      ),
    },
    {
      header: 'Notes',
      accessor: (row) => (
        <span className="text-surface-500 block max-w-[200px] truncate text-xs">
          {row.notes ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-surface-900 text-2xl font-extrabold">
          Electricity Bills
        </h2>
        <p className="text-surface-500 mt-0.5 text-sm">Track electricity usage and billing by month</p>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'finalized', label: 'Finalized' },
            { value: 'distributed', label: 'Distributed' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={bills}
        keyExtractor={(row: ElectricityBillRow) => row._id}
        isLoading={isLoading}
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
