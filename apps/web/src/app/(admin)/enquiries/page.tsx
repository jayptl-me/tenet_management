'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MessageSquareMore,
  Search,
  X,
  PhoneCall,
  UserCheck,
  TrendingUp,
  Inbox,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import type { IEnquiryStats } from '@pg/types';

interface EnquiryRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  status: string;
  source: string;
  preferredSharing?: string;
  convertedTenantId?:
    | string
    | {
        _id?: string;
        bedId?: string | null;
        user?: { name?: string };
        room?: { roomNumber?: string };
      }
    | null;
  createdAt: string;
}

function convertedTenantLink(row: EnquiryRow): { id: string; label: string } | null {
  const c = row.convertedTenantId;
  if (!c || typeof c === 'string') return null;
  const id = c._id ? String(c._id) : '';
  if (!id) return null;
  const parts = [c.user?.name ?? 'Tenant'];
  if (c.room?.roomNumber) parts.push(`Room ${c.room.roomNumber}`);
  if (c.bedId) parts.push(`Bed ${c.bedId}`);
  return { id, label: parts.join(' · ') };
}

function formatPreferredSharing(value?: string): string {
  if (!value) return '—';
  if (value === 'single') return 'Single';
  return `${value}-share`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'landing_page', label: 'Landing page' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

export default function EnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [stats, setStats] = useState<IEnquiryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EnquiryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('enquiries/stats').json<{
        success: boolean;
        data: IEnquiryStats;
      }>();
      setStats(res.data);
    } catch {
      // Non-critical background stats failure
    }
  }, []);

  const fetchEnquiries = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`enquiries?${params.toString()}`).json<{
        success: boolean;
        data: EnquiryRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setEnquiries(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, sourceFilter, debouncedSearch, fromDate, toDate]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`enquiries/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchEnquiries();
      fetchStats();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    search || statusFilter || sourceFilter || fromDate || toDate,
  );

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const columns: DataTableColumn<EnquiryRow>[] = [    {
      header: 'Name',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.name}</span>
      ),
    },
    {
      header: 'Phone',
      accessor: (row) => (
        <a
          href={`tel:${row.phone}`}
          className="text-[color:var(--color-brand-600)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.phone}
        </a>
      ),
    },
    {
      header: 'Email',
      accessor: (row) =>
        row.email ? (
          <a
            href={`mailto:${row.email}`}
            className="text-[color:var(--color-text-secondary)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.email}
          </a>
        ) : (
          '—'
        ),
    },
    {
      header: 'Source',
      accessor: (row) => <span className="capitalize">{row.source.replace(/_/g, ' ')}</span>,
    },
    {
      header: 'Sharing',
      accessor: (row) => formatPreferredSharing(row.preferredSharing),
    },
    {
      header: 'Status',
      accessor: (row) => {
        const converted = convertedTenantLink(row);
        return (
          <span className="inline-flex flex-col items-start gap-1">
            <StatusBadge
              variant={statusToVariant(row.status)}
              label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
            />
            {converted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/tenants/${converted.id}`);
                }}
                className="text-[11px] font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
              >
                {converted.label}
              </button>
            )}
          </span>
        );
      },
    },
    {
      header: 'Date',
      accessor: (row) =>
        new Date(row.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/enquiries/${row._id}`)}
          onEdit={() => router.push(`/enquiries/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        description="Manage prospective tenant leads, viewings, and conversions"
        action={
          <Button onClick={() => router.push('/enquiries/new')}>
            <Plus className="h-4 w-4" />
            New Enquiry
          </Button>
        }
      />

      {/* ── Stat Cards ────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            title="Total Leads"
            value={stats.total}
            icon={<Inbox className="h-4 w-4" />}
            variant="default"
          />
          <StatCard
            title="New / Pending"
            value={stats.byStatus.new}
            icon={<PhoneCall className="h-4 w-4" />}
            variant={stats.byStatus.new > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Contacted"
            value={stats.byStatus.contacted}
            icon={<MessageSquareMore className="h-4 w-4" />}
            variant="default"
          />
          <StatCard
            title="Converted"
            value={stats.byStatus.converted}
            icon={<UserCheck className="h-4 w-4" />}
            variant="success"
          />
          <StatCard
            title="Conversion Rate"
            value={`${stats.conversionRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="brand"
          />
        </div>
      )}

      <ErrorBanner message={error} />

      {/* ── Filter Bar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Input
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-[color:var(--color-text-muted)]" />}
            aria-label="Search enquiries"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-[180px]"
          />
          <Select
            aria-label="Filter by source"
            options={SOURCE_OPTIONS}
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-[180px]"
          />
          <DateRangePicker
            compact
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(value) => {
              setFromDate(value);
              setPage(1);
            }}
            onToChange={(value) => {
              setToDate(value);
              setPage(1);
            }}
            className="w-full sm:w-[300px]"
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              aria-label="Clear all active filters"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={enquiries}
        keyExtractor={(row: EnquiryRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/enquiries/${row._id}`)}
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
            icon={<MessageSquareMore className="h-12 w-12" />}
            title="No enquiries found"
            description={
              search || statusFilter || sourceFilter || fromDate || toDate
                ? 'Try adjusting your search or filters'
                : 'When people reach out or walk in, record them here'
            }
            action={{ label: 'New Enquiry', onClick: () => router.push('/enquiries/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.name}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.phone}</span>
              {row.email && <span>{row.email}</span>}
              <span className="capitalize">{row.source.replace(/_/g, ' ')}</span>
              <span>{formatPreferredSharing(row.preferredSharing)}</span>
              <span>
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/enquiries/${row._id}`)}
                onEdit={() => router.push(`/enquiries/${row._id}/edit`)}
                onDelete={() => setDeleteTarget(row)}
              />
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Enquiry"
        message={`Are you sure you want to delete enquiry from "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
