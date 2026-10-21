'use client';

import { useMemo, useState, Suspense } from 'react';
import { useQueries, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  ClipboardCheck,
  Download,
  Info,
  ListChecks,
  Plus,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson, type ApiQueryError } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { FilterChips } from '@/components/ui/FilterChips';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AttendanceMonthCalendar,
  type AttendanceDayMap,
} from '@/components/ui/AttendanceMonthCalendar';
import { AttendanceRangeFilter } from '@/components/ui/AttendanceRangeFilter';
import type { IAttendanceSummaryResponse, IAttendanceTodayResponse } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of an API response, never invented:
//   GET /attendance         apps/api/src/routes/attendance.ts:296-402
//   GET /attendance/today   apps/api/src/routes/attendance.ts:405-436
//   GET /attendance/summary apps/api/src/routes/attendance.ts:493-561
//   GET /tenants            apps/api/src/routes/tenants.ts:391-483
//   POST /attendance/manual apps/api/src/routes/attendance.ts:232-291

interface AttendanceRow {
  _id: string;
  tenant?: {
    _id?: string;
    user?: { name?: string } | null;
    room?: { roomNumber?: string } | null;
  } | null;
  tenantId?: unknown;
  date: string;
  status: string;
  method?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string;
  recordedBy?: { _id?: string; name?: string } | null;
  createdAt: string;
}

type ResidentRow = {
  _id: string;
  user?: { name?: string } | null;
  room?: { roomNumber?: string } | null;
  bedId?: string | null;
  isActive?: boolean;
};

interface AttendanceListBody {
  success: boolean;
  data: AttendanceRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Vocabulary ─────────────────────────────────────────────────────────

/** The states a day can hold for one resident (apps/api/src/models/attendanceRecord.ts:39). */
const STATUS_FILTERS = ['present', 'absent', 'on_leave', 'not_returned'] as const;

const LEDGER_TABS = [
  { key: '', label: 'All records' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'on_leave', label: 'On leave' },
  { key: 'not_returned', label: 'Not returned' },
];

/** The count keys the tab strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

const METHOD_OPTIONS = [
  { value: '', label: 'Any method' },
  { value: 'manual', label: 'Manual' },
  { value: 'app', label: 'Mobile App' },
  { value: 'qr', label: 'QR Scan' },
];

const METHOD_FILTERS = ['manual', 'app', 'qr'];

/** The states a bulk mark can write. */
const BULK_STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'not_returned', label: 'Not returned' },
];

const STATUS_LABELS: Record<string, string> = {
  present: 'present',
  absent: 'absent',
  on_leave: 'on leave',
  not_returned: 'not returned',
};

// ── Constants ──────────────────────────────────────────────────────────

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const PAGE_SIZE = 100;
/** The page size of the ledger table on screen. */
const LEDGER_PAGE_SIZE = 25;
/** How many days back the unrostered-day panel looks. */
const UNROSTERED_WINDOW_DAYS = 14;
/** How many names a message may carry before it counts the rest. */
const NAMES_IN_MESSAGE = 8;

const ATTENDANCE_LIST_KEY = ['attendance', 'list'] as const;
const ATTENDANCE_COUNT_KEY = ['attendance', 'count'] as const;
const ATTENDANCE_DAY_KEY = ['attendance', 'day'] as const;
const ATTENDANCE_ROSTER_KEY = ['attendance', 'roster'] as const;
const ATTENDANCE_SUMMARY_KEY = ['attendance', 'summary'] as const;

/** Stable empty fallbacks. `?? []` would allocate a fresh array on every render. */
const EMPTY_ROWS: AttendanceRow[] = [];
const EMPTY_RESIDENTS: ResidentRow[] = [];

// ── Helpers ────────────────────────────────────────────────────────────

/** The id of the resident a record belongs to, in whichever shape it arrives. */
function tenantIdOfRow(row: AttendanceRow): string {
  const mapped = row.tenant?._id;
  if (mapped !== undefined && mapped !== '') return mapped;
  const raw = row.tenantId as { _id?: unknown; id?: unknown } | string | null | undefined;
  if (typeof raw === 'string') return raw;
  const id = raw?._id ?? raw?.id;
  return id === undefined || id === null ? '' : String(id);
}

function residentName(resident: ResidentRow): string {
  return resident.user?.name ?? 'Unknown resident';
}

function residentWhere(resident: ResidentRow): string {
  const room = resident.room?.roomNumber ?? 'no room';
  const bed = resident.bedId ?? '?';
  return `Room ${room} · Bed ${bed}`;
}

