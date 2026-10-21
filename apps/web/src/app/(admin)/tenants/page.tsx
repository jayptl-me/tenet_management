'use client';

import { useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Users, Download, Search, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryData, queryJson } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { useRouter } from 'next/navigation';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /tenants                     apps/api/src/routes/tenants.ts:391-483
//   GET /tenants/:id/dues            apps/api/src/routes/tenants.ts:1920-1929
//   GET /rooms (stats)               apps/api/src/routes/rooms.ts:214-335

interface TenantRow {
  _id: string;
  user?: { name: string; email: string; phone: string; _id: string };
  room?: {
    _id?: string;
    roomNumber: string;
    floor?: { label?: string; floorNumber?: number } | null;
  };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  isActive: boolean;
  moveInDate: string;
  moveOutDate?: string | null;
  documents?: {
    aadhaarUrl?: string;
    idUrl?: string;
    photoUrl?: string;
    isVerified?: boolean;
  };
}

/**
 * The dues summary of one resident, as the server computes it.
 *
 * The same shape the resident page reads under the same query key, so the two
 * screens share one cache entry instead of overwriting each other.
 */
interface TenantDues {
  totalDue?: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber?: string;
    month?: string;
    totalAmount?: number;
    paidAmount?: number;
    remaining?: number | null;
    status?: string;
    dueDate?: string | null;
  }>;
  electricityDues?: number;
  depositHeld?: number;
  pendingPayments?: number;
  checkedOut?: boolean;
}

interface TenantsListBody {
  success: boolean;
  data: TenantRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** The bed statistics the rooms route computes over the whole filtered set. */
interface RoomsStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
}

interface RoomsListBody {
  success: boolean;
  data: unknown[];
  meta: { total: number; stats?: RoomsStats };
}

/** One floor of the building, for the name of the floor filter. */
interface FloorRow {
  _id: string;
  label?: string;
  floorNumber?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function tenantRoomLabel(t: TenantRow): string {
  const room = t.room?.roomNumber ?? 'N/A';
  const floor = t.room?.floor?.label;
  return floor ? `${floor} - ${room}` : room;
}

/**
 * The KYC review state, read out of the document record the server holds.
 *
 * The tenant model has no status field: the review state is a flag on
 * documents (isVerified) plus the two uploaded files. A record with no file at
 * all is not "pending", it is "not started", and the office must be able to
 * tell the two apart.
 */
function kycState(t: TenantRow): {
  label: string;
  variant: 'success' | 'warning' | 'neutral';
  detail: string;
} {
  if (t.documents?.isVerified) {
    return {
      label: 'Verified',
      variant: 'success',
      detail: 'the office verified the identity documents',
    };
  }
  const hasId = Boolean(t.documents?.idUrl || t.documents?.aadhaarUrl);
  const hasPhoto = Boolean(t.documents?.photoUrl);
  if (hasId && hasPhoto) {
    return {
      label: 'Waiting',
      variant: 'warning',
      detail: 'both documents are uploaded and no admin has verified them',
    };
  }
  if (hasId || hasPhoto) {
    return {
      label: 'Incomplete',
      variant: 'warning',
      detail: hasId ? 'the photo is missing' : 'the identity document is missing',
    };
  }
  return { label: 'None', variant: 'neutral', detail: 'no document is uploaded' };
}

/**
 * The whole months a stay has run, counted from the move-in date the server
 * holds. The tenant record carries no lease end date, so this is the only
 * length of stay the server can answer.
 */
function monthsSince(date: string | undefined): number | null {
  if (!date) return null;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months > 0 ? months : 0;
}

/**
 * The dues cell of one resident.
 *
 * The numbers are the server's: GET /tenants/:id/dues. A balance the server
 * did not report is never read as zero, and a closed stay carries no open
 * invoices at all (the server skips the invoices of a checked-out resident).
 */
function DuesCell({
  row,
  dues,
  loading,
}: {
  row: TenantRow;
  dues: TenantDues | null;
  loading: boolean;
}) {
  if (!row.isActive) {
    return <span className="text-(--color-text-muted)">Stay closed</span>;
  }
  if (loading) {
    return <span className="text-(--color-text-muted)">reading</span>;
  }
  if (dues === null || typeof dues.totalDue !== 'number') {
    return <span className="text-(--color-text-muted)">Not reported</span>;
  }
  // The server counts an invoice with an unknown balance as open but cannot
  // add it up, so a total of zero with an unknown balance is not "nothing due".
  const unknownBalance = (dues.unpaidInvoices ?? []).some((invoice) => invoice.remaining == null);
  if (unknownBalance) {
    return <span className="text-(--color-warning-700)">Balance not reported</span>;
  }
  if (dues.totalDue > 0) {
    return (
      <span className="font-semibold text-(--color-danger-700) tabular-nums">
        {fmtMoney(dues.totalDue)}
      </span>
    );
  }
  return <span className="text-(--color-success-700)">Nothing due</span>;
}

// ── Filter vocabulary ──────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'true', label: 'In house' },
  { key: 'false', label: 'Checked out' },
];

