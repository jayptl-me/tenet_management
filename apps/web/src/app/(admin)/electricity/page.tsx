'use client';

import { useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Info, Plus, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryData, queryJson } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { TableActions } from '@/components/ui/TableActions';
import { clsx } from 'clsx';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /electricity      apps/api/src/routes/electricity.ts:149-177
//   GET /electricity/:id  apps/api/src/routes/electricity.ts:384-488

interface RoomEntry {
  roomId?:
    | string
    | {
        _id?: string;
        roomNumber?: string;
        sharingType?: number;
        floorId?: { label?: string; floorNumber?: number } | null;
      };
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
  /** The server's sum of the room amounts (computedRoomTotal). */
  computedRoomTotal?: number;
  /** The server's difference between the utility total and the room sum. */
  variance?: number;
  varianceReason?: string;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  createdAt: string;
}

/** One invoice the bill produced, with the share the server wrote on it. */
interface LinkedInvoice {
  _id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  /** The share the server put on the invoice. */
  electricityAmount: number;
  totalAmount: number;
  status: string;
  dueDate?: string;
}

/** The bill with the invoices it produced (GET /electricity/:id). */
interface BillWithShares {
  _id: string;
  linkedInvoices?: LinkedInvoice[];
}

interface ElectricityListBody {
  success: boolean;
  data: ElectricityBillRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Vocabulary ─────────────────────────────────────────────────────────

/**
 * The three states the model allows, in the order the routes move them in.
 *
 * apps/api/src/models/electricityBill.ts:110-114 holds the enum,
 * POST /electricity/:id/finalize moves draft to finalized and
 * POST /electricity/:id/distribute moves finalized to distributed
 * (apps/api/src/routes/electricity.ts:644-937).
 */
const BILL_STATES = [
  { key: 'draft', label: 'Draft' },
  { key: 'finalized', label: 'Finalized' },
  { key: 'distributed', label: 'Distributed' },
] as const;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'finalized', label: 'Finalized' },
  { key: 'distributed', label: 'Distributed' },
];

/** The values the status filter may take in the address bar. */
const STATUS_FILTERS = STATUS_TABS.map((tab) => tab.key).filter((key) => key !== '');

/** The count keys the band reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

/** A billing month is YYYY-MM. Anything else is not a month and is not sent. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const ELECTRICITY_PREFIX = ['electricity'] as const;

/** The API clamps a page to 100 rows (apps/api/src/lib/routeUtils.ts:16). */
const EXPORT_PAGE_SIZE = 100;

/** Stable empty fallback: `?? []` would allocate on every render. */
const EMPTY_BILLS: ElectricityBillRow[] = [];

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * The state of a bill, drawn as the progression it is.
 *
 * A badge cannot say that a bill is one step away from being charged. The
 * three states and their order come from the model and the two routes, so the
 * row cannot drift from what the server can do.
 */
