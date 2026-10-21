'use client';

import { useMemo, useState, Suspense } from 'react';
import { useQueries, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ShieldCheck, Search, Info, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage, queryData } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand } from '@/components/ui/PageBand';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { tenantLabel } from '@/lib/resource-select-presets';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /guardians            apps/api/src/routes/guardians.ts:241-286
//   GET /tenants/:id/dues     apps/api/src/routes/tenants.ts:1919-1929

/** The resident a guardian pays for, as the guardians mapper returns it. */
interface GuardianWard {
  _id: string;
  bedId?: string | null;
  isActive?: boolean | null;
  user?: { _id?: string; name?: string; email?: string; phone?: string } | null;
  room?: {
    _id?: string;
    roomNumber?: string;
    floor?: { label?: string; floorNumber?: number } | null;
  } | null;
}

interface GuardianRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenantId: string;
  tenant?: GuardianWard | null;
  isEmergencyContact: boolean;
  isActive: boolean;
  createdAt: string;
}

interface GuardiansListBody {
  success: boolean;
  data: GuardianRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * The dues of one ward, as the server computes them.
 *
 * The office reads the ward's summary (GET /tenants/:id/dues): the same money helper the
 * guardian reads on their phone, so the two sides cannot be shown different amounts.
 */
interface WardDues {
  totalDue?: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber?: string;
    month?: string;
    totalAmount?: number;
    remaining?: number | null;
    status?: string;
    dueDate?: string | null;
  }>;
  pendingPayments?: number;
  depositHeld?: number;
  electricityDues?: number;
  checkedOut?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * The oldest cycle the ward still owes.
 *
 * The month is a label, not an amount: the server reports the month of every open invoice and
 * the oldest one is the earliest month in that list. No money is derived here - the total
 * shown beside it is the server's own number.
 */
function oldestOpenCycle(invoices: Array<{ month?: string }>): string | null {
  const months = invoices
    .map((invoice) => invoice.month)
    .filter((month): month is string => typeof month === 'string' && month.length > 0);
  if (months.length === 0) return null;
  return months.slice().sort()[0] ?? null;
}

/**
 * What the ward owes, read from the server.
 *
 * The server owns every number on this cell. A balance the server could not compute is
 * outstanding, never zero, so it is named rather than summed.
 */
function WardMoney({ dues, loading }: { dues: WardDues | null; loading: boolean }) {
  if (loading) {
    return <span className="text-(--color-text-muted)">reading the server</span>;
  }
  if (!dues || typeof dues.totalDue !== 'number') {
    return <span className="text-(--color-text-muted)">Not reported</span>;
  }
  const open = dues.unpaidInvoices ?? [];
  const unknownBalance = open.some((invoice) => invoice.remaining == null);
  const oldest = oldestOpenCycle(open);
  const cycleLabel = oldest ? ` · oldest ${oldest}` : '';
  const openLabel = `${open.length} open invoice${open.length === 1 ? '' : 's'}${cycleLabel}`;

  if (dues.totalDue > 0) {
    return (
      <div>
        <span className="font-semibold text-(--color-danger-700) tabular-nums">
          {fmtMoney(dues.totalDue)}
        </span>
        <span className="text-2xs block text-(--color-text-muted)">{openLabel}</span>
      </div>
    );
  }

  if (unknownBalance) {
    return (
      <div>
        <span className="font-semibold text-(--color-warning-700)">Balance not reported</span>
        <span className="text-2xs block text-(--color-text-muted)">
          the server holds an open invoice whose total it does not know
        </span>
      </div>
    );
  }

  return (
    <div>
      <span className="font-semibold text-(--color-success-700)">Nothing due</span>
      <span className="text-2xs block text-(--color-text-muted)">no open invoice</span>
    </div>
  );
}

/** The relation of a guardian, spelled the way the server spells it. */
function relationLabel(relation: string): string {
  return relation.charAt(0).toUpperCase() + relation.slice(1);
}

/**
 * The relation of a guardian and what it means for the office.
 *
 * The emergency contact is not stored: the server derives it from the relation
 * (apps/api/src/routes/guardians.ts:102).
 */
function relationText(row: GuardianRow): string {
  const relation = relationLabel(row.relation);
  return row.isEmergencyContact ? `${relation} · emergency contact` : relation;
}

/**
 * What the reach of a contact means for the resident.
 *
 * The mapper puts the resident and the resident's own flag on the row
 * (apps/api/src/routes/guardians.ts:68-104), so the office can tell a contact
 * for a resident in house from a contact for a resident whose stay is over.
 */
function reachText(row: GuardianRow): string {
  if (!row.tenant) return 'no resident on this record';
  if (row.tenant.isActive === false) return 'the stay of the resident is over';
  return 'the resident lives here';
}

// ── Filter vocabulary ──────────────────────────────────────────────────

/** The values the contact-state filter may take in the address bar. */
const STATE_FILTERS = ['reachable', 'off'] as const;

const GUARDIANS_LIST_KEY = ['guardians', 'list'] as const;
const WARD_DUES_KEY = ['guardians', 'ward-dues'] as const;

/** Stable empty fallback: `?? []` would allocate a fresh array on every render. */
const EMPTY_GUARDIANS: GuardianRow[] = [];

export default function GuardiansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <GuardiansContent />
    </Suspense>
  );
}

function GuardiansContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a view of the contacts can be linked, shared, cited
  // and reviewed, and the link the resident page sends lands filtered.
  const searchState = useUrlSearch('search');
  const wardState = useUrlState<string>('tenantId', { defaultValue: '' });
  const stateState = useUrlState<string>('state', {
    defaultValue: '',
    allowed: STATE_FILTERS,
  });
  const { write: writeUrl } = useUrlStateWriter();

  const search = searchState.value.trim();
  const wardFilter = wardState.value;
  const stateFilter = stateState.value;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GuardianRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const listParams = new URLSearchParams();
  if (search) listParams.set('search', search);
  if (wardFilter) listParams.set('tenantId', wardFilter);
  listParams.set('page', String(page));
  listParams.set('limit', String(perPage));

  const {
    data: listBody,
    isPending: isLoading,
    error: queryError,
  } = useApiBodyQuery<GuardiansListBody>(
    [...GUARDIANS_LIST_KEY, page, perPage, search, wardFilter],
    `guardians?${listParams.toString()}`,
  );

  const guardians = listBody?.data ?? EMPTY_GUARDIANS;
  const total = listBody?.meta.total ?? 0;

  /**
   * The dues of every ward in view.
   *
   * The server owns the money: GET /tenants/:id/dues is the same summary the resident reads
   * and the same one the checkout guard uses. Two guardians of the same resident share one
   * query, because the query is keyed on the ward.
   */
  const wards = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const row of guardians) {
      const wardId = row.tenant?._id ?? row.tenantId;
      if (!wardId || seen.has(wardId)) continue;
      seen.add(wardId);
      ids.push(wardId);
    }
    return ids;
  }, [guardians]);

  const duesQueries = useQueries({
    queries: wards.map((wardId): UseQueryOptions<WardDues, Error> => ({
      queryKey: [...WARD_DUES_KEY, wardId],
      queryFn: () => queryData<WardDues>(`tenants/${wardId}/dues`),
      staleTime: 30_000,
    })),
  });

  const duesByWard = new Map<string, { dues: WardDues | null; loading: boolean }>();
  wards.forEach((wardId, index) => {
    const query = duesQueries[index];
    duesByWard.set(wardId, {
      dues: query?.data ?? null,
      loading: query?.isPending ?? false,
    });
  });

  /**
   * The contact state filter.
   *
   * The server cannot filter the guardians by their active flag (apps/api/src/routes/guardians.ts:246-254),
   * so this filter narrows the page in view and nothing else. The band names the scope of every
   * number, so a count is never read as a count of the whole set.
   */
  const visibleGuardians = useMemo(() => {
    if (!stateFilter) return guardians;
    return guardians.filter((row) => (stateFilter === 'reachable' ? row.isActive : !row.isActive));
  }, [guardians, stateFilter]);

  /**
   * The wards that owe money, and the ones that do not.
   *
   * The count is over the page in view, because the server reports the dues of one ward at a
   * time. A ward whose balance the server could not compute counts as owing: an unknown
   * balance is outstanding, never zero.
   */
  let owingWards = 0;
  let clearWards = 0;
  for (const row of visibleGuardians) {
    const wardId = row.tenant?._id ?? row.tenantId;
    const state = wardId ? duesByWard.get(wardId) : undefined;
    const dues = state?.dues;
    if (!dues || typeof dues.totalDue !== 'number') continue;
    const unknown = (dues.unpaidInvoices ?? []).some((invoice) => invoice.remaining == null);
    if (dues.totalDue > 0 || unknown) owingWards += 1;
    else clearWards += 1;
  }

  const switchedOff = visibleGuardians.filter((row) => !row.isActive).length;

  /**
   * The name of the resident in view, so the filter chip names a person and not an id.
   * The server holds the name.
   */
  const wardName =
    guardians.find((row) => (row.tenant?._id ?? row.tenantId) === wardFilter)?.tenant?.user?.name ??
    (wardFilter ? `Resident ${wardFilter.slice(-6)}` : '');

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`guardians/${deleteTarget._id}`).json();
      setWriteResult(
        `The contact "${deleteTarget.name}" is switched off. The server kept the record, set the active flag to false, switched off the portal login of that person and wrote a delete entry in the audit log. The resident was not told and the guardian was not told.`,
      );
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: GUARDIANS_LIST_KEY });
    } catch (err) {
      // The server's answer is the one that matters.
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const clearAllFilters = () => {
    writeUrl({ search: null, tenantId: null, state: null });
    setPage(1);
  };

  const chips = [
    ...(search
      ? [
          {
            key: 'search',
            label: 'Name',
            value: search,
            onRemove: () => {
              searchState.clear();
              setPage(1);
            },
          },
        ]
      : []),
    ...(wardFilter
      ? [
          {
            key: 'ward',
            label: 'Resident',
            value: wardName,
            onRemove: () => {
              wardState.reset();
              setPage(1);
            },
          },
        ]
      : []),
    ...(stateFilter
      ? [
          {
            key: 'state',
            label: 'Contact',
            value: stateFilter === 'reachable' ? 'Reachable' : 'Switched off',
            onRemove: () => {
              stateState.reset();
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<GuardianRow>[] = [
    {
      header: 'Guardian',
      accessor: (row) => (
        <div>
          <Link
            href={`/guardians/${row._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-(--color-brand-600) hover:underline"
          >
            {row.name}
          </Link>
          <div className="text-2xs text-(--color-text-muted)">{relationText(row)}</div>
        </div>
      ),
    },
    {
      header: 'Resident they pay for',
      accessor: (row) => {
        const ward = row.tenant;
        if (!ward) {
          return <span className="text-(--color-text-muted)">No resident on this record</span>;
        }
        const room = ward.room;
        return (
          <div>
            {ward._id ? (
              <Link
                href={`/tenants/${ward._id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                {ward.user?.name ?? 'Open the resident'}
              </Link>
            ) : (
              <span className="font-semibold text-(--color-text-primary)">
                {ward.user?.name ?? 'Resident'}
              </span>
            )}
            <div className="text-2xs text-(--color-text-muted)">
              {room ? (
                <>
                  Room {room.roomNumber ?? '—'}
                  {ward.bedId ? ` · Bed ${ward.bedId}` : ''}
                  {room.floor?.label ? ` · ${room.floor.label}` : ''}
                </>
              ) : (
                'No room on this record'
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'What the ward owes',
      accessor: (row) => {
        const wardId = row.tenant?._id ?? row.tenantId;
        const state = wardId ? duesByWard.get(wardId) : undefined;
        return <WardMoney dues={state?.dues ?? null} loading={state?.loading ?? false} />;
      },
    },
    {
      header: 'Contact',
      accessor: (row) => (
        <div className="text-xs">
          <span className="block font-semibold text-(--color-text-primary)">{row.phone}</span>
          <span className="text-(--color-text-muted)">{row.email ?? 'No email on file'}</span>
        </div>
      ),
    },
    {
      header: 'Reach',
      accessor: (row) => (
        <div>
          <StatusBadge
            variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
            label={row.isActive ? 'Reachable' : 'Switched off'}
          />
          <span className="text-2xs block text-(--color-text-muted)">{reachText(row)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/guardians/${row._id}`)}
          onEdit={() => router.push(`/guardians/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  const filtersActive = Boolean(search || wardFilter || stateFilter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Guardians"
        description="The people who stand behind a resident: who they are, which resident they pay for, and what that resident owes"
        action={
          <Button onClick={() => router.push('/guardians/new')}>
            <Plus className="h-4 w-4" />
            Add Guardian
          </Button>
        }
      />

      <ErrorBanner message={errorMessage(queryError) || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {/* The compact band: the numbers, the filters and the scope of every number
          in one surface, so the first data row is reachable without scrolling past
          half a screen of chrome. */}
      <PageBand
        metrics={[
          {
            label: 'Guardians in view',
            value: String(total),
            hint: 'the server reports these for the filters',
            tone: 'brand',
          },
          {
            label: 'Wards that owe money',
            value: String(owingWards),
            hint: 'on this page, from the server dues read',
            tone: owingWards > 0 ? 'danger' : 'success',
          },
          {
            label: 'Wards with nothing owed',
            value: String(clearWards),
            hint: 'on this page, the server reports no open invoice',
            tone: 'default',
          },
          {
            label: 'Contacts switched off',
            value: String(switchedOff),
            hint: 'on this page, the portal login is off',
            tone: switchedOff > 0 ? 'warning' : 'default',
          },
        ]}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search by name..."
              aria-label="Search by guardian name"
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <ResourceSelect
            endpoint="tenants"
            value={wardFilter}
            onChange={(val) => {
              wardState.setValue(val);
              setPage(1);
            }}
            placeholder="All residents"
            valueKey="_id"
            labelKey={tenantLabel}
            dataPath="data"
            className="w-64"
          />
          <Select
            aria-label="Filter by contact state"
            size="compact"
            options={[
              { value: '', label: 'Any contact state' },
              { value: 'reachable', label: 'Reachable' },
              { value: 'off', label: 'Switched off' },
            ]}
            value={stateFilter}
            onChange={(e) => {
              stateState.setValue(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      <DataTable
        columns={columns}
        data={visibleGuardians}
        keyExtractor={(row: GuardianRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/guardians/${row._id}`)}
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
          // The empty state answers the question the operator asked. An empty filter
          // is not the same as an empty building.
          filtersActive ? (
            <EmptyState
              icon={<ShieldCheck className="h-10 w-10" />}
              title="No guardian in this view"
              description="The server reports no guardian for the filters above. The contact state filter narrows the page in view, because the server cannot filter the guardians by it."
              action={{ label: 'Clear the filters', onClick: clearAllFilters }}
            />
          ) : (
            <EmptyState
              icon={<ShieldCheck className="h-10 w-10" />}
              title="No guardians yet"
              description="Add the first contact: the server creates a portal login for the person you pick, with a temporary password you hand over, and links it to the resident. The resident is not told."
              action={{ label: 'Add Guardian', onClick: () => router.push('/guardians/new') }}
            />
          )
        }
        mobileCardRenderer={(row) => {
          const wardId = row.tenant?._id ?? row.tenantId;
          const state = wardId ? duesByWard.get(wardId) : undefined;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/guardians/${row._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-(--color-brand-600) hover:underline"
                >
                  {row.name}
                </Link>
                <StatusBadge
                  variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
                  label={row.isActive ? 'Reachable' : 'Switched off'}
                />
              </div>
              <div className="text-xs text-(--color-text-muted)">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  {row.tenant?.user?.name ?? 'No resident on this record'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-(--color-text-muted)">
                <span>{row.phone}</span>
                <span>{relationLabel(row.relation)}</span>
              </div>
              <div className="text-xs">
                <WardMoney dues={state?.dues ?? null} loading={state?.loading ?? false} />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/guardians/${row._id}`)}
                  onEdit={() => router.push(`/guardians/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          );
        }}
      />

      {/* What the columns mean. A roster is read fast, and a number nobody can place
          is a number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          The filters live in the address bar, so this view is a link. &quot;Guardians in view&quot;
          is the count the server reports for the whole filtered set; the three numbers beside it
          cover the page in view.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The search</strong> matches the guardian
          name only, not the phone, the email or the resident.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">What the ward owes</strong> is the
          server&apos;s dues summary for that resident (GET /tenants/:id/dues), the same one the
          resident reads on their phone and the same one the guardian reads on theirs. An invoice
          whose total the server does not know counts as outstanding, never as nothing due.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Reach</strong> is the active flag of the
          contact: a reachable contact can sign in to the portal and see the resident they pay for.
          A contact that is switched off keeps the record, keeps the ward and loses the login.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">The contact state filter</strong>
          narrows the page in view only: the server cannot filter the guardians by their active
          flag, so the numbers in the band stay over the set it reports.
        </p>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Switch the contact off"
        message={`The server keeps the record of "${deleteTarget?.name ?? ''}", sets its active flag to false, switches off the portal login of that person and writes a delete entry in the audit log. The resident is not told and the guardian is not told. You can switch the contact back on from the record at any time.`}
        confirmLabel="Switch it off"
        loading={deleting}
        onConfirm={handleDeactivate}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
