'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardCheck, Download, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { TodayAttendanceBoard } from '@/components/ui/TodayAttendanceBoard';
import {
  AttendanceMonthCalendar,
  type AttendanceDayMap,
} from '@/components/ui/AttendanceMonthCalendar';
import { AttendanceRangeFilter } from '@/components/ui/AttendanceRangeFilter';
import { AttendanceDayDetail, type AttendanceDayRecord } from '@/components/ui/AttendanceDayDetail';
import { useRouter } from 'next/navigation';
import type { IAttendanceSummaryResponse } from '@pg/types';

interface AttendanceRow {
  _id: string;
  tenant?: { _id?: string; user?: { name: string }; room?: { roomNumber: string } } | null;
  tenantId?: unknown;
  date: string;
  status: string;
  method?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
  createdAt: string;
}

interface TenantOption extends Record<string, unknown> {
  _id: string;
  user?: { name: string; phone: string };
  room?: { roomNumber: string };
  bedId?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'not_returned', label: 'Not Returned' },
];

const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'manual', label: 'Manual' },
  { value: 'app', label: 'Mobile App' },
  { value: 'qr', label: 'QR Scan' },
];

function tenantNameOf(row: AttendanceRow): string {
  if (row.tenant?.user?.name) return row.tenant.user.name;
  const raw = row.tenantId as unknown as {
    userId?: { name?: string };
    user?: { name?: string };
  } | null;
  return raw?.userId?.name ?? raw?.user?.name ?? 'N/A';
}

function roomNumberOf(row: AttendanceRow): string {
  if (row.tenant?.room?.roomNumber) return row.tenant.room.roomNumber;
  const raw = row.tenantId as unknown as {
    roomId?: { roomNumber?: string };
    room?: { roomNumber?: string };
  } | null;
  return raw?.roomId?.roomNumber ?? raw?.room?.roomNumber ?? 'N/A';
}

