'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Utensils,
  Download,
  Search,
  Info,
  MessageSquare,
  Check,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand, type PageBandMetric } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { StarRating } from '@/components/ui/StarRating';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /meals/feedback            apps/api/src/routes/meals.ts:319-401
//   GET /meals/feedback/summary    apps/api/src/routes/meals.ts:243-282
//   PUT /meals/:id                 apps/api/src/routes/meals.ts:431-513
//   DELETE /meals/:id              apps/api/src/routes/meals.ts:516-538

interface MealFeedbackRow {
  _id: string;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { _id?: string; name?: string; email?: string; phone?: string } | null;
    room?: {
      _id?: string;
      roomNumber?: string;
      floor?: { _id?: string; label?: string } | null;
    } | null;
  } | null;
  mealType: string;
  rating: number;
  comment?: string;
  categories?: string[];
  status: string;
  date?: string;
  createdAt: string;
}

interface MealsListBody {
  success: boolean;
  data: MealFeedbackRow[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

/** One rollup row of the server: a day, a meal service, its average and its count. */
interface SummaryRow {
  date: string;
  mealType: string;
  avgRating: number;
  count: number;
}

// ── Filter vocabulary ──────────────────────────────────────────────────

/** The tabs of the triage queue. The empty key is the whole set. */
const STATUS_TABS = [
  { key: '', label: 'All feedback' },
  { key: 'submitted', label: 'Waiting to be read' },
  { key: 'acknowledged', label: 'Read' },
  { key: 'actioned', label: 'Actioned' },
];

/** The values the status filter may take in the address bar. */
const STATUS_FILTERS = ['submitted', 'acknowledged', 'actioned'];

/** The count keys the tab strip reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/** The rating filter may only carry a rating the model allows. */
const RATING_FILTERS = ['1', '2', '3', '4', '5'];

/** The fields the server can sort the ledger by (apps/api/src/lib/routeUtils.ts:17-18). */
const SORT_FIELDS = ['createdAt', 'date', 'rating'];
const SORT_LABELS: Record<string, string> = {
  createdAt: 'When it was recorded',
  date: 'The day of the meal',
  rating: 'The rating',
};
const ORDERS = ['desc', 'asc'];

/** The status words the model holds, as the office reads them. */
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  actioned: 'Actioned',
};

/** A day the server can hold. Anything else is not sent to it. */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Stable empty fallbacks. `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for the memos.
const EMPTY_ROWS: MealFeedbackRow[] = [];
const EMPTY_SUMMARY: SummaryRow[] = [];

const MEALS_LIST_PREFIX = ['meals', 'list'] as const;
const MEALS_COUNT_PREFIX = ['meals', 'count'] as const;
const MEALS_SUMMARY_PREFIX = ['meals', 'summary'] as const;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * A day of the ledger, written out of the string the server holds.
 *
 * The meal day is a plain YYYY-MM-DD string (apps/api/src/models/mealFeedback.ts:21-26),
 * so it is read letter by letter: a Date would move it a day in a timezone
 * west of Greenwich.
 */
function formatDay(day: string | undefined | null): string {
  if (!day) return 'unknown';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = MONTHS[Number(match[2]) - 1];
  return `${Number(match[3])} ${month ?? match[2]} ${match[1]}`;
}

/** A timestamp of the server, written in the operator's timezone. */
function formatStamp(stamp: string | undefined | null): string {
  if (!stamp) return 'unknown';
  const parsed = new Date(stamp);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The resident who left the rating, as the server holds them. */
function residentName(row: MealFeedbackRow): string {
  return row.tenant?.user?.name ?? 'A resident the server no longer holds';
}

/**
 * The message the server pushes to the resident when the status moves.
 *
 * The wording is the server's (apps/api/src/routes/meals.ts:484-492): it names
 * the meal and the day of the rating, and it says whether the office read the
 * rating or acted on it.
 */
function residentMessage(mealType: string, day: string, next: 'acknowledged' | 'actioned'): string {
  return next === 'actioned'
    ? `We have acted on your feedback about the ${mealType} on ${day}.`
    : `We have read your feedback about the ${mealType} on ${day}.`;
}

/** A CSV cell: no formula, no line break, no unescaped quote. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// ── Page ───────────────────────────────────────────────────────────────

function MealsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a triage link that carries a status
  // lands on the rows it names, and a view of the module can be linked, shared
  // and cited. A parameter that is not a value the API accepts reads as no
  // filter, so a broken link never empties the ledger.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const mealState = useUrlState<string>('mealType', { defaultValue: '', allowed: MEAL_TYPES });
  const ratingState = useUrlState<string>('rating', { defaultValue: '', allowed: RATING_FILTERS });
  const dateState = useUrlState<string>('date', { defaultValue: '' });
  const sortState = useUrlState<string>('sort', {
    defaultValue: 'createdAt',
    allowed: SORT_FIELDS,
  });
  const orderState = useUrlState<string>('order', { defaultValue: 'desc', allowed: ORDERS });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [writingId, setWritingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MealFeedbackRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** The filters of the ledger, in one place, so every read sends the same set. */
  const filters = useMemo(
    () => ({
      status: statusState.value,
      mealType: mealState.value,
      rating: ratingState.value,
      // A date the server does not hold as a day is not sent to it.
      date: YMD.test(dateState.value) ? dateState.value : '',
      search: searchState.value.trim(),
      sort: sortState.value,
      order: orderState.value,
    }),
    [
      statusState.value,
      mealState.value,
      ratingState.value,
      dateState.value,
      searchState.value,
      sortState.value,
      orderState.value,
    ],
  );

  /**
   * The query parameters of the filtered set.
   *
   * The table, the counts behind the status tabs and the CSV export all send
   * this set. A number that answers a different question than the rows would
   * be a number nobody can trust.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.mealType) params.set('mealType', filters.mealType);
    if (filters.rating) params.set('rating', filters.rating);
    if (filters.date) params.set('date', filters.date);
    if (filters.search) params.set('search', filters.search);
    params.set('sort', filters.sort);
    params.set('order', filters.order);
    return params;
  }, [filters]);

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<MealsListBody>(
    [...MEALS_LIST_PREFIX, page, perPage, filters],
    `meals/feedback?${listParams.toString()}`,
  );

  const rows = listBody?.data ?? EMPTY_ROWS;
  const total = listBody?.meta?.total ?? 0;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<MealsListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('status', key);
      return {
        queryKey: [...MEALS_COUNT_PREFIX, filters, key],
        queryFn: () => queryJson<MealsListBody>(`meals/feedback?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta?.total ?? null;
  });

  /**
   * The rollup of the server: one row per day and meal service, with the
   * average the server computed over the ratings of that service.
   *
   * The endpoint filters by a day only, so the band shows the day in view,
   * or the most recent day the server reports when the operator has not
   * picked one.
   */
  const summaryParams = new URLSearchParams();
  if (filters.date) {
    summaryParams.set('dateFrom', filters.date);
    summaryParams.set('dateTo', filters.date);
  }
  const summaryQuery = summaryParams.toString();
  const { data: summaryRows = EMPTY_SUMMARY } = useApiQuery<SummaryRow[]>(
    [...MEALS_SUMMARY_PREFIX, filters.date],
    summaryQuery === '' ? 'meals/feedback/summary' : `meals/feedback/summary?${summaryQuery}`,
  );

  /** The day the ratings of the band belong to. */
  const serviceDay = useMemo(() => {
    if (filters.date) return filters.date;
    return summaryRows.reduce((latest, row) => (row.date > latest ? row.date : latest), '');
  }, [filters.date, summaryRows]);

  /** The server's average and count for each meal service of that day. */
  const serviceRatings = useMemo(() => {
    const byMeal = new Map<string, SummaryRow>();
    for (const row of summaryRows) {
      if (row.date !== serviceDay) continue;
      byMeal.set(row.mealType, row);
    }
    return byMeal;
  }, [summaryRows, serviceDay]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MEALS_LIST_PREFIX }),
      queryClient.invalidateQueries({ queryKey: MEALS_COUNT_PREFIX }),
      queryClient.invalidateQueries({ queryKey: MEALS_SUMMARY_PREFIX }),
    ]);
  }, [queryClient]);

  /**
   * The rating of a meal service, as the server computed it.
   *
   * The average is the server's number: the rollup groups the ratings of a day
   * and a service and averages them (apps/api/src/routes/meals.ts:262-279).
   * Nothing on this page averages anything again.
   */
  const bandMetrics: PageBandMetric[] = MEAL_TYPES.filter(
    (mealType) => filters.mealType === '' || filters.mealType === mealType,
  ).map((mealType) => {
    const service = serviceRatings.get(mealType);
    const label = `${MEAL_LABELS[mealType] ?? mealType} · ${formatDay(serviceDay)}`;
    if (!service) {
      return {
        label,
        value: 'not rated',
        hint: 'the server reports no rating for this service',
        tone: 'default',
      };
    }
    return {
      label,
      value: `${service.avgRating.toFixed(2)} / 5`,
      hint: `${service.count} resident${service.count === 1 ? '' : 's'} rated it`,
      tone: service.avgRating >= 4 ? 'success' : service.avgRating >= 3 ? 'default' : 'danger',
    };
  });

  bandMetrics.push({
    label: 'Waiting to be read',
    value: counts['submitted'] === null ? '-' : String(counts['submitted']),
    hint: 'the office has not answered these yet',
    tone: 'warning',
  });

  /**
   * Answer a rating from where it stands.
   *
   * The server writes the new status, writes an update entry in the audit log
   * and pushes a meal_feedback message to the resident who left the rating
   * (apps/api/src/routes/meals.ts:481-494). The banner reports the status the
   * server committed, and the row below shows the server's own state.
   */
  const handleStatus = async (row: MealFeedbackRow, next: 'acknowledged' | 'actioned') => {
    setWritingId(row._id);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .put(`meals/${row._id}`, { json: { status: next } })
        .json<{ success: boolean; data: MealFeedbackRow }>();
      await refresh();
      const committed = res.data?.status ?? 'unknown';
      const day = row.date ?? 'the day of the rating';
      const message = residentMessage(row.mealType, day, next);
      setWriteResult(
        `The server wrote the status "${committed}" for ${residentName(row)}'s rating of the ${row.mealType} on ${day}. The resident reads a meal_feedback message in their portal when the status moves: "${message}" A push that fails is logged by the server and is not reported back here.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setWritingId(null);
    }
  };

  /**
   * The CSV export of the filtered set.
   *
   * The API clamps a page to 100 rows (apps/api/src/lib/routeUtils.ts:16), so
   * the export walks the pages of the filtered set instead of asking for one
   * big page that silently arrives truncated. The filters of the view travel
   * with it, and the operator is told how many ratings the server reported
   * and how many the file carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const exported: MealFeedbackRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(filterParams.toString());
        params.set('page', String(exportPage));
        params.set('limit', '100');
        const res = await api.get(`meals/feedback?${params.toString()}`).json<MealsListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        exported.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (exported.length === 0) {
        setWriteResult('Nothing to export: the server reports no rating for these filters.');
        return;
      }

      const headers = [
        'Resident',
        'Room',
        'Bed',
        'Meal',
        'Day of the meal',
        'Rating',
        'Status',
        'Categories',
        'Comment',
        'First recorded',
      ];
      const exportRows = exported.map((row) => [
        csvCell(row.tenant?.user?.name ?? ''),
        csvCell(row.tenant?.room?.roomNumber ?? ''),
        csvCell(row.tenant?.bedId ?? ''),
        csvCell(row.mealType),
        csvCell(row.date ?? ''),
        csvCell(row.rating),
        csvCell(row.status),
        csvCell((row.categories ?? []).join(', ')),
        csvCell(row.comment ?? ''),
        csvCell(row.createdAt ?? ''),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `meal-feedback-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        exported.length < reportedTotal
          ? `Export written with ${exported.length} of ${reportedTotal} ratings: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${exported.length} ratings the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Delete a rating.
   *
   * The server removes the record and writes a delete entry in the audit log
   * with the day, the meal and the rating. The resident's words are gone from
   * their portal and they are not told.
   */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`meals/${deleteTarget._id}`).json();
      const name = residentName(deleteTarget);
      setDeleteTarget(null);
      await refresh();
      setWriteResult(
        `The server deleted the rating of ${name}. The rating and the comment are gone from the resident's portal and they are not told. The server keeps a delete entry in the audit log with the day, the meal and the rating.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({
      status: null,
      mealType: null,
      rating: null,
      date: null,
      search: null,
      sort: null,
      order: null,
    });
    setPage(1);
  };

  const chips = [
    ...(filters.status
      ? [
          {
            key: 'status',
            label: 'Status',
            value: STATUS_TABS.find((tab) => tab.key === filters.status)?.label ?? filters.status,
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.mealType
      ? [
          {
            key: 'meal',
            label: 'Meal',
            value: MEAL_LABELS[filters.mealType] ?? filters.mealType,
            onRemove: () => {
              mealState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.rating
      ? [
          {
            key: 'rating',
            label: 'Rating',
            value: `${filters.rating} stars`,
            onRemove: () => {
              ratingState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.date
      ? [
          {
            key: 'date',
            label: 'Day',
            value: formatDay(filters.date),
            onRemove: () => {
              dateState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.search
      ? [
          {
            key: 'search',
            label: 'Resident',
            value: filters.search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
    ...(filters.sort !== 'createdAt' || filters.order !== 'desc'
      ? [
          {
            key: 'sort',
            label: 'Sorted by',
            value: `${SORT_LABELS[filters.sort] ?? filters.sort}, ${filters.order === 'asc' ? 'oldest first' : 'newest first'}`,
            onRemove: () => {
              sortState.reset();
              orderState.reset();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<MealFeedbackRow>[] = [
    {
      header: 'Resident',
      accessor: (row) => {
        const tenantId = row.tenant?._id;
        const name = residentName(row);
        return (
          <div>
            {tenantId ? (
              <Link
                href={`/tenants/${tenantId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-(--color-text-primary)">{name}</span>
            )}
            <div className="text-2xs text-(--color-text-muted)">
              {row.tenant?.room?.roomNumber ? `Room ${row.tenant.room.roomNumber}` : 'No room'}
              {row.tenant?.bedId ? ` · Bed ${row.tenant.bedId}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Meal',
      accessor: (row) => (
        <div>
          <span className="capitalize">{MEAL_LABELS[row.mealType] ?? row.mealType}</span>
          <div className="text-2xs text-(--color-text-muted)">
            {row.date ? formatDay(row.date) : formatStamp(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      header: 'Rating',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <StarRating value={row.rating} readonly size="sm" />
          <span className="font-display text-xs font-bold text-(--color-warning-500)">
            {row.rating}/5
          </span>
        </div>
      ),
    },
    {
      header: 'What they said',
      accessor: (row) => (
        <span className="block max-w-50 truncate text-xs text-(--color-text-muted)">
          {row.comment && row.comment.trim() !== '' ? row.comment : 'No comment'}
        </span>
      ),
    },
    {
      header: 'State',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={STATUS_LABELS[row.status] ?? row.status}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/meals/${row._id}`)}
          onEdit={() => router.push(`/meals/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
          extra={[
            ...(row.status === 'submitted'
              ? [
                  {
                    label: 'Acknowledge it',
                    icon: <MessageSquare className="h-3.5 w-3.5" />,
                    disabled: writingId === row._id,
                    onClick: () => void handleStatus(row, 'acknowledged'),
                  },
                ]
              : []),
            ...(row.status !== 'actioned'
              ? [
                  {
                    label: 'Mark it actioned',
                    icon: <Check className="h-3.5 w-3.5" />,
                    disabled: writingId === row._id,
                    onClick: () => void handleStatus(row, 'actioned'),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const filtersActive = Boolean(
    filters.status || filters.mealType || filters.rating || filters.date || filters.search,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meal feedback"
        description="What the residents said about the food, and what the office has done about it"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExportCsv()}
              disabled={exporting || rows.length === 0}
              loading={exporting}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => router.push('/meals/new')}>
              <Plus className="h-4 w-4" />
              Record a rating
            </Button>
          </div>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the ratings of the day in view (the server's own
          numbers) and the size of the triage queue, in one surface, so the
          first data row is reachable without scrolling past half a screen of
          chrome. */}
      <PageBand metrics={bandMetrics}>
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'submitted'
                ? 'warning'
                : tab.key === 'actioned'
                  ? 'success'
                  : tab.key === ''
                    ? 'brand'
                    : 'default',
          }))}
          active={filters.status}
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
              onChange={(e) => searchState.onChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <DatePicker
            aria-label="Filter by the day of the meal"
            placeholder="Any day..."
            value={filters.date}
            onChange={(val: string) => {
              dateState.setValue(val);
              setPage(1);
            }}
            className="w-48"
          />
          <Select
            aria-label="Filter by meal"
            size="compact"
            options={[
              { value: '', label: 'All meals' },
              { value: 'breakfast', label: 'Breakfast' },
              { value: 'lunch', label: 'Lunch' },
              { value: 'dinner', label: 'Dinner' },
            ]}
            value={filters.mealType}
            onChange={(e) => {
              mealState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
          <Select
            aria-label="Filter by rating"
            size="compact"
            options={[
              { value: '', label: 'Any rating' },
              { value: '1', label: '1 star' },
              { value: '2', label: '2 stars' },
              { value: '3', label: '3 stars' },
              { value: '4', label: '4 stars' },
              { value: '5', label: '5 stars' },
            ]}
            value={filters.rating}
            onChange={(e) => {
              ratingState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
          <Select
            aria-label="Sort the ledger"
            size="compact"
            options={[
              { value: 'createdAt', label: 'Sorted by: recorded first' },
              { value: 'date', label: 'Sorted by: day of the meal' },
              { value: 'rating', label: 'Sorted by: the rating' },
            ]}
            value={filters.sort}
            onChange={(e) => {
              sortState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-52"
          />
          <Select
            aria-label="The order of the ledger"
            size="compact"
            options={[
              { value: 'desc', label: 'Newest first' },
              { value: 'asc', label: 'Oldest first' },
            ]}
            value={filters.order}
            onChange={(e) => {
              orderState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-36"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(row: MealFeedbackRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/meals/${row._id}`)}
        pagination={{
          page,
          perPage,
          total,
          onPageChange: (p) => setPage(p),
          onPerPageChange: (pp) => {
            setPerPage(pp);
            setPage(1);
          },
        }}
        emptyState={
          // The empty state answers the question the operator asked. An empty
          // filter is not the same as an empty ledger.
          filtersActive ? (
            <EmptyState
              icon={<Utensils className="h-10 w-10" />}
              title="No rating in this view"
              description="The server reports no rating for the filters above. The filters live in the address bar, so this view is a link."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : (
            <EmptyState
              icon={<Utensils className="h-10 w-10" />}
              title="No meal feedback yet"
              description="Residents rate their meals in the portal and the rating lands here. The office can also record a rating on a resident's behalf: the server keeps one record per resident, day and meal."
              action={{ label: 'Record a rating', onClick: () => router.push('/meals/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={row.tenant?._id ? `/tenants/${row.tenant._id}` : `/meals/${row._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-(--color-brand-600) hover:underline"
              >
                {residentName(row)}
              </Link>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={STATUS_LABELS[row.status] ?? row.status}
                size="xs"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-(--color-text-muted)">
              <span className="capitalize">{MEAL_LABELS[row.mealType] ?? row.mealType}</span>
              <span>{formatDay(row.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={row.rating} readonly size="sm" />
              <span className="text-2xs text-(--color-text-muted)">{row.rating}/5</span>
            </div>
            {row.comment && row.comment.trim() !== '' && (
              <p className="text-2xs line-clamp-2 font-medium text-(--color-text-secondary)">
                {row.comment}
              </p>
            )}
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/meals/${row._id}`)}
                onEdit={() => router.push(`/meals/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
                extra={[
                  ...(row.status === 'submitted'
                    ? [
                        {
                          label: 'Acknowledge it',
                          icon: <MessageSquare className="h-3.5 w-3.5" />,
                          disabled: writingId === row._id,
                          onClick: () => void handleStatus(row, 'acknowledged'),
                        },
                      ]
                    : []),
                  ...(row.status !== 'actioned'
                    ? [
                        {
                          label: 'Mark it actioned',
                          icon: <Check className="h-3.5 w-3.5" />,
                          disabled: writingId === row._id,
                          onClick: () => void handleStatus(row, 'actioned'),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>
        )}
      />

      {/* What the columns, the filters and the numbers mean. A rating is read
          fast, and a number nobody can place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every rating in the band is the server&apos;s own average for that meal service of the day
          in view, with the number of residents who rated it. The day in view is the day filter, or
          the most recent day the server reports when the operator has not picked one. The server
          groups the ratings of a day and a service and averages them
          (apps/api/src/routes/meals.ts:262-279); this page never averages anything again. The
          counts behind the tabs and the number waiting to be read are the server&apos;s counts for
          the same filters the table shows, whatever their state.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Submitted</strong> means the office has
          not answered yet. <strong className="text-(--color-text-secondary)">Acknowledged</strong>{' '}
          means the office has read it and the resident was told it was read.{' '}
          <strong className="text-(--color-text-secondary)">Actioned</strong> means the kitchen did
          something about it and the resident was told that too. A rating the resident leaves again
          goes back to submitted and returns to the queue.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The search</strong> matches the name of
          the resident, not the comment and not the room. The filters and the sort live in the
          address bar, so a view of this ledger is a link that can be shared and cited.
        </p>
        <p>
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          The record carries the day of the meal and the day it was first written. It carries no
          stamp for the moment it was answered, so &quot;how long has this waited&quot; is not a
          number this page can show.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this rating"
        message={`The server removes the rating of ${deleteTarget ? residentName(deleteTarget) : 'this resident'} and writes a delete entry in the audit log with the day, the meal and the rating. The rating and the comment are gone from the resident's portal, and the resident is not told.`}
        confirmLabel="Delete the rating"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function MealsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <MealsContent />
    </Suspense>
  );
}
