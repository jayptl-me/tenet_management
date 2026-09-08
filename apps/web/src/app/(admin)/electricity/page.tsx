'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Zap, Download, IndianRupee, PlugZap, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';

interface RoomEntry {
  roomId?: { roomNumber?: string; floorId?: { label?: string } | null };
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
  const router = useRouter();
  const [bills, setBills] = useState<ElectricityBillRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ElectricityBillRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);
      if (monthFilter) params.set('month', monthFilter);

      const res = await api.get(`electricity?${params.toString()}`).json<{
        success: boolean;
        data: ElectricityBillRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setBills(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, monthFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`electricity/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchBills();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const summary = useMemo(() => {
    let billed = 0;
    let units = 0;
    let distributed = 0;
    for (const bill of bills) {
      billed += bill.totalBillAmount ?? 0;
      if (bill.status === 'distributed') distributed += bill.totalBillAmount ?? 0;
      for (const entry of bill.roomEntries ?? []) {
        units += entry.unitsConsumed ?? 0;
      }
    }
    return { billed, units, distributed, count: bills.length };
  }, [bills]);

  const handleExportCsv = async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      if (monthFilter) params.set('month', monthFilter);
      const res = await api.get(`electricity?${params.toString()}`).json<{
        success: boolean;
        data: ElectricityBillRow[];
      }>();
      const rows = res.data ?? [];
      if (rows.length === 0) return;
      const headers = ['Month', 'Total Amount', 'Rooms', 'Units', 'Status', 'Created At'];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const lines = [
        headers.join(','),
        ...rows.map((row) =>
          [
            row.month,
            row.totalBillAmount,
            row.roomEntries?.length ?? 0,
            (row.roomEntries ?? []).reduce((s, e) => s + (e.unitsConsumed ?? 0), 0),
            row.status,
            row.createdAt,
          ]
            .map(escapeCsv)
            .join(','),
        ),
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `electricity-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const columns: DataTableColumn<ElectricityBillRow>[] = [
    {
      header: 'Month',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.month}</span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          ₹{row.totalBillAmount.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Rooms',
      accessor: (row) => `${row.roomEntries?.length ?? 0}`,
    },
    {
      header: 'Units',
      accessor: (row) =>
        `${(row.roomEntries ?? []).reduce((s, e) => s + (e.unitsConsumed ?? 0), 0).toLocaleString()}`,
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
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-text-muted)]">
          {row.notes ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/electricity/${row._id}`)}
          showEdit={row.status === 'draft'}
          onEdit={() => router.push(`/electricity/${row._id}/edit`)}
          showDelete={row.status !== 'distributed'}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Electricity Bills"
        description="Track electricity usage and billing by month"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCsv} disabled={bills.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/electricity/new')}>
              <Plus className="h-4 w-4" />
              Record Bill
            </Button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Billed (page)"
          value={`₹${summary.billed.toLocaleString('en-IN')}`}
          icon={<IndianRupee className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard
          title="Units (page)"
          value={summary.units.toLocaleString('en-IN')}
          icon={<PlugZap className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Distributed (page)"
          value={`₹${summary.distributed.toLocaleString('en-IN')}`}
          icon={<Zap className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          title="Bills (page)"
          value={summary.count}
          icon={<CalendarClock className="h-4 w-4" />}
          variant="default"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <DatePicker
          type="month"
          aria-label="Filter by month"
          value={monthFilter}
          onChange={(val: string) => {
            setMonthFilter(val);
            setPage(1);
          }}
          className="w-full sm:w-[180px]"
        />
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
          className="w-full sm:w-[180px]"
          aria-label="Filter by status"
        />
      </div>

      <DataTable
        columns={columns}
        data={bills}
        keyExtractor={(row: ElectricityBillRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/electricity/${row._id}`)}
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
            icon={<Zap className="h-12 w-12" />}
            title="No electricity bills yet"
            description="Record your first electricity bill to get started"
            action={{ label: 'Record Bill', onClick: () => router.push('/electricity/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.month}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>₹{row.totalBillAmount.toLocaleString()}</span>
              <span>{row.roomEntries?.length ?? 0} rooms</span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/electricity/${row._id}`)}
                showEdit={row.status === 'draft'}
                onEdit={() => router.push(`/electricity/${row._id}/edit`)}
                showDelete={row.status !== 'distributed'}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Electricity Bill"
        message="Are you sure you want to delete this electricity bill? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