function formatYmd(value: string): string {
  try {
    return new Date(value.length <= 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatClock(value: string | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function AttendancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [calendarDays, setCalendarDays] = useState<AttendanceDayMap>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<AttendanceDayRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);

  const rangeInvalid = fromDate !== '' && toDate !== '' && fromDate > toDate;

  const fetchRecords = useCallback(async () => {
    if (rangeInvalid) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (methodFilter) params.set('method', methodFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`attendance?${params.toString()}`).json<{
        success: boolean;
        data: AttendanceRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setRecords(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    perPage,
    search,
    statusFilter,
    methodFilter,
    tenantFilter,
    fromDate,
    toDate,
    rangeInvalid,
  ]);

  const fetchSummary = useCallback(
    async (year: number, month: number) => {
      setCalendarLoading(true);
      try {
        const last = new Date(year, month + 1, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, '0');
        const from = `${year}-${pad(month + 1)}-01`;
        const to = `${year}-${pad(month + 1)}-${pad(last)}`;
        const params = new URLSearchParams();
        params.set('fromDate', from);
        params.set('toDate', to);
        if (tenantFilter) params.set('tenantId', tenantFilter);
        const res = await api.get(`attendance/summary?${params.toString()}`).json<{
          success: boolean;
          data: IAttendanceSummaryResponse;
        }>();
        setCalendarDays(res.data.days ?? {});
      } catch {
        setCalendarDays({});
      } finally {
        setCalendarLoading(false);
      }
    },
    [tenantFilter],
  );

  const fetchDayRecords = useCallback(
    async (ymd: string) => {
      setDayLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('date', ymd);
        params.set('limit', '50');
        if (statusFilter) params.set('status', statusFilter);
        if (methodFilter) params.set('method', methodFilter);
        if (tenantFilter) params.set('tenantId', tenantFilter);
        if (search.trim()) params.set('search', search.trim());
        const res = await api.get(`attendance?${params.toString()}`).json<{
          success: boolean;
          data: AttendanceDayRecord[];
        }>();
        setDayRecords(res.data ?? []);
      } catch {
        setDayRecords([]);
      } finally {
        setDayLoading(false);
      }
    },
    [statusFilter, methodFilter, tenantFilter, search],
  );

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    const now = new Date();
    fetchSummary(now.getFullYear(), now.getMonth());
  }, [fetchSummary]);

  useEffect(() => {
    if (selectedDay) fetchDayRecords(selectedDay);
    else setDayRecords([]);
  }, [selectedDay, fetchDayRecords]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`attendance/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchRecords();
      const now = new Date();
      fetchSummary(now.getFullYear(), now.getMonth());
      if (selectedDay) fetchDayRecords(selectedDay);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '500');
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (methodFilter) params.set('method', methodFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await api.get(`attendance?${params.toString()}`).json<{
        success: boolean;
        data: AttendanceRow[];
      }>();
      const rows = res.data ?? [];
      if (rows.length === 0) {
        setError('Nothing to export for the current filters');
        return;
      }
      const headers = ['Tenant', 'Room', 'Date', 'Status', 'Method', 'Check In', 'Check Out'];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
        return `"${str.replace(/"/g, '""')}"`;
      };
      const lines = rows.map((r) =>
        [
          escapeCsv(tenantNameOf(r)),
          escapeCsv(roomNumberOf(r)),
          escapeCsv(r.date ? String(r.date).slice(0, 10) : ''),
          escapeCsv(r.status ? r.status.replace(/_/g, ' ') : ''),
          escapeCsv(r.method ?? ''),
          escapeCsv(r.checkInTime ?? r.checkIn ?? ''),
          escapeCsv(r.checkOutTime ?? r.checkOut ?? ''),
        ].join(','),
      );
      const csvContent = [headers.join(','), ...lines].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const resetPage = () => setPage(1);

  const columns: DataTableColumn<AttendanceRow>[] = [
    {
      header: 'Tenant',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {tenantNameOf(row)}
        </span>
      ),
    },
    { header: 'Room', accessor: (row) => roomNumberOf(row) },
    { header: 'Date', accessor: (row) => formatYmd(row.date) },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
        />
      ),
    },
    { header: 'Method', accessor: (row) => row.method ?? '—' },
    { header: 'Check In', accessor: (row) => formatClock(row.checkInTime ?? row.checkIn) },
    { header: 'Check Out', accessor: (row) => formatClock(row.checkOutTime ?? row.checkOut) },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/attendance/${row._id}`)}
          onEdit={() => router.push(`/attendance/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Track daily tenant attendance"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCalendar((v) => !v)}
              aria-pressed={showCalendar}
            >
              <CalendarDays className="h-4 w-4" />
              {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
            </Button>
            <Button variant="secondary" onClick={handleExportCsv} loading={exporting}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/attendance/new')}>
              <Plus className="h-4 w-4" />
              Mark Attendance
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <TodayAttendanceBoard
        selectedStatus={statusFilter}
        onSelectStatus={(status) => {
          setStatusFilter(status);
          resetPage();
        }}
      />

      {showCalendar && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4">
            <AttendanceMonthCalendar
              days={calendarDays}
              isLoading={calendarLoading}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onMonthChange={(y, m) => fetchSummary(y, m)}
            />
          </div>
          <AttendanceDayDetail
            date={selectedDay}
            records={dayRecords}
            isLoading={dayLoading}
            onViewRecord={(id) => router.push(`/attendance/${id}`)}
            onEditRecord={(id) => router.push(`/attendance/${id}/edit`)}
          />
        </div>
      )}

      <AttendanceRangeFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={(v) => {
          setFromDate(v);
          resetPage();
        }}
        onToChange={(v) => {
          setToDate(v);
          resetPage();
        }}
        onPreset={(from, to) => {
          setFromDate(from);
          setToDate(to);
          resetPage();
        }}
        onClear={() => {
          setFromDate('');
          setToDate('');
          resetPage();
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="Search by tenant name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          className="max-w-xs"
        />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            resetPage();
          }}
          className="max-w-[200px]"
        />
        <Select
          options={METHOD_OPTIONS}
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            resetPage();
          }}
          className="max-w-[200px]"
          aria-label="Method"
        />
        <div className="min-w-[240px] flex-1 sm:max-w-[320px]">
          <ResourceSelect<TenantOption>
            endpoint="tenants?isActive=true"
            value={tenantFilter}
            onChange={(v) => {
              setTenantFilter(v);
              resetPage();
            }}
            placeholder="Filter by tenant..."
            valueKey="_id"
            labelKey={(item) => item.user?.name ?? 'Unknown'}
            sublabelFn={(item) =>
              `Room ${item.room?.roomNumber ?? 'N/A'} · Bed ${item.bedId ?? 'N/A'}`
            }
            dataPath="data"
          />
        </div>
        {(tenantFilter !== '' || methodFilter !== '' || fromDate !== '' || toDate !== '') && (
          <Button
            variant="ghost"
            onClick={() => {
              setTenantFilter('');
              setMethodFilter('');
              setFromDate('');
              setToDate('');
              resetPage();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={records}
        keyExtractor={(row: AttendanceRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/attendance/${row._id}`)}
        pagination={{
          page,
          perPage,
          total,
          onPageChange: setPage,
          onPerPageChange: (pp) => {
            setPerPage(pp);
            resetPage();
          },
        }}
        emptyState={
          <EmptyState
            icon={<ClipboardCheck className="h-12 w-12" />}
            title="No attendance records yet"
            description="Mark your first attendance record to get started"
            action={{ label: 'Mark Attendance', onClick: () => router.push('/attendance/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {tenantNameOf(row)}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{roomNumberOf(row)}</span>
              <span>{formatYmd(row.date)}</span>
              {(row.checkInTime ?? row.checkIn) && (
                <span>In: {formatClock(row.checkInTime ?? row.checkIn)}</span>
              )}
              {(row.checkOutTime ?? row.checkOut) && (
                <span>Out: {formatClock(row.checkOutTime ?? row.checkOut)}</span>
              )}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/attendance/${row._id}`)}
                onEdit={() => router.push(`/attendance/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