function formatYmd(value: string): string {
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

/** A day shifted by a number of days, as the server spells a day. */
function shiftYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/**
 * Walks every page of a list endpoint.
 *
 * The server clamps one page to 100 rows (apps/api/src/lib/routeUtils.ts:16), so
 * a set that is bigger than one page has to be walked. The walk stops on the
 * page count the server reports and the total it reports travels with the
 * rows, so the screen can say how many records the set really holds.
 */
async function walkPages<T>(
  path: string,
  params: URLSearchParams,
): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = [];
  let total = 0;
  let page = 1;
  for (;;) {
    const pageParams = new URLSearchParams(params.toString());
    pageParams.set('page', String(page));
    pageParams.set('limit', String(PAGE_SIZE));
    const body = await queryJson<{
      success: boolean;
      data: T[];
      meta?: { total?: number; totalPages?: number };
    }>(`${path}?${pageParams.toString()}`);
    const pageRows = body.data ?? [];
    total = body.meta?.total ?? total;
    rows.push(...pageRows);
    const totalPages = body.meta?.totalPages ?? 1;
    if (page >= totalPages || pageRows.length === 0) break;
    page += 1;
  }
  return { rows, total };
}

/** The names of the residents a message names, and the count of the rest. */
function nameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length <= NAMES_IN_MESSAGE) return names.join(', ');
  return `${names.slice(0, NAMES_IN_MESSAGE).join(', ')} and ${names.length - NAMES_IN_MESSAGE} more`;
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // The day and the filters live in the address bar: a day's roster can be
  // linked, shared and cited, and a link that names a day lands on that day.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const methodState = useUrlState<string>('method', { defaultValue: '', allowed: METHOD_FILTERS });
  const tenantState = useUrlState<string>('tenantId', { defaultValue: '' });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const statusFilter = statusState.value;
  const methodFilter = methodState.value;
  const tenantFilter = tenantState.value;
  const search = searchState.value.trim();

  // The day in view. `date` names one day; `fromDate` and `toDate` name a
  // range. A broken value is ignored, so a bad link never empties the screen.
  const rawDay = searchParams.get('date');
  const urlDay = rawDay !== null && YMD.test(rawDay) ? rawDay : '';
  const rawFrom = searchParams.get('fromDate');
  const rawTo = searchParams.get('toDate');
  const fromDate = rawFrom !== null && YMD.test(rawFrom) ? rawFrom : '';
  const toDate = rawTo !== null && YMD.test(rawTo) ? rawTo : '';
  const rawMonth = searchParams.get('month');
  const urlMonth = rawMonth !== null && YM.test(rawMonth) ? rawMonth : '';
  const rangeInvalid = fromDate !== '' && toDate !== '' && fromDate > toDate;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(LEDGER_PAGE_SIZE);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('present');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    written: string[];
    skipped: { name: string; reason: string }[];
    failed: { name: string; reason: string }[];
  } | null>(null);

  /**
   * The server's business day.
   *
   * "Today" is the day in the PG timezone, not the day on the office laptop
   * (apps/api/src/routes/attendance.ts:406), so the board follows the server.
   */
  const todayQuery = useApiQuery<IAttendanceTodayResponse>(
    ['attendance', 'today'],
    'attendance/today',
  );
  const serverToday = todayQuery.data?.date ?? '';

  /**
   * The day the board shows.
   *
   * A day named in the address bar wins; a range of one day is the same day;
   * otherwise the board shows the server's today.
   */
  const boardDay =
    urlDay !== '' ? urlDay : fromDate !== '' && fromDate === toDate ? fromDate : serverToday;

  /**
   * The month the calendar draws.
   *
   * The month in the address bar wins; otherwise the month of the day in view;
   * otherwise the month of the server's today.
   */
  const boardMonth =
    urlMonth !== ''
      ? urlMonth
      : boardDay !== ''
        ? monthOf(boardDay)
        : monthOf(serverToday || '1970-01');
  const boardYear = Number(boardMonth.slice(0, 4));
  const boardMonthIndex = Number(boardMonth.slice(5, 7)) - 1;

  /**
   * The date scope of the ledger.
   *
   * The same scope is sent to the table, to the counts behind the tab strip
   * and to the export, so a number always answers the question the rows on
   * screen answer.
   */
  const ledgerScope = useMemo(() => {
    const params = new URLSearchParams();
    if (urlDay !== '') params.set('date', urlDay);
    else {
      if (fromDate !== '') params.set('fromDate', fromDate);
      if (toDate !== '') params.set('toDate', toDate);
    }
    return params;
  }, [urlDay, fromDate, toDate]);

  /** The filters of the ledger, without the status the tab strip holds. */
  const ledgerFilters = useMemo(() => {
    const params = new URLSearchParams(ledgerScope.toString());
    if (search !== '') params.set('search', search);
    if (methodFilter !== '') params.set('method', methodFilter);
    if (tenantFilter !== '') params.set('tenantId', tenantFilter);
    return params;
  }, [ledgerScope, search, methodFilter, tenantFilter]);

  const listParams = new URLSearchParams(ledgerFilters.toString());
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));
  if (statusFilter !== '') listParams.set('status', statusFilter);

  const {
    data: listBody,
    isPending: listLoading,
    error: listError,
  } = useApiBodyQuery<AttendanceListBody>(
    [
      ...ATTENDANCE_LIST_KEY,
      page,
      perPage,
      search,
      statusFilter,
      methodFilter,
      tenantFilter,
      urlDay,
      fromDate,
      toDate,
    ],
    `attendance?${listParams.toString()}`,
    { enabled: !rangeInvalid },
  );

  const records = listBody?.data ?? EMPTY_ROWS;
  const total = listBody?.meta.total ?? 0;

  /**
   * The counts behind the tab strip.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<AttendanceListBody, ApiQueryError> => {
      const params = new URLSearchParams(ledgerFilters.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key !== '') params.set('status', key);
      return {
        queryKey: [...ATTENDANCE_COUNT_KEY, ledgerFilters.toString(), key],
        queryFn: () => queryJson<AttendanceListBody>(`attendance?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta.total ?? null;
  });

  /**
   * The records of the day in view, read in full.
   *
   * The walk is needed because the set can be bigger than one page of the
   * server, and the board needs every record of the day to know who has none.
   */
  const dayRecordsQuery = useQuery<{ rows: AttendanceRow[]; total: number }, ApiQueryError>({
    queryKey: [...ATTENDANCE_DAY_KEY, boardDay],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('date', boardDay);
      return walkPages<AttendanceRow>('attendance', params);
    },
    enabled: boardDay !== '' && !rangeInvalid,
  });
  const dayRecords = dayRecordsQuery.data?.rows ?? EMPTY_ROWS;
  const dayRecordTotal = dayRecordsQuery.data?.total ?? 0;

  /**
   * The residents in the building.
   *
   * The roster of the active residents is what the board compares the day
   * against: a resident with no record for the day is a resident nobody marked.
   */
  const rosterQuery = useQuery<{ rows: ResidentRow[]; total: number }, ApiQueryError>({
    queryKey: [...ATTENDANCE_ROSTER_KEY],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('isActive', 'true');
      return walkPages<ResidentRow>('tenants', params);
    },
  });
  const roster = rosterQuery.data?.rows ?? EMPTY_RESIDENTS;
  const rosterTotal = rosterQuery.data?.total ?? 0;

  /**
   * The shape of the day, counted by the server.
   *
   * GET /attendance/summary counts the records of every day of the window, so
   * the numbers of the band are the server's and not a count the office made.
   */
  const summaryQuery = useApiQuery<IAttendanceSummaryResponse>(
    [...ATTENDANCE_SUMMARY_KEY, boardDay],
    `attendance/summary?fromDate=${boardDay}&toDate=${boardDay}`,
    { enabled: boardDay !== '' },
  );
  const dayCounts = summaryQuery.data?.days[boardDay] ?? null;

  /**
   * The month the calendar draws, counted by the server.
   *
   * The summary route answers with the days it holds, so the calendar colours
   * every day from a server count and not from a guess.
   */
  const calendarSummaryQuery = useApiQuery<IAttendanceSummaryResponse>(
    [...ATTENDANCE_SUMMARY_KEY, boardMonth],
    (() => {
      const lastDay = new Date(boardYear, boardMonthIndex + 1, 0).getDate();
      const last = String(lastDay).padStart(2, '0');
      return `attendance/summary?fromDate=${boardMonth}-01&toDate=${boardMonth}-${last}`;
    })(),
    { enabled: boardMonth !== '' && boardYear > 1970 },
  );
  const calendarDays: AttendanceDayMap = calendarSummaryQuery.data?.days ?? {};

  /**
   * The days of the last fortnight that hold no record at all.
   *
   * The summary route answers with the days it holds; a day it does not name
   * is a day nobody marked anything on.
   */
  const unrosteredQuery = useApiQuery<IAttendanceSummaryResponse>(
    [...ATTENDANCE_SUMMARY_KEY, 'window', serverToday],
    (() => {
      if (serverToday === '') return 'attendance/summary?fromDate=2000-01-01&toDate=2000-01-01';
      const from = shiftYmd(serverToday, -(UNROSTERED_WINDOW_DAYS - 1));
      return `attendance/summary?fromDate=${from}&toDate=${serverToday}`;
    })(),
    { enabled: serverToday !== '' },
  );

  const unrosteredDays = useMemo(() => {
    if (serverToday === '' || !unrosteredQuery.data) return [];
    const days = unrosteredQuery.data.days;
    const missing: string[] = [];
    for (let offset = UNROSTERED_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
      const ymd = shiftYmd(serverToday, -offset);
      if (days[ymd] === undefined) missing.push(ymd);
    }
    return missing;
  }, [serverToday, unrosteredQuery.data]);

  /**
   * The residents with no record for the day in view.
   *
   * The server has no endpoint for this list, so it is read from two server
   * answers: the roster of the active residents and the records of the day.
   * A resident is on the list when the day holds no record of them.
   */
  const notMarked = useMemo(() => {
    const marked = new Set<string>();
    for (const row of dayRecords) {
      const id = tenantIdOfRow(row);
      if (id !== '') marked.add(id);
    }
    return roster.filter((resident) => !marked.has(resident._id));
  }, [roster, dayRecords]);

  /** The residents the day already holds a record for. */
  const alreadyMarked = useMemo(() => {
    const marked = new Set<string>();
    for (const row of dayRecords) {
      const id = tenantIdOfRow(row);
      if (id !== '') marked.add(id);
    }
    return roster.filter((resident) => marked.has(resident._id));
  }, [roster, dayRecords]);

  /**
   * The records of the day that disagree with themselves.
   *
   * The server keeps the status and the times apart (the model holds both,
   * apps/api/src/models/attendanceRecord.ts:31-43), so a record can say the
   * resident never came back while it carries the moment they did. A day that
   * was never closed (a check-in with no check-out) is the same kind of hole.
   */
  const contradictions = useMemo(() => {
    const isPast = serverToday !== '' && boardDay < serverToday;
    return dayRecords.filter((row) => {
      const checkIn = row.checkInTime ?? row.checkIn ?? null;
      const checkOut = row.checkOutTime ?? row.checkOut ?? null;
      if (row.status === 'not_returned' && (checkIn !== null || checkOut !== null)) return true;
      if (isPast && row.status === 'present' && checkIn !== null && checkOut === null) return true;
      return false;
    });
  }, [dayRecords, boardDay, serverToday]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`attendance/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      setWriteResult(
        'The record is deleted. The server removed the row, wrote a delete entry in the audit log and told nobody: the resident still sees this day in their history until the server answers differently.',
      );
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 rows, so the export walks the pages of the
   * filtered set instead of asking for one big page that arrives truncated.
   * The operator is told how many records the server reports and how many the
   * file carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      // The export carries the same filters the table shows, status included.
      const exportParams = new URLSearchParams(ledgerFilters.toString());
      if (statusFilter !== '') exportParams.set('status', statusFilter);
      const walked = await walkPages<AttendanceRow>('attendance', exportParams);
      const rows = walked.rows;
      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no record for these filters.');
        return;
      }

      const headers = [
        'Resident',
        'Room',
        'Date',
        'Status',
        'Method',
        'Check in',
        'Check out',
        'Recorded by',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((row) => [
        escapeCsv(residentNameOfRow(row)),
        escapeCsv(roomNumberOfRow(row)),
        escapeCsv(row.date ? String(row.date).slice(0, 10) : ''),
        escapeCsv(STATUS_LABELS[row.status] ?? row.status),
        escapeCsv(row.method ?? ''),
        escapeCsv(row.checkInTime ?? row.checkIn ?? ''),
        escapeCsv(row.checkOutTime ?? row.checkOut ?? ''),
        escapeCsv(row.recordedBy?.name ?? ''),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((row) => row.join(','))].join(
        '\r\n',
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < walked.total
          ? `Export written with ${rows.length} of ${walked.total} records: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${rows.length} records the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  /**
   * The bulk mark of the day.
   *
   * The server has no bulk endpoint, so the page writes one record per
   * resident with the same route the single mark uses. Every answer is
   * reported: a resident marked in the meantime is refused by the server and
   * is never overwritten.
   */
  const runBulkMark = async () => {
    if (boardDay === '' || notMarked.length === 0) return;
    setBulkRunning(true);
    setError('');
    const written: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (const resident of notMarked) {
      const name = residentName(resident);
      try {
        await api
          .post('attendance/manual', {
            json: {
              tenantId: resident._id,
              date: boardDay,
              status: bulkStatus,
              method: 'manual',
            },
          })
          .json();
        written.push(name);
      } catch (err) {
        const parsed = await parseApiError(err);
        if (parsed.code === 'ALREADY_RECORDED') skipped.push({ name, reason: parsed.message });
        else failed.push({ name, reason: parsed.message });
      }
    }

    setBulkReport({ written, skipped, failed });
    setBulkOpen(false);
    setBulkRunning(false);
    setWriteResult(
      `The server wrote ${written.length} of ${notMarked.length} records for ${formatYmd(boardDay)}` +
        (skipped.length > 0
          ? `, refused ${skipped.length} because a record already existed for that resident and day`
          : '') +
        (failed.length > 0 ? `, and failed on ${failed.length}` : '') +
        '. Each write adds a create entry in the audit log. The resident is not told: the server sends no message for a manual mark.',
    );
    await queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const clearAllFilters = () => {
    writeUrl({
      status: null,
      method: null,
      tenantId: null,
      search: null,
      fromDate: null,
      toDate: null,
      date: null,
    });
    setPage(1);
  };

  const chips = [
    ...(statusFilter !== ''
      ? [
          {
            key: 'status',
            label: 'Status',
            value: STATUS_LABELS[statusFilter] ?? statusFilter,
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(methodFilter !== ''
      ? [
          {
            key: 'method',
            label: 'Method',
            value:
              METHOD_OPTIONS.find((option) => option.value === methodFilter)?.label ?? methodFilter,
            onRemove: () => {
              methodState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(tenantFilter !== ''
      ? [
          {
            key: 'tenant',
            label: 'Resident',
            value:
              roster.find((resident) => resident._id === tenantFilter)?.user?.name ?? tenantFilter,
            onRemove: () => {
              tenantState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(urlDay !== ''
      ? [
          {
            key: 'day',
            label: 'Day',
            value: formatYmd(urlDay),
            onRemove: () => {
              writeUrl({ date: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(fromDate !== '' || toDate !== ''
      ? [
          {
            key: 'range',
            label: 'Range',
            value: `${fromDate === '' ? 'start' : formatYmd(fromDate)} to ${toDate === '' ? 'today' : formatYmd(toDate)}`,
            onRemove: () => {
              writeUrl({ fromDate: null, toDate: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(search !== ''
      ? [
          {
            key: 'search',
            label: 'Search',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<AttendanceRow>[] = [
    {
      header: 'Resident',
      accessor: (row) => {
        const id = tenantIdOfRow(row);
        const name = residentNameOfRow(row);
        if (id === '') {
          return <span className="font-semibold text-(--color-text-primary)">{name}</span>;
        }
        return (
          <Link
            href={`/tenants/${id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {name}
          </Link>
        );
      },
    },
    { header: 'Room', accessor: (row) => roomNumberOfRow(row) },
    { header: 'Date', accessor: (row) => formatYmd(row.date) },
    {
      header: 'Status',
      accessor: (row) => (
        <div>
          <StatusBadge
            variant={statusToVariant(row.status)}
            label={STATUS_LABELS[row.status] ?? row.status}
          />
          {contradictionNote(row, serverToday) !== '' && (
            <span className="text-2xs block font-semibold text-(--color-warning-700)">
              {contradictionNote(row, serverToday)}
            </span>
          )}
        </div>
      ),
    },
    { header: 'Method', accessor: (row) => row.method ?? '-' },
    { header: 'Check in', accessor: (row) => formatClock(row.checkInTime ?? row.checkIn) },
    { header: 'Check out', accessor: (row) => formatClock(row.checkOutTime ?? row.checkOut) },
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

  const dayLabel = boardDay === '' ? 'the day in view' : formatYmd(boardDay);
  const boardIsToday = boardDay !== '' && boardDay === serverToday;
  const filtersActive = chips.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        description="The day nobody marked: which residents have no record, who came back, and which days were never rostered"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExportCsv()}
              disabled={exporting}
              loading={exporting}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/attendance/new?date=${boardDay}`)}
              disabled={boardDay === ''}
            >
              <Plus className="h-4 w-4" />
              Mark one resident
            </Button>
            <Button
              onClick={() => {
                setBulkReport(null);
                setBulkOpen(true);
              }}
              disabled={boardDay === '' || notMarked.length === 0}
            >
              <ListChecks className="h-4 w-4" />
              Mark the day
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(listError) || error} />

      {writeResult !== '' && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {bulkReport !== null && (bulkReport.skipped.length > 0 || bulkReport.failed.length > 0) && (
        <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-xs text-(--color-warning-800)">
          <p className="font-bold">The answers of the server, one line per resident</p>
          <ul className="mt-1.5 space-y-1">
            {bulkReport.skipped.map((item) => (
              <li key={`skipped-${item.name}`}>
                <span className="font-bold">{item.name}</span>: refused, {item.reason}
              </li>
            ))}
            {bulkReport.failed.map((item) => (
              <li key={`failed-${item.name}`}>
                <span className="font-bold">{item.name}</span>: failed, {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PageBand
        metrics={[
          {
            label: 'Day in view',
            value: boardDay === '' ? '-' : formatYmd(boardDay),
            hint: boardIsToday ? "the server's business day" : 'named in the address bar',
            tone: 'default',
          },
          {
            label: 'Records on this day',
            value: String(dayRecordTotal),
            hint: 'the server holds these records for this day',
            tone: 'default',
          },
          {
            label: 'Not marked',
            value: String(notMarked.length),
            hint: `of ${rosterTotal} active residents in the building`,
            tone: notMarked.length > 0 ? 'warning' : 'success',
          },
          {
            label: 'Days never rostered',
            value: String(unrosteredDays.length),
            hint: `of the last ${UNROSTERED_WINDOW_DAYS} days hold no record at all`,
            tone: unrosteredDays.length > 0 ? 'warning' : 'success',
          },
        ]}
      >
        <StatusTabs
          tabs={LEDGER_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'present'
                ? 'success'
                : tab.key === 'absent'
                  ? 'danger'
                  : tab.key === 'not_returned'
                    ? 'warning'
                    : 'brand',
          }))}
          active={statusFilter}
          onChange={(key) => {
            statusState.setValue(key);
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search by resident name..."
              aria-label="Search by resident name"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filter by method"
            size="compact"
            options={METHOD_OPTIONS}
            value={methodFilter}
            onChange={(e) => {
              methodState.setValue(e.target.value);
              setPage(1);
            }}
            className="max-w-[200px]"
          />
          <div className="min-w-[240px] flex-1 sm:max-w-[320px]">
            <ResourceSelect<ResidentRow>
              endpoint="tenants?isActive=true"
              value={tenantFilter}
              onChange={(value) => {
                tenantState.setValue(value);
                setPage(1);
              }}
              placeholder="All residents"
              valueKey="_id"
              labelKey={(item) => item.user?.name ?? 'Unknown resident'}
              sublabelFn={(item) =>
                `Room ${item.room?.roomNumber ?? 'N/A'} · Bed ${item.bedId ?? 'N/A'}`
              }
              dataPath="data"
            />
          </div>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>

        <div className="pt-2">
          <AttendanceRangeFilter
            fromDate={urlDay !== '' ? urlDay : fromDate}
            toDate={urlDay !== '' ? urlDay : toDate}
            onFromChange={(value) => {
              writeUrl({ fromDate: value || null, toDate: toDate || null, date: null });
              setPage(1);
            }}
            onToChange={(value) => {
              writeUrl({ fromDate: fromDate || null, toDate: value || null, date: null });
              setPage(1);
            }}
            onPreset={(nextFrom, nextTo) => {
              writeUrl({ fromDate: nextFrom, toDate: nextTo, date: null });
              setPage(1);
            }}
            onClear={() => {
              writeUrl({ fromDate: null, toDate: null, date: null });
              setPage(1);
            }}
          />
        </div>
      </PageBand>

      {/* The board of the day: the question this module exists for. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
                  <UserX className="h-4 w-4 text-(--color-warning-600)" />
                  {notMarked.length === 0
                    ? `Every active resident has a record for ${dayLabel}`
                    : `${notMarked.length} resident${notMarked.length === 1 ? '' : 's'} nobody marked for ${dayLabel}`}
                </h2>
                <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                  {rosterTotal === 0
                    ? 'The server reports no active resident in the building.'
                    : `The server holds ${rosterTotal} active resident${rosterTotal === 1 ? '' : 's'} and ${dayRecordTotal} record${dayRecordTotal === 1 ? '' : 's'} for this day. A resident with no record for the day is a resident nobody marked.`}
                </p>
                {dayCounts !== null && (
                  <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                    On this day the server counts {dayCounts.present} present, {dayCounts.absent}{' '}
                    absent, {dayCounts.on_leave} on leave and {dayCounts.not_returned} not returned.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  aria-label="The status the bulk mark writes"
                  size="compact"
                  options={BULK_STATUS_OPTIONS}
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkReport(null);
                    setBulkOpen(true);
                  }}
                  disabled={notMarked.length === 0}
                >
                  <ListChecks className="h-4 w-4" />
                  Mark the {notMarked.length} unmarked
                </Button>
              </div>
            </div>

            {notMarked.length === 0 ? (
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                Nothing to mark. The day holds a record for every active resident.
              </p>
            ) : (
              <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
                {notMarked.map((resident) => (
                  <li
                    key={resident._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/tenants/${resident._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-13 font-bold text-(--color-brand-600) hover:underline"
                      >
                        {residentName(resident)}
                      </Link>
                      <span className="text-2xs ml-2 font-medium text-(--color-text-muted)">
                        {residentWhere(resident)}
                      </span>
                    </div>
                    <Link
                      href={`/attendance/new?tenantId=${resident._id}&date=${boardDay}`}
                      className="text-2xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                    >
                      Mark this resident
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
            <h2 className="font-display flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
              <TriangleAlert className="h-4 w-4 text-(--color-warning-600)" />
              Records of {dayLabel} that disagree with themselves
            </h2>
            <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
              The server keeps the status and the times of a day apart, so a record can say the
              resident never came back while it carries the moment they did, or say they are present
              while nobody ever closed the day.
            </p>
            {contradictions.length === 0 ? (
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The records of this day agree with their own times.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {contradictions.map((row) => (
                  <li
                    key={row._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--color-warning-200) bg-(--color-warning-50) px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-13 font-bold text-(--color-text-primary)">
                        {residentNameOfRow(row)}
                      </span>
                      <span className="text-2xs ml-2 font-medium text-(--color-warning-800)">
                        {contradictionNote(row, serverToday)}
                      </span>
                    </div>
                    <Link
                      href={`/attendance/${row._id}/edit`}
                      className="text-2xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                    >
                      Correct the mark
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
            <AttendanceMonthCalendar
              key={boardMonth}
              days={calendarDays}
              initialYear={boardYear}
              initialMonth={boardMonthIndex}
              selectedDay={urlDay === '' ? null : urlDay}
              onSelectDay={(ymd) => {
                if (ymd === null) {
                  writeUrl({ date: null });
                  return;
                }
                writeUrl({ date: ymd, fromDate: null, toDate: null, month: monthOf(ymd) });
                setPage(1);
              }}
              onMonthChange={(year, month) => {
                const next = `${year}-${String(month + 1).padStart(2, '0')}`;
                writeUrl({ month: next });
              }}
            />
            <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
              The calendar draws the whole building. A day you pick goes into the address bar, so
              the roster of that day is a link.
            </p>
          </section>

          <section className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
            <h2 className="font-display flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
              <CalendarDays className="h-4 w-4 text-(--color-brand-600)" />
              Days nobody rostered
            </h2>
            <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
              The last {UNROSTERED_WINDOW_DAYS} days the server holds no record at all for. Pick one
              to open it.
            </p>
            {unrosteredDays.length === 0 ? (
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                Every day of the last {UNROSTERED_WINDOW_DAYS} holds at least one record.
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {unrosteredDays.map((ymd) => (
                  <li key={ymd}>
                    <Link
                      href={`/attendance?date=${ymd}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-13 font-bold text-(--color-brand-600) hover:underline"
                    >
                      {formatYmd(ymd)}
                    </Link>
                    <span className="text-2xs ml-2 font-medium text-(--color-text-muted)">
                      no record at all
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        keyExtractor={(row: AttendanceRow) => row._id}
        isLoading={listLoading}
        onRowClick={(row) => router.push(`/attendance/${row._id}`)}
        pagination={{
          page,
          perPage,
          total,
          onPageChange: (next) => setPage(next),
          onPerPageChange: (next) => {
            setPerPage(next);
            setPage(1);
          },
        }}
        emptyState={
          filtersActive ? (
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="No record in this view"
              description="The server reports no record for the filters above."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : (
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="No attendance record yet"
              description={`Nothing has been recorded for ${dayLabel}. The board above names the residents nobody marked.`}
              action={{
                label: 'Mark the day',
                onClick: () => {
                  setBulkReport(null);
                  setBulkOpen(true);
                },
              }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-(--color-text-primary)">
                {residentNameOfRow(row)}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={STATUS_LABELS[row.status] ?? row.status}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-muted)">
              <span>{roomNumberOfRow(row)}</span>
              <span>{formatYmd(row.date)}</span>
              {(row.checkInTime ?? row.checkIn) && (
                <span>In: {formatClock(row.checkInTime ?? row.checkIn)}</span>
              )}
              {(row.checkOutTime ?? row.checkOut) && (
                <span>Out: {formatClock(row.checkOutTime ?? row.checkOut)}</span>
              )}
            </div>
            {contradictionNote(row, serverToday) !== '' && (
              <p className="text-2xs font-semibold text-(--color-warning-700)">
                {contradictionNote(row, serverToday)}
              </p>
            )}
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

      {/* What the columns and the numbers mean. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          The day in view and every filter live in the address bar, so the roster of a day is a link
          that can be shared, cited and reviewed. The table shows the records in view; the board
          above shows the day.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Not marked</strong> counts the active
          residents who have no record for the day in view. The server holds no list of them, so the
          page reads it from two server answers: the roster of the active residents and the records
          of the day. The server&apos;s own board counts active residents minus the records of the
          day, so a record of a resident who has since checked out makes that number smaller than
          the number of residents nobody marked.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Mark the day</strong> writes one record
          per resident through the same route the single mark uses, because the server has no bulk
          endpoint. It never overwrites a record: the server refuses a second record for the same
          resident and day, and a resident marked in the meantime is reported as refused.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">
            Nothing is sent to the resident.
          </strong>{' '}
          A manual mark writes an audit entry and nothing else. The resident sees the row in their
          history the next time they open the app.
        </p>
      </div>

      <ConfirmModal
        open={bulkOpen}
        title={`Mark ${notMarked.length} resident${notMarked.length === 1 ? '' : 's'} for ${dayLabel}`}
        message={`This writes ${notMarked.length} record${notMarked.length === 1 ? '' : 's'}: one for each resident who has no record for ${dayLabel}, every one of them with the status "${STATUS_LABELS[bulkStatus] ?? bulkStatus}" and the method "manual". It will not touch the ${alreadyMarked.length} resident${alreadyMarked.length === 1 ? '' : 's'} who already have a record for that day${alreadyMarked.length > 0 ? `: ${nameList(alreadyMarked.map(residentName))}` : ''}. The server refuses a second record for the same resident and day, so a resident marked in the meantime is reported as refused and never overwritten. The resident is not told: the server sends no message for a manual mark.`}
        confirmLabel={`Write ${notMarked.length} record${notMarked.length === 1 ? '' : 's'}`}
        variant="warning"
        loading={bulkRunning}
        onConfirm={() => void runBulkMark()}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete the attendance record"
        message={`The server removes the record of ${deleteTarget ? residentNameOfRow(deleteTarget) : 'this resident'} for ${deleteTarget ? formatYmd(deleteTarget.date) : 'this day'}, writes a delete entry in the audit log and sends no message. The row disappears from the day, the month calendar and the resident history at once. It cannot be undone.`}
        confirmLabel="Delete the record"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Row helpers ────────────────────────────────────────────────────────

function residentNameOfRow(row: AttendanceRow): string {
  const mapped = row.tenant?.user?.name;
  if (mapped !== undefined && mapped !== '') return mapped;
  const raw = row.tenantId as
    { userId?: { name?: string }; user?: { name?: string } } | null | undefined;
  return raw?.userId?.name ?? raw?.user?.name ?? 'Unknown resident';
}

function roomNumberOfRow(row: AttendanceRow): string {
  const mapped = row.tenant?.room?.roomNumber;
  if (mapped !== undefined && mapped !== '') return mapped;
  const raw = row.tenantId as
    { roomId?: { roomNumber?: string }; room?: { roomNumber?: string } } | null | undefined;
  return raw?.roomId?.roomNumber ?? raw?.room?.roomNumber ?? 'no room';
}

/**
 * What is wrong with a record whose status and times disagree.
 *
 * The server keeps the status and the two times apart (the model holds all
 * three, apps/api/src/models/attendanceRecord.ts:31-43), so a record can carry
 * the moment a resident came back while the mark says they never came.
 */
function contradictionNote(row: AttendanceRow, serverToday: string): string {
  const checkIn = row.checkInTime ?? row.checkIn ?? null;
  const checkOut = row.checkOutTime ?? row.checkOut ?? null;
  if (row.status === 'not_returned' && (checkIn !== null || checkOut !== null)) {
    const when =
      checkOut !== null
        ? `signed out at ${formatClock(checkOut)}`
        : `signed in at ${formatClock(checkIn)}`;
    return `marked not returned, but the resident ${when}`;
  }
  const isPast = serverToday !== '' && row.date.slice(0, 10) < serverToday;
  if (isPast && row.status === 'present' && checkIn !== null && checkOut === null) {
    return `the day was never closed: in at ${formatClock(checkIn)}, no sign out`;
  }
  return '';
}