function BillStateTrack({ status }: { status: string }) {
  const current = BILL_STATES.findIndex((state) => state.key === status);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Bill state">
      {BILL_STATES.map((state, index) => {
        const reached = current >= 0 && index <= current;
        const isCurrent = index === current;
        return (
          <li key={state.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={clsx(
                'h-2 w-2 shrink-0 rounded-full',
                isCurrent
                  ? 'bg-(--color-brand-500)'
                  : reached
                    ? 'bg-(--color-success-500)'
                    : 'bg-(--border-color)',
              )}
            />
            <span
              className={clsx(
                'text-2xs font-semibold whitespace-nowrap',
                isCurrent ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)',
              )}
            >
              {state.label}
            </span>
            {index < BILL_STATES.length - 1 && (
              <span aria-hidden className="h-px w-3 bg-(--border-color)" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Does the bill add up?
 *
 * The numbers are the server's: the sum of the room amounts and the
 * difference from the utility total are computed by the model when the bill is
 * saved (apps/api/src/models/electricityBill.ts:138-148). The page reads the
 * difference the server wrote and says so; it never adds the column up itself.
 */
function ReconcilesCell({ bill }: { bill: ElectricityBillRow }) {
  const variance = typeof bill.variance === 'number' ? bill.variance : null;
  if (variance === null) {
    return <span className="text-(--color-text-muted)">Not reported</span>;
  }
  if (Math.abs(variance) <= 0.5) {
    return (
      <span className="text-(--color-success-700)">
        <span className="font-semibold">Yes</span>
        <span className="text-2xs block text-(--color-text-muted)">
          the readings match the bill
        </span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-semibold text-(--color-warning-700)">
        No: {fmtMoney(variance)} apart
      </span>
      {bill.varianceReason ? (
        <span className="text-2xs block max-w-[200px] truncate text-(--color-text-muted)">
          {bill.varianceReason}
        </span>
      ) : (
        <span className="text-2xs block text-(--color-warning-700)">no reason written down</span>
      )}
    </span>
  );
}

/**
 * The shares this bill produced.
 *
 * The numbers are the server's: GET /electricity/:id returns the invoices of
 * the residents of the rooms in this bill for this month, and the electricity
 * amount on each of them is the share the server wrote. The cell never divides
 * a room amount by a head count, and a share that is not on an invoice is
 * never shown as one.
 */
function ShareCell({
  bill,
  invoices,
  loading,
}: {
  bill: ElectricityBillRow;
  invoices: LinkedInvoice[] | undefined;
  loading: boolean;
}) {
  if (bill.status !== 'distributed') {
    return (
      <span className="text-(--color-text-muted)">
        Not distributed
        <span className="text-2xs block">nobody is charged yet</span>
      </span>
    );
  }
  if (loading) {
    return <span className="text-(--color-text-muted)">reading</span>;
  }
  const list = invoices ?? [];
  if (list.length === 0) {
    return (
      <span className="text-(--color-warning-700)">
        No invoice of these residents
        <span className="text-2xs block">the server found none for the month</span>
      </span>
    );
  }
  const charged = list.filter((invoice) => invoice.electricityAmount > 0);
  const without = list.length - charged.length;
  return (
    <span className="block text-xs">
      <span className="block font-semibold text-(--color-text-primary)">
        {charged.length} resident(s) charged
      </span>
      {charged.slice(0, 2).map((invoice) => (
        <Link
          key={invoice._id}
          href={`/invoices/${invoice._id}`}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-(--color-brand-600) hover:underline"
        >
          {invoice.tenantName}: {fmtMoney(invoice.electricityAmount)}
        </Link>
      ))}
      {charged.length > 2 && (
        <Link
          href={`/electricity/${bill._id}`}
          onClick={(event) => event.stopPropagation()}
          className="text-2xs block text-(--color-brand-600) hover:underline"
        >
          +{charged.length - 2} more on the bill
        </Link>
      )}
      {without > 0 && (
        <span className="text-2xs block text-(--color-warning-700)">
          {without} invoice(s) carry no share
        </span>
      )}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

function ElectricityContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a link that names a status and a
  // month lands on the bills it names, and the view can be shared, cited and
  // reviewed. A parameter that is not a value the API accepts reads as no
  // filter, so a broken link never empties the ledger.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const monthState = useUrlState<string>('month', { defaultValue: '' });
  const { write: writeUrl } = useUrlStateWriter();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Mutation (delete, export) failures; list failures come from the query.
  const [error, setError] = useState('');
  // Outcome of the last write, as the server reported it.
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ElectricityBillRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const statusFilter = statusState.value;
  // A month that is not YYYY-MM is not sent to the server.
  const monthFilter = MONTH_PATTERN.test(monthState.value) ? monthState.value : '';

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (monthFilter) params.set('month', monthFilter);
    params.set('page', String(page));
    params.set('limit', String(perPage));
    return params;
  }, [statusFilter, monthFilter, page, perPage]);

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<ElectricityListBody>(
    [...ELECTRICITY_PREFIX, 'list', page, perPage, statusFilter, monthFilter],
    `electricity?${listParams.toString()}`,
  );

  const bills = listBody?.data ?? EMPTY_BILLS;
  const total = listBody?.meta.total ?? 0;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it. A count that answers a different question than the rows is a
   * count nobody trusts.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<ElectricityListBody, Error> => {
      const params = new URLSearchParams();
      if (key) params.set('status', key);
      if (monthFilter) params.set('month', monthFilter);
      params.set('page', '1');
      params.set('limit', '1');
      return {
        queryKey: [...ELECTRICITY_PREFIX, 'count', statusFilter, monthFilter, key],
        queryFn: () => queryJson<ElectricityListBody>(`electricity?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta.total ?? null;
  });

  /**
   * The shares each distributed bill produced.
   *
   * The link between a bill and the invoices it produced is the server's:
   * GET /electricity/:id returns the invoices of the residents of the rooms in
   * the bill for that month. Only the bills that were distributed are read,
   * because only they can carry a share.
   */
  const distributedBills = useMemo(
    () => bills.filter((bill) => bill.status === 'distributed'),
    [bills],
  );

  const shareQueries = useQueries({
    queries: distributedBills.map((bill): UseQueryOptions<BillWithShares, Error> => ({
      queryKey: [...ELECTRICITY_PREFIX, bill._id, 'shares'],
      queryFn: () => queryData<BillWithShares>(`electricity/${bill._id}`),
      staleTime: 30_000,
    })),
  });

  const sharesByBill = new Map<
    string,
    { invoices: LinkedInvoice[] | undefined; loading: boolean }
  >();
  distributedBills.forEach((bill, index) => {
    const query = shareQueries[index];
    sharesByBill.set(bill._id, {
      invoices: query?.data?.linkedInvoices,
      loading: query?.isPending ?? false,
    });
  });

  /**
   * The bills in view whose readings do not add up to the utility total.
   *
   * The difference is the server's own (the variance the model writes when it
   * saves the bill). The count is over the bills of THIS PAGE, because the
   * server reports the variance one bill at a time, so the band says so.
   */
  const unreconciled = bills.filter(
    (bill) => typeof bill.variance === 'number' && Math.abs(bill.variance) > 0.5,
  ).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`electricity/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ELECTRICITY_PREFIX });
      setWriteResult('Deletion saved. The server no longer lists this bill.');
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
   * filtered set instead of asking for one big page that silently arrives
   * truncated. The filters of the view travel with it, and the operator is
   * told how many bills the server reports against the rows the file carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const rows: ElectricityBillRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (monthFilter) params.set('month', monthFilter);
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`electricity?${params.toString()}`).json<ElectricityListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no bill for these filters.');
        return;
      }

      const headers = [
        'Month',
        'Bill Total',
        'Readings Total',
        'Difference',
        'Rooms',
        'Units',
        'Status',
        'Variance Reason',
        'Notes',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((row) => [
        escapeCsv(row.month),
        escapeCsv(row.totalBillAmount),
        escapeCsv(row.computedRoomTotal ?? 'Not reported'),
        escapeCsv(row.variance ?? 'Not reported'),
        escapeCsv(row.roomEntries?.length ?? 0),
        escapeCsv((row.roomEntries ?? []).reduce((sum, e) => sum + (e.unitsConsumed ?? 0), 0)),
        escapeCsv(row.status),
        escapeCsv(row.varianceReason ?? ''),
        escapeCsv(row.notes ?? ''),
      ]);
      const csvContent = [
        headers.map(escapeCsv).join(','),
        ...exportRows.map((r) => r.join(',')),
      ].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `electricity-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} bills: the file is short of the whole set.`
          : `Export written with all ${rows.length} bills the server reports for these filters.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ status: null, month: null });
    setPage(1);
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'Status',
            value: STATUS_TABS.find((tab) => tab.key === statusFilter)?.label ?? statusFilter,
            onRemove: () => {
              statusState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(monthFilter
      ? [
          {
            key: 'month',
            label: 'Month',
            value: monthFilter,
            onRemove: () => {
              monthState.reset();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<ElectricityBillRow>[] = [
    {
      header: 'Month',
      accessor: (row) => (
        <div>
          <Link
            href={`/electricity/${row._id}`}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.month}
          </Link>
          <span className="text-2xs block text-(--color-text-muted)">
            {row.roomEntries?.length ?? 0} room(s) on the bill
          </span>
        </div>
      ),
    },
    {
      header: 'Bill total',
      accessor: (row) => (
        <span className="font-semibold text-(--color-text-primary) tabular-nums">
          {fmtMoney(row.totalBillAmount)}
        </span>
      ),
    },
    {
      header: 'Readings at the tariff',
      accessor: (row) =>
        typeof row.computedRoomTotal === 'number' ? (
          <span className="font-semibold text-(--color-text-primary) tabular-nums">
            {fmtMoney(row.computedRoomTotal)}
          </span>
        ) : (
          <span className="text-(--color-text-muted)">Not reported</span>
        ),
    },
    {
      header: 'Does it add up',
      accessor: (row) => <ReconcilesCell bill={row} />,
    },
    {
      header: 'Units',
      accessor: (row) =>
        `${(row.roomEntries ?? []).reduce((sum, e) => sum + (e.unitsConsumed ?? 0), 0).toLocaleString('en-IN')}`,
    },
    {
      header: 'State',
      accessor: (row) => <BillStateTrack status={row.status} />,
      className: 'w-[180px]',
    },
    {
      header: 'Residents charged',
      accessor: (row) => {
        const state = sharesByBill.get(row._id);
        return (
          <ShareCell bill={row} invoices={state?.invoices} loading={state?.loading ?? false} />
        );
      },
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
    <div className="space-y-4">
      <PageHeader
        title="Electricity"
        description="The month bills, the readings they were computed from and the share each resident carries"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExportCsv()}
              disabled={exporting || bills.length === 0}
              loading={exporting}
            >
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

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers, the status tabs and the filters in one
          surface, so the first data row is reachable without scrolling past
          half a screen of chrome. Every number names the scope it covers. */}
      <PageBand
        metrics={[
          {
            label: 'Bills in view',
            value: String(total),
            hint: 'matching the filters',
            tone: 'brand',
          },
          {
            label: 'Do not add up',
            value: String(unreconciled),
            hint: 'on this page',
            tone: unreconciled > 0 ? 'danger' : 'success',
          },
          {
            label: 'Draft',
            value: counts['draft'] == null ? '-' : String(counts['draft']),
            hint: 'not charged to residents yet',
            tone: 'default',
          },
          {
            label: 'Distributed',
            value: counts['distributed'] == null ? '-' : String(counts['distributed']),
            hint: 'the shares are on the resident invoices',
            tone: 'success',
          },
        ]}
      >
        {/* Status tab strip. The counts are the rows the tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone:
              tab.key === 'distributed'
                ? 'success'
                : tab.key === 'finalized'
                  ? 'warning'
                  : tab.key === 'draft'
                    ? 'default'
                    : 'brand',
          }))}
          active={statusFilter}
          onChange={(key) => {
            statusState.setValue(key);
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <DatePicker
            type="month"
            aria-label="Filter by month"
            value={monthFilter}
            onChange={(value: string) => {
              monthState.setValue(value);
              setPage(1);
            }}
            className="w-full sm:w-[180px]"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

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
          onPageChange: (p) => setPage(p),
          onPerPageChange: (pp) => {
            setPerPage(pp);
            setPage(1);
          },
        }}
        emptyState={
          // The empty state answers the question the operator asked. An empty
          // filter is not the same as an empty ledger.
          statusFilter || monthFilter ? (
            <EmptyState
              icon={<Zap className="h-10 w-10" />}
              title="No bill in this view"
              description="The server reports no electricity bill for the filters above."
              action={{
                label: 'Clear the filters',
                onClick: clearAllFilters,
              }}
            />
          ) : (
            <EmptyState
              icon={<Zap className="h-10 w-10" />}
              title="No electricity bill yet"
              description="Record the month bill from the utility invoice: the readings go in per room."
              action={{ label: 'Record Bill', onClick: () => router.push('/electricity/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/electricity/${row._id}`}
                onClick={(event) => event.stopPropagation()}
                className="text-sm font-semibold text-(--color-brand-600) hover:underline"
              >
                {row.month}
              </Link>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--color-text-muted)">
              <span className="font-semibold text-(--color-text-primary)">
                {fmtMoney(row.totalBillAmount)}
              </span>
              <span>{row.roomEntries?.length ?? 0} room(s)</span>
              <span>
                {typeof row.variance === 'number' && Math.abs(row.variance) > 0.5
                  ? `does not add up: ${fmtMoney(row.variance)} apart`
                  : 'the readings add up'}
              </span>
            </div>
            <BillStateTrack status={row.status} />
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

      {/* What the columns mean. A ledger is read fast, and a number nobody can
          place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          <strong className="text-(--color-text-secondary)">Bill total</strong> is the utility
          invoice. <strong className="text-(--color-text-secondary)">Readings at the tariff</strong>{' '}
          is the sum of what the meters read at the rate the office entered. Both are the server's
          numbers, and the difference between them is the variance the model writes when it saves
          the bill.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Residents charged</strong> is what the
          bill produced: the invoices of the residents of its rooms for that month, with the share
          the server wrote on each one. The office distributed the bill to the residents who were in
          the room during the billing month, so an invoice of somebody else carries no share.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">State</strong> is where the bill stands:
          the readings can still be edited, the readings are locked, or the shares are on the
          resident invoices. The server refuses to edit a bill after it is finalized, and it refuses
          to delete one after it is distributed.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this electricity bill?"
        message="The bill and its readings are removed. The server refuses to delete a distributed bill, because the shares are already on the resident invoices. The resident is not notified."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function ElectricityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <ElectricityContent />
    </Suspense>
  );
}