/** The values the status filter may take in the address bar. */
const STATUS_FILTERS = STATUS_TABS.map((tab) => tab.key).filter((key) => key !== '');

/** The count keys the band reads, the empty key first (the whole set). */
const COUNT_KEYS = ['', ...STATUS_FILTERS] as const;

const TENANTS_LIST_KEY = ['tenants', 'list'] as const;
const TENANTS_COUNT_KEY = ['tenants', 'count'] as const;
const TENANTS_DUES_KEY = ['tenants', 'dues'] as const;
const ROOMS_STATS_KEY = ['tenants', 'beds'] as const;
const FLOORS_KEY = ['floors', 'list'] as const;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const EXPORT_PAGE_SIZE = 100;

/**
 * Stable empty fallback.
 *
 * `?? []` would allocate a fresh array on every render while the query is
 * pending, and the memo that reads the active rows would then recompute on
 * every render.
 */
const EMPTY_TENANTS: TenantRow[] = [];

export default function TenantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <TenantsContent />
    </Suspense>
  );
}

function TenantsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a triage link that names a resident,
  // a floor or a status lands on the rows it names, and the view can be
  // shared, bookmarked and cited.
  const searchState = useUrlSearch('search');
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  // The status filter answers to both names: `status` is what the control
  // writes, `isActive` is what the list API calls it.
  const isActiveState = useUrlState<string>('isActive', {
    defaultValue: '',
    allowed: STATUS_FILTERS,
  });
  const floorState = useUrlState<string>('floorId', { defaultValue: '' });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const statusFilter = statusState.value || isActiveState.value;
  const floorFilter = floorState.value;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * The query parameters of the filtered set.
   *
   * Every read of the roster sends the same set: the table, the counts behind
   * the status tabs and the CSV export. A number that answers a different
   * question than the rows would be a number the operator cannot trust.
   *
   * The status is NOT part of this set: the status tabs need the counts of
   * the set WITHOUT the status filter, because a tab count is the number of
   * rows that tab would show.
   */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (floorFilter) params.set('floorId', floorFilter);
    return params;
  }, [search, floorFilter]);

  const listParams = new URLSearchParams(filterParams.toString());
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));
  if (statusFilter) listParams.set('isActive', statusFilter);

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<TenantsListBody>(
    [...TENANTS_LIST_KEY, page, perPage, search, statusFilter, floorFilter],
    `tenants?${listParams.toString()}`,
  );

  const tenants = listBody?.data ?? EMPTY_TENANTS;
  const total = listBody?.meta.total ?? 0;

  /**
   * The counts behind the status tabs.
   *
   * They are read from the server for the SAME filtered set the table shows,
   * so a tab count is exactly the number of rows the operator gets after
   * clicking it.
   */
  const countQueries = useQueries({
    queries: COUNT_KEYS.map((key): UseQueryOptions<TenantsListBody, Error> => {
      const params = new URLSearchParams(filterParams.toString());
      params.set('page', '1');
      params.set('limit', '1');
      if (key) params.set('isActive', key);
      return {
        queryKey: [...TENANTS_COUNT_KEY, search, floorFilter, key],
        queryFn: () => queryJson<TenantsListBody>(`tenants?${params.toString()}`),
        staleTime: 15_000,
      };
    }),
  });

  const counts: Record<string, number | null> = {};
  COUNT_KEYS.forEach((key, index) => {
    counts[key] = countQueries[index]?.data?.meta.total ?? null;
  });

  /**
   * The beds of the floors in view.
   *
   * The rooms route computes the statistics over the WHOLE filtered set of
   * rooms, not over the page, so this is the number of beds the floor in view
   * lets and the number that carry a resident. The filter is the active rooms
   * of that floor, because that is the set the resident list itself walks
   * (apps/api/src/routes/tenants.ts:408-415). The search and the status
   * filter do not narrow it: a bed is a bed whatever the resident filter says.
   */
  const { data: roomsBody } = useApiBodyQuery<RoomsListBody>(
    [...ROOMS_STATS_KEY, floorFilter],
    `rooms?limit=1&isActive=true${floorFilter ? `&floorId=${floorFilter}` : ''}`,
  );
  const bedStats = roomsBody?.meta.stats ?? null;

  /**
   * The name of the floor in view, so the filter chip names a place and not an
   * id. The server holds the label.
   */
  const { data: floors } = useApiQuery<FloorRow[]>(FLOORS_KEY, 'floors', {
    staleTime: 300_000,
  });
  const floorLabel =
    floors?.find((floor) => floor._id === floorFilter)?.label ??
    (floorFilter ? `Floor ${floorFilter.slice(-6)}` : '');
  /**
   * The dues of every resident in view.
   *
   * The server owns the money: GET /tenants/:id/dues is the same summary the
   * resident reads on their phone and the same summary the checkout guard
   * uses. A checked-out resident carries no open invoices, so no request is
   * made for a closed stay.
   */
  const activeRows = useMemo(() => tenants.filter((row) => row.isActive), [tenants]);

  const duesQueries = useQueries({
    queries: activeRows.map((row): UseQueryOptions<TenantDues, Error> => ({
      // The same key and the same shape the resident page uses, so the two
      // screens share one cache entry instead of overwriting each other.
      queryKey: [...TENANTS_DUES_KEY, row._id],
      queryFn: () => queryData<TenantDues>(`tenants/${row._id}/dues`),
      staleTime: 30_000,
    })),
  });

  const duesStateById = new Map<string, { dues: TenantDues | null; loading: boolean }>();
  activeRows.forEach((row, index) => {
    const query = duesQueries[index];
    duesStateById.set(row._id, {
      dues: query?.data ?? null,
      loading: query?.isPending ?? false,
    });
  });

  /**
   * The residents in view who owe money.
   *
   * The count is over the residents of THIS PAGE, because the server reports
   * the dues of one resident at a time. The band says so, and the count is
   * never presented as the number for the whole set.
   */
  const owingCount = activeRows.filter((row) => {
    const dues = duesStateById.get(row._id)?.dues;
    if (!dues || typeof dues.totalDue !== 'number') return false;
    if (dues.totalDue > 0) return true;
    return (dues.unpaidInvoices ?? []).some((invoice) => invoice.remaining == null);
  }).length;

  const kycWaitingCount = activeRows.filter(
    (row) => !row.documents?.isVerified && (row.documents?.idUrl || row.documents?.photoUrl),
  ).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`tenants/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: TENANTS_LIST_KEY });
      setWriteResult('Deletion saved. The server no longer lists this resident.');
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
   * truncated. The filters and the search of the view travel with it, and the
   * operator is told how many rows the server reported and how many the file
   * carries.
   */
  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const rows: TenantRow[] = [];
      let reportedTotal = 0;
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams(filterParams.toString());
        if (statusFilter) params.set('isActive', statusFilter);
        params.set('page', String(exportPage));
        params.set('limit', String(EXPORT_PAGE_SIZE));
        const res = await api.get(`tenants?${params.toString()}`).json<TenantsListBody>();
        const pageRows = res.data ?? [];
        reportedTotal = res.meta?.total ?? reportedTotal;
        rows.push(...pageRows);
        const totalPages = res.meta?.totalPages ?? 1;
        if (exportPage >= totalPages || pageRows.length === 0) break;
        exportPage += 1;
      }

      if (rows.length === 0) {
        setWriteResult('Nothing to export: the server reports no resident for these filters.');
        return;
      }

      const headers = [
        'Name',
        'Email',
        'Phone',
        'Room',
        'Bed',
        'Monthly Rent',
        'Deposit Paid',
        'Stay Since',
        'Stay Ended',
        'Status',
        'KYC',
      ];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const exportRows = rows.map((t) => [
        escapeCsv(t.user?.name ?? '—'),
        escapeCsv(t.user?.email ?? '—'),
        escapeCsv(t.user?.phone ?? '—'),
        escapeCsv(t.room?.roomNumber ?? '—'),
        escapeCsv(t.bedId ?? '—'),
        escapeCsv(t.monthlyRent),
        escapeCsv(t.depositPaid),
        escapeCsv(t.moveInDate ? formatDate(t.moveInDate) : '—'),
        escapeCsv(t.moveOutDate ? formatDate(t.moveOutDate) : '—'),
        escapeCsv(t.isActive ? 'In house' : 'Checked out'),
        escapeCsv(kycState(t).label),
      ]);
      const csvContent = [headers.join(','), ...exportRows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `tenants-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWriteResult(
        rows.length < reportedTotal
          ? `Export written with ${rows.length} of ${reportedTotal} residents: the export stops at the last page the server returns, so the file is short of the whole set.`
          : `Export written with all ${rows.length} residents the server reports for these filters. The file carries no balance column: the server reports the dues of one resident at a time, and that number stays on the screen.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ status: null, isActive: null, floorId: null, search: null });
    setPage(1);
  };

  const chips = [
    ...(statusFilter
      ? [
          {
            key: 'status',
            label: 'Status',
            value: statusFilter === 'true' ? 'In house' : 'Checked out',
            onRemove: () => {
              writeUrl({ status: null, isActive: null });
              setPage(1);
            },
          },
        ]
      : []),
    ...(floorFilter
      ? [
          {
            key: 'floor',
            label: 'Floor',
            value: floorLabel,
            onRemove: () => {
              floorState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(search
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

  const columns: DataTableColumn<TenantRow>[] = [
    {
      header: 'Resident',
      accessor: (row) => (
        <div>
          <Link
            href={`/tenants/${row._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.user?.name ?? 'N/A'}
          </Link>
          <div className="text-xs text-(--color-text-muted)">
            <span>{row.user?.email ?? 'No email'}</span>
            <span className="block">{row.user?.phone ?? 'No phone'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Room and bed',
      accessor: (row) => {
        const roomId = row.room?._id ?? '';
        const label = `${tenantRoomLabel(row)} · Bed ${row.bedId}`;
        if (!roomId) {
          return <span className="text-(--color-text-muted)">{label}</span>;
        }
        return (
          <Link
            href={`/rooms/${roomId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-(--color-brand-600) hover:underline"
          >
            {label}
          </Link>
        );
      },
    },
    {
      header: 'Stay',
      accessor: (row) => {
        const months = monthsSince(row.moveInDate);
        if (!row.isActive) {
          return (
            <div className="text-xs">
              <span className="block font-semibold text-(--color-text-primary)">
                Ended {formatDate(row.moveOutDate)}
              </span>
              <span className="text-(--color-text-muted)">
                moved in {formatDate(row.moveInDate)}
              </span>
            </div>
          );
        }
        return (
          <div className="text-xs">
            <span className="block font-semibold text-(--color-text-primary)">
              Since {formatDate(row.moveInDate)}
            </span>
            <span className="text-(--color-text-muted)">
              {months === null ? 'length unknown' : `${months} month(s) in the stay`}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Identity (KYC)',
      accessor: (row) => {
        const kyc = kycState(row);
        return (
          <div>
            <StatusBadge variant={kyc.variant} label={kyc.label} />
            <span className="text-2xs block text-(--color-text-muted)">{kyc.detail}</span>
          </div>
        );
      },
    },
    {
      header: 'Owes now',
      accessor: (row) => {
        const state = duesStateById.get(row._id);
        return <DuesCell row={row} dues={state?.dues ?? null} loading={state?.loading ?? false} />;
      },
    },
    {
      header: 'Rent and deposit',
      accessor: (row) => (
        <div className="text-xs">
          <span className="block font-semibold text-(--color-text-primary) tabular-nums">
            {fmtMoney(row.monthlyRent)}/mo
          </span>
          <span className="text-(--color-text-muted)">
            deposit {fmtMoney(row.depositPaid)} held
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'checked_out')}
          label={row.isActive ? 'In house' : 'Checked out'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/tenants/${row._id}`)}
          onEdit={() => router.push(`/tenants/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tenants"
        description="The residents in house, their identity state and what they owe"
        action={
          <Button onClick={() => router.push('/tenants/new')}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
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
            label: 'Residents in view',
            value: String(total),
            hint: 'matching the filters',
            tone: 'brand',
          },
          {
            label: 'Beds occupied',
            value: bedStats ? `${bedStats.occupiedBeds} / ${bedStats.totalBeds}` : '-',
            hint: bedStats ? 'of the floor in view' : 'not reported',
            tone: bedStats && bedStats.vacantBeds === 0 ? 'warning' : 'success',
          },
          {
            label: 'Free beds',
            value: bedStats ? String(bedStats.vacantBeds) : '-',
            hint: bedStats ? 'a bed with no resident' : 'not reported',
            tone: 'default',
          },
          {
            label: 'Owing money',
            value: String(owingCount),
            hint: 'on this page',
            tone: owingCount > 0 ? 'danger' : 'success',
          },
        ]}
      >
        {/* Status tab strip. The counts are the rows the tab would show. */}
        <StatusTabs
          tabs={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: counts[tab.key] ?? null,
            tone: tab.key === 'true' ? 'success' : tab.key === 'false' ? 'default' : 'brand',
          }))}
          active={statusFilter}
          onChange={(key) => {
            // One write: the canonical name is set and the alias is taken out,
            // so the address bar carries one status and not two.
            writeUrl({ status: key || null, isActive: null });
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search by name..."
              aria-label="Search by resident name"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <ResourceSelect
            endpoint="floors"
            value={floorFilter}
            onChange={(val) => {
              floorState.setValue(val);
              setPage(1);
            }}
            placeholder="All Floors"
            valueKey="_id"
            labelKey={(item) => {
              const f = item as unknown as { label: string; floorNumber?: number };
              return f.label ?? `Floor ${f.floorNumber ?? ''}`;
            }}
            dataPath="data"
            className="w-52"
          />
          <Button
            variant="outline"
            onClick={() => void handleExportCsv()}
            disabled={exporting || tenants.length === 0}
            loading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      <DataTable
        columns={columns}
        data={tenants}
        keyExtractor={(row: TenantRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/tenants/${row._id}`)}
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
          // filter is not the same as an empty roster.
          statusFilter || floorFilter || search ? (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No resident in this view"
              description="The server reports no resident for the filters above."
              action={{
                label: 'Clear the filters',
                onClick: clearAllFilters,
              }}
            />
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No residents yet"
              description="Check the first resident in: the server creates the portal login and takes the bed."
              action={{ label: 'Add Tenant', onClick: () => router.push('/tenants/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/tenants/${row._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-(--color-brand-600) hover:underline"
              >
                {row.user?.name ?? 'N/A'}
              </Link>
              <StatusBadge
                variant={statusToVariant(row.isActive ? 'active' : 'checked_out')}
                label={row.isActive ? 'In house' : 'Checked out'}
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-(--color-text-muted)">
              <span>
                Room {row.room?.roomNumber ?? '—'} · Bed {row.bedId}
              </span>
              <span>{fmtMoney(row.monthlyRent)}/mo</span>
              <span>
                <DuesCell
                  row={row}
                  dues={duesStateById.get(row._id)?.dues ?? null}
                  loading={duesStateById.get(row._id)?.loading ?? false}
                />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant={kycState(row).variant} label={kycState(row).label} />
              <span className="text-2xs text-(--color-text-muted)">
                {row.isActive
                  ? `since ${formatDate(row.moveInDate)}`
                  : `ended ${formatDate(row.moveOutDate)}`}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/tenants/${row._id}`)}
                onEdit={() => router.push(`/tenants/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />

      {/* What the columns mean. A roster is read fast, and a number nobody can
          place is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          The search matches the resident name only, not the room, the phone or the email.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Identity (KYC)</strong> is read from the
          document record the server holds. {kycWaitingCount} resident(s) on this page have their
          documents waiting for a verdict: the server cannot filter the roster by it, so the column
          is the queue.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Owes now</strong> is the server&apos;s
          dues summary for that resident (GET /tenants/:id/dues), the same one the resident reads on
          their phone. A closed stay carries no open invoices, and a balance the server did not
          report is never read as zero.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Stay</strong> is counted from the
          move-in date the server holds. The resident record carries no lease end date, so a stay
          that is about to end cannot be shown here.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Rent and deposit</strong> are the
          amounts the server holds for the resident. The deposit is what the office recorded as
          taken, not a payment, and the rent is what the next invoice is raised from.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Tenant Permanently"
        message={
          deleteTarget?.user?.name
            ? `Permanently delete "${deleteTarget.user.name}" and ALL associated records: payments, invoices, complaints, visitors, guardians (including their portal logins), laundry slots, meal feedback, attendance, and leaves. Their bed is freed and their login is disabled. This cannot be undone - prefer Check Out for normal move-outs.`
            : 'Permanently delete this tenant and ALL associated records (payments, invoices, complaints, visitors, guardians, attendance, leaves)? Their bed is freed and their login is disabled. This cannot be undone.'
        }
        confirmLabel="Delete Permanently"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
