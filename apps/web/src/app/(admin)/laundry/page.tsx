'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, XCircle, Shirt, Download, Info, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { tenantLabel } from '@/lib/resource-select-presets';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET  /laundry-slots             apps/api/src/routes/laundry.ts:128-230
//   GET  /laundry-slots/:id         apps/api/src/routes/laundry.ts:233-254
//   PUT  /laundry-slots/:id         apps/api/src/routes/laundry.ts:351-461
//   POST /laundry-slots/:id/cancel  apps/api/src/routes/laundry.ts:464-554
//   DELETE /laundry-slots/:id       apps/api/src/routes/laundry.ts:557-580

interface LaundryTenant {
  _id: string;
  bedId?: string | null;
  user?: { name?: string; phone?: string };
  room?: { roomNumber?: string; floor?: { label?: string } | null };
}

interface LaundryRow {
  _id: string;
  tenant?: LaundryTenant;
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

interface LaundryListBody {
  success: boolean;
  data: LaundryRow[];
  meta: { total: number; page?: number; limit?: number; totalPages?: number };
}

// ── The rules the server holds ─────────────────────────────────────────

/**
 * The facility capacity of one slot time.
 *
 * The server refuses a sixth booking at the same date and time with
 * SLOT_FULL (apps/api/src/routes/laundry.ts:274-292), so this is the number
 * of places a slot time holds.
 */
const CAPACITY = 5;

/** The page size the server clamps every list to (apps/api/src/lib/routeUtils.ts:16). */
const MAX_PAGE_SIZE = 100;

/** The statuses the model holds (apps/api/src/models/laundrySlot.ts:38). */
const STATUS_FILTERS = ['booked', 'confirmed', 'completed', 'cancelled'] as const;

const STATUS_TABS = [
  { key: '', label: 'All slots' },
  { key: 'booked', label: 'Booked' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * The day the server calls today.
 *
 * The server compares a slot date with its own UTC clock
 * (apps/api/src/routes/laundry.ts:269, :378), so the office uses the same
 * day here. A local calendar day would be one day ahead of the server for
 * half the day, and the booking would be refused.
 */
function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * The server's own words for a refusal.
 *
 * The shared parser maps every 400 to one generic sentence, and the laundry
 * route puts the reason in the message of the response (a date in the past, a
 * full slot time, a duplicate booking). The office has to read the reason, so
 * the message of the body is read first and the shared parser is the fallback.
 */
async function serverMessage(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: unknown }).response;
    if (res instanceof Response) {
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        const message = body?.error?.message;
        if (typeof message === 'string' && message.trim() !== '') return message;
      } catch {
        // The body was not a JSON envelope: the shared parser takes over.
      }
    }
  }
  return (await parseApiError(err)).message;
}

/**
 * Reads the whole filtered set, page by page.
 *
 * The server serves at most 100 rows in one page, so a set larger than that
 * has to be walked before it can be counted. The walk reports both numbers:
 * the rows the server holds and the rows that were read.
 */
async function fetchAllSlots(
  params: URLSearchParams,
): Promise<{ rows: LaundryRow[]; reportedTotal: number }> {
  const rows: LaundryRow[] = [];
  let reportedTotal = 0;
  let page = 1;
  for (;;) {
    const pageParams = new URLSearchParams(params.toString());
    pageParams.set('page', String(page));
    pageParams.set('limit', String(MAX_PAGE_SIZE));
    const res = await queryJson<LaundryListBody>(`laundry-slots?${pageParams.toString()}`);
    const pageRows = res.data ?? [];
    reportedTotal = res.meta?.total ?? reportedTotal;
    rows.push(...pageRows);
    const totalPages = res.meta?.totalPages ?? 1;
    if (page >= totalPages || pageRows.length === 0) break;
    page += 1;
  }
  return { rows, reportedTotal };
}

const LAUNDRY_LIST_KEY = ['laundry-slots', 'list'] as const;
const LAUNDRY_SET_KEY = ['laundry-slots', 'set'] as const;

function LaundryContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a day's queue can be linked, cited
  // and reviewed, and a link that carries a query parameter lands filtered.
  const statusState = useUrlState<string>('status', {
    defaultValue: '',
    allowed: STATUS_FILTERS,
  });
  const dayState = useUrlState<string>('slotDate', { defaultValue: '' });
  const tenantState = useUrlState<string>('tenantId', { defaultValue: '' });
  const { write: writeUrl } = useUrlStateWriter();

  const statusFilter = statusState.value;
  // A broken parameter must never filter the list to nothing: the server
  // answers a malformed date or id with a 400 (apps/api/src/routes/laundry.ts:186-197).
  const dayFilter = DAY_PATTERN.test(dayState.value) ? dayState.value : '';
  const tenantFilter = OBJECT_ID_PATTERN.test(tenantState.value) ? tenantState.value : '';

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [busyId, setBusyId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LaundryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * The parameters of the set, without the status.
   *
   * The status filter narrows the rows on screen. The places of a slot time
   * and the counts behind the tabs are properties of the whole set, so they
   * are read without the status and they do not move when a tab is clicked.
   */
  const setParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dayFilter) params.set('slotDate', dayFilter);
    if (tenantFilter) params.set('tenantId', tenantFilter);
    return params;
  }, [dayFilter, tenantFilter]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams(setParams.toString());
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', String(perPage));
    // A day is read in the order of the day; the whole set in the order of the
    // date (the server sorts by one field, apps/api/src/routes/laundry.ts:203-205).
    params.set('sort', dayFilter ? 'slotTime' : 'slotDate');
    params.set('order', 'asc');
    return params;
  }, [setParams, statusFilter, page, perPage, dayFilter]);

  const {
    data: slotsBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<LaundryListBody>(
    [...LAUNDRY_LIST_KEY, page, perPage, statusFilter, dayFilter, tenantFilter],
    `laundry-slots?${listParams.toString()}`,
  );

  /**
   * The whole set, walked page by page.
   *
   * The module question is when the machines are free and who holds the
   * place, and the server answers that over the whole set, not over the page
   * on screen. The set is read without the status filter, because the places
   * of a slot time do not change when the office looks at one status.
   */
  const setQuery = useQuery({
    queryKey: [...LAUNDRY_SET_KEY, dayFilter, tenantFilter],
    queryFn: () => fetchAllSlots(setParams),
    staleTime: 15_000,
  });

  const slots = slotsBody?.data ?? [];
  const total = slotsBody?.meta?.total ?? 0;
  // The rows of the set in view, kept stable so the memos below do not
  // depend on a fresh array on every render.
  const viewRows = useMemo(() => setQuery.data?.rows ?? [], [setQuery.data?.rows]);
  const setTotal = setQuery.data?.reportedTotal ?? 0;

  /**
   * The places of every slot time of the set.
   *
   * The server counts a place for every booking that is not cancelled
   * (apps/api/src/routes/laundry.ts:276-280), so a slot that is already done
   * still holds its place and a cancelled one does not.
   */
  const placesByTime = useMemo(() => {
    const map = new Map<string, LaundryRow[]>();
    for (const row of viewRows) {
      if (row.status === 'cancelled') continue;
      const key = `${row.slotDate} ${row.slotTime}`;
      const list = map.get(key);
      if (list === undefined) map.set(key, [row]);
      else list.push(row);
    }
    return map;
  }, [viewRows]);

  /** The busiest slot time of the set: the number no other module can compute. */
  const busiest = useMemo(() => {
    let best: { day: string; time: string; rows: LaundryRow[] } | null = null;
    for (const [key, rows] of placesByTime) {
      if (best === null || rows.length > best.rows.length) {
        const [day = '', time = ''] = key.split(' ');
        best = { day, time, rows };
      }
    }
    return best;
  }, [placesByTime]);

  const bookedCount = useMemo(
    () => viewRows.filter((row) => row.status === 'booked').length,
    [viewRows],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': setTotal };
    for (const status of STATUS_FILTERS) {
      counts[status] = viewRows.filter((row) => row.status === status).length;
    }
    return counts;
  }, [viewRows, setTotal]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: LAUNDRY_LIST_KEY });
    queryClient.invalidateQueries({ queryKey: LAUNDRY_SET_KEY });
  }, [queryClient]);

  /**
   * Move a slot to the next status, and report what the server committed.
   *
   * The screen never claims a state the server did not write: the answer of
   * the write is read back and shown, and the table is re-read from the
   * server afterwards.
   */
  const handleStatusWrite = async (slot: LaundryRow, next: 'confirmed' | 'completed') => {
    setBusyId(slot._id);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .put(`laundry-slots/${slot._id}`, { json: { status: next } })
        .json<{ success: boolean; data: LaundryRow }>();
      const committed = res?.data?.status ?? next;
      const name = slot.tenant?.user?.name ?? 'The resident';
      setWriteResult(
        committed === 'confirmed'
          ? `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to confirmed and pushed a service update to ${name}: "Your laundry slot on ${slot.slotDate} at ${slot.slotTime} is confirmed. Please bring your laundry at that time." A push that fails is logged by the server and never undoes the write.`
          : `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to completed and wrote an update entry in the audit log. It sends no message: the resident is not told that the slot was closed.`,
      );
      refresh();
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setBusyId('');
    }
  };

  /**
   * Give the place up.
   *
   * The cancel route is the domain route for it: it refuses an already
   * cancelled slot and a completed one, and it frees the place at that time.
   */
  const handleCancel = async (slot: LaundryRow) => {
    setBusyId(slot._id);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .post(`laundry-slots/${slot._id}/cancel`, { json: {} })
        .json<{ success: boolean; data: LaundryRow }>();
      const committed = res?.data?.status ?? 'cancelled';
      const name = slot.tenant?.user?.name ?? 'The resident';
      setWriteResult(
        `The server set the slot of ${name} on ${slot.slotDate} at ${slot.slotTime} to ${committed} and wrote an update entry in the audit log. It sends no message: the resident is not told, and the place at that time is free again.`,
      );
      refresh();
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`laundry-slots/${deleteTarget._id}`).json();
      setWriteResult(
        `The server removed the slot of ${deleteTarget.tenant?.user?.name ?? 'the resident'} on ${deleteTarget.slotDate} at ${deleteTarget.slotTime} and wrote a delete entry in the audit log. The record is gone: it is not a cancellation and the resident is not told.`,
      );
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The CSV of the filtered set.
   *
   * The server clamps a page to 100 rows, so the export walks the pages of
   * the set instead of asking for one big page that silently arrives short.
   * The file and the server are compared before the operator is told.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    setWriteResult('');
    try {
      const params = new URLSearchParams(setParams.toString());
      if (statusFilter) params.set('status', statusFilter);
      const { rows, reportedTotal } = await fetchAllSlots(params);

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no slot for these filters.');
        return;
      }

      const headers = [
        'Resident',
        'Room',
        'Bed',
        'Floor',
        'Slot Date',
        'Slot Time',
        'Items',
        'Status',
        'Notes',
        'Created At',
      ];
      const escapeCsv = (val: unknown): string => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const csvContent = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row) =>
          [
            escapeCsv(row.tenant?.user?.name ?? ''),
            escapeCsv(row.tenant?.room?.roomNumber ?? ''),
            escapeCsv(row.tenant?.bedId ?? ''),
            escapeCsv(row.tenant?.room?.floor?.label ?? ''),
            escapeCsv(row.slotDate),
            escapeCsv(row.slotTime),
            escapeCsv(row.items ?? 1),
            escapeCsv(row.status),
            escapeCsv(row.notes ?? ''),
            escapeCsv(row.createdAt),
          ].join(','),
        ),
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `laundry-slots-${serverToday()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `The export carries ${rows.length} of the ${reportedTotal} slots the server reports for these filters: the walk stops at the last page the server returns, so the file is short of the whole set.`
          : `The export carries all ${rows.length} slots the server reports for these filters.`,
      );
    } catch (err) {
      setError(await serverMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ status: null, slotDate: null, tenantId: null });
    setPage(1);
  };

  const tenantName = useMemo(() => {
    if (!tenantFilter) return '';
    const row = viewRows.find((slot) => slot.tenant?._id === tenantFilter);
    return row?.tenant?.user?.name ?? '';
  }, [viewRows, tenantFilter]);

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'Status',
            value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1),
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(dayFilter
      ? [
          {
            key: 'day',
            label: 'Day',
            value: formatDay(dayFilter),
            onRemove: () => {
              dayState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(tenantFilter
      ? [
          {
            key: 'tenant',
            label: 'Resident',
            value: tenantName || 'one resident',
            onRemove: () => {
              tenantState.reset();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const placesOf = (row: LaundryRow): number =>
    placesByTime.get(`${row.slotDate} ${row.slotTime}`)?.length ?? 0;

  const columns: DataTableColumn<LaundryRow>[] = [
    {
      header: 'Resident',
      accessor: (row) =>
        row.tenant?._id ? (
          <div>
            <Link
              href={`/tenants/${row.tenant._id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-(--color-brand-600) hover:underline"
            >
              {row.tenant.user?.name ?? 'View the resident'}
            </Link>
            <div className="text-2xs text-(--color-text-muted)">
              Room {row.tenant?.room?.roomNumber ?? 'unknown'}
              {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
              {row.tenant?.room?.floor?.label ? ` · ${row.tenant.room.floor.label}` : ''}
            </div>
          </div>
        ) : (
          <span className="text-(--color-text-muted)">The resident is not on this record</span>
        ),
    },
    {
      header: 'When',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-(--color-text-primary)">{formatDay(row.slotDate)}</div>
          <div className="text-2xs font-mono text-(--color-text-muted)">{row.slotTime}</div>
        </div>
      ),
    },
    {
      header: 'Items',
      accessor: (row) => `${row.items ?? 1}`,
    },
    {
      header: 'Places at this time',
      accessor: (row) => {
        if (row.status === 'cancelled') {
          return (
            <div>
              <span className="text-(--color-text-muted)">holds no place</span>
              <div className="text-2xs text-(--color-text-muted)">
                a cancelled slot does not take a place
              </div>
            </div>
          );
        }
        if (setQuery.isError) {
          return (
            <div>
              <span className="text-(--color-text-muted)">not reported</span>
              <div className="text-2xs text-(--color-text-muted)">
                the whole set could not be read
              </div>
            </div>
          );
        }
        const taken = placesOf(row);
        return (
          <div>
            <span
              className={
                taken >= CAPACITY
                  ? 'font-semibold text-(--color-warning-700)'
                  : 'font-semibold text-(--color-text-primary)'
              }
            >
              {taken} of {CAPACITY} taken
            </span>
            <div className="text-2xs text-(--color-text-muted)">
              {taken >= CAPACITY
                ? 'the time is full: the server refuses another booking'
                : `${CAPACITY - taken} place(s) free`}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'booked' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId === row._id}
              onClick={(e) => {
                e.stopPropagation();
                void handleStatusWrite(row, 'confirmed');
              }}
              title="Confirm the slot and tell the resident"
              aria-label="Confirm the slot and tell the resident"
            >
              <CheckCircle className="h-4 w-4 text-(--color-success-600)" />
            </Button>
          )}
          {row.status === 'confirmed' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId === row._id}
              onClick={(e) => {
                e.stopPropagation();
                void handleStatusWrite(row, 'completed');
              }}
              title="Close the slot as used"
              aria-label="Close the slot as used"
            >
              <CheckCircle className="h-4 w-4 text-(--color-brand-600)" />
            </Button>
          )}
          {(row.status === 'booked' || row.status === 'confirmed') && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId === row._id}
              onClick={(e) => {
                e.stopPropagation();
                void handleCancel(row);
              }}
              title="Give the place up"
              aria-label="Give the place up"
            >
              <XCircle className="h-4 w-4 text-(--color-danger-500)" />
            </Button>
          )}
          <TableActions
            onView={() => router.push(`/laundry/${row._id}`)}
            onEdit={() => router.push(`/laundry/${row._id}/edit`)}
            onDelete={() => setDeleteTarget(row)}
          />
        </div>
      ),
    },
  ];

  const filtersActive = Boolean(statusFilter || dayFilter || tenantFilter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laundry slots"
        description="The queue of the shared machines: when a slot time is free, who holds the place, and what the office still has to confirm"
        action={
          <Button onClick={() => router.push('/laundry/new')}>
            <Plus className="h-4 w-4" />
            Book a slot
          </Button>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers, the status tabs and the filters in one
          surface, so the first data row is reachable without scrolling past
          half a screen of chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Slots in view',
            value: String(total),
            hint: 'the server reports these for the filters',
            tone: 'brand',
          },
          {
            label: 'Awaiting the office',
            value: setQuery.isPending ? '-' : String(bookedCount),
            hint: 'booked and not confirmed yet',
            tone: bookedCount > 0 ? 'warning' : 'default',
          },
          {
            label: 'Busiest time',
            value: busiest ? `${busiest.rows.length} of ${CAPACITY} places` : '-',
            hint: busiest
              ? `${formatDay(busiest.day)} at ${busiest.time} - ${CAPACITY - busiest.rows.length} free`
              : 'not reported',
            tone: busiest && busiest.rows.length >= CAPACITY ? 'warning' : 'default',
          },
        ]}
      >
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: statusCounts[tab.key] ?? null,
            tone:
              tab.key === 'booked'
                ? 'warning'
                : tab.key === 'confirmed'
                  ? 'success'
                  : tab.key === 'cancelled'
                    ? 'danger'
                    : tab.key === ''
                      ? 'brand'
                      : 'default',
          }))}
          active={statusFilter}
          onChange={(key) => {
            statusState.setValue(key);
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="w-full sm:w-52">
            <DatePicker
              aria-label="Filter by slot date"
              placeholder="Any day"
              value={dayFilter}
              onChange={(value: string | ChangeEvent<HTMLInputElement>) => {
                // The picker hands over a change event whose target carries the
                // day it picked (apps/web/src/components/ui/DatePicker.tsx:202-221).
                const next = typeof value === 'string' ? value : value.target.value;
                dayState.setValue(next);
                setPage(1);
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dayState.setValue(serverToday());
              setPage(1);
            }}
            title="The day the server calls today"
          >
            Today
          </Button>
          <div className="w-full sm:w-60">
            <ResourceSelect
              endpoint="tenants"
              value={tenantFilter}
              onChange={(val) => {
                tenantState.setValue(val);
                setPage(1);
              }}
              placeholder="All residents"
              valueKey="_id"
              labelKey={tenantLabel}
              dataPath="data"
            />
          </div>
          <Button
            variant="outline"
            loading={exporting}
            disabled={exporting}
            onClick={() => void handleExportCsv()}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {setQuery.isError && (
        <p className="text-2xs flex items-start gap-1.5 font-semibold text-(--color-warning-800)">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The whole set could not be read, so the places of a slot time and the counts behind the
          tabs are not reported: {errorMessage(setQuery.error)}
        </p>
      )}

      <DataTable
        columns={columns}
        data={slots}
        keyExtractor={(row: LaundryRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/laundry/${row._id}`)}
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
          // The empty state answers the question the operator asked. An empty
          // filter is not the same as an empty module.
          filtersActive ? (
            <EmptyState
              icon={<Shirt className="h-10 w-10" />}
              title="No slot in this view"
              description="The server reports no slot for the filters above. The places of the other days are not on this screen."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : (
            <EmptyState
              icon={<Shirt className="h-10 w-10" />}
              title="No laundry slot is booked yet"
              description="What is expected next: a resident books a slot from the portal, or you book one here. The office confirms the booking, the resident is told the time, and the slot is closed after the laundry is done."
              action={{ label: 'Book a slot', onClick: () => router.push('/laundry/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              {row.tenant?._id ? (
                <Link
                  href={`/tenants/${row.tenant._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  {row.tenant.user?.name ?? 'View the resident'}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-(--color-text-primary)">
                  Unknown resident
                </span>
              )}
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-muted)">
              <span>
                {formatDay(row.slotDate)} at {row.slotTime}
              </span>
              <span>{row.items ?? 1} items</span>
              <span>
                {row.status === 'cancelled'
                  ? 'holds no place'
                  : setQuery.isError
                    ? 'places not reported'
                    : `${placesOf(row)} of ${CAPACITY} places taken`}
              </span>
            </div>
            <div className="text-2xs text-(--color-text-muted)">
              Room {row.tenant?.room?.roomNumber ?? 'unknown'}
              {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
            </div>
            <div className="flex items-center gap-1 pt-1">
              {row.status === 'booked' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === row._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleStatusWrite(row, 'confirmed');
                  }}
                  title="Confirm the slot and tell the resident"
                >
                  <CheckCircle className="h-4 w-4 text-(--color-success-600)" />
                </Button>
              )}
              {row.status === 'confirmed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === row._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleStatusWrite(row, 'completed');
                  }}
                  title="Close the slot as used"
                >
                  <CheckCircle className="h-4 w-4 text-(--color-brand-600)" />
                </Button>
              )}
              {(row.status === 'booked' || row.status === 'confirmed') && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === row._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCancel(row);
                  }}
                  title="Give the place up"
                >
                  <XCircle className="h-4 w-4 text-(--color-danger-500)" />
                </Button>
              )}
              <TableActions
                onView={() => router.push(`/laundry/${row._id}`)}
                onEdit={() => router.push(`/laundry/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />

      {/* What the columns and the numbers mean. A slot time is a queue, and a
          number nobody can place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every filter of this page lives in the address bar, so a day, a resident or a status is a
          link that can be shared and cited.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Places at this time</strong> is the load
          of a slot time against the capacity the server enforces: five bookings that are not
          cancelled (apps/api/src/routes/laundry.ts:274-292). A slot that is already done still
          holds its place, a cancelled one does not, and the count does not change with the status
          filter.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Busiest time</strong> is the slot time
          of the set that carries the most places, and the number of places still free there. It is
          read over the whole set, not over the page on screen.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Confirm</strong> is the one write that
          reaches the resident: the server pushes a service update with the date and the time of the
          slot. Completing a slot and cancelling it reach nobody.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete the laundry slot"
        message={`The server removes the record of ${deleteTarget?.tenant?.user?.name ?? 'the resident'} on ${deleteTarget?.slotDate ?? ''} at ${deleteTarget?.slotTime ?? ''} for good and writes a delete entry in the audit log. This is not a cancellation: the record is gone, the resident is not told, and the place at that time is free again. Cancelling the slot keeps the record and the trail.`}
        confirmLabel="Delete the slot"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function LaundryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <LaundryContent />
    </Suspense>
  );
}
