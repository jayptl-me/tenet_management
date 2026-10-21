'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import {
  Plus,
  Wrench,
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shirt,
  Sparkles,
  BedSingle,
  ScrollText,
  MoonStar,
  Fan,
  Refrigerator,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { TableActions } from '@/components/ui/TableActions';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { floorLabel } from '@/lib/resource-select-presets';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { AmenityDefinition } from '@pg/types';

// ── Dynamic icon resolution ──
const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  zap: Zap,
  droplets: Droplets,
  thermometer: Thermometer,
  shirt: Shirt,
  sparkles: Sparkles,
  'bed-single': BedSingle,
  'scroll-text': ScrollText,
  'moon-star': MoonStar,
  fan: Fan,
  refrigerator: Refrigerator,
  wrench: Wrench,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Wrench;
}

interface ServiceStatusRow {
  _id: string;
  serviceType: string;
  status: string;
  floor?: { label: string; floorNumber?: number };
  lastUpdatedAt?: string;
  lastUpdatedBy?: { name: string };
  note?: string;
  openComplaintCount?: number;
}

interface ServiceSummary {
  operational: number;
  degraded: number;
  down: number;
}

/** One row of the server's answer to a bulk provisioning run. */
interface ProvisionedRow {
  floor: string;
  outcome: string;
}

/**
 * Read the per-floor answer the provisioning page handed over. A malformed or
 * missing payload renders nothing rather than a guess.
 */
function parseProvisionedRows(raw: string | null): ProvisionedRow[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const rows: ProvisionedRow[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as { floor?: unknown; outcome?: unknown };
    if (typeof row.floor !== 'string' || typeof row.outcome !== 'string') continue;
    rows.push({ floor: row.floor, outcome: row.outcome });
  }
  return rows;
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}

function ServicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The server's per-floor answer to a bulk provisioning run, if this visit
  // came from one.
  const provisionedRows = parseProvisionedRows(searchParams.get('provisioned'));
  const [services, setServices] = useState<ServiceStatusRow[]>([]);
  const [definitions, setDefinitions] = useState<AmenityDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [error, setError] = useState('');
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceStatusRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSyncAllFloors = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await api.post('floors/reseed-services').json<{
        success: boolean;
        data: { floorsTouched: number; rowsCreated: number };
      }>();
      if (res.success) {
        // Re-read the server: the table and the tiles below show the state the
        // server holds, not a locally asserted outcome.
        await Promise.all([fetchServices(), fetchSummary()]);
        setWriteResult(
          `Sync done. The server provisioned ${res.data.rowsCreated} service row(s) across ${res.data.floorsTouched} floor(s). The table and the tiles below show the server's counts.`,
        );
      }
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: { amenityDefinitions?: AmenityDefinition[] } }>()
      .then((res) => {
        setDefinitions(res.data?.amenityDefinitions ?? []);
      })
      .catch(() => {});
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api
        .get('services/summary')
        .json<{ success: boolean; data: ServiceSummary }>();
      if (res.success) {
        setSummary(res.data);
      }
    } catch {
      // Summary load failure is non-blocking
    }
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`services/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchServices();
      fetchSummary();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setDeleting(false);
    }
  };

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);
      if (floorFilter) params.set('floorId', floorFilter);

      const res = await api.get(`services?${params.toString()}`).json<{
        success: boolean;
        data: ServiceStatusRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setServices(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, floorFilter]);

  useEffect(() => {
    fetchServices();
    fetchSummary();
  }, [fetchServices, fetchSummary]);

  const getLabel = (serviceType: string): string => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return def.label;
    return serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getIcon = (serviceType: string): LucideIcon => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return resolveIcon(def.icon);
    return Wrench;
  };

  const handleExportCsv = async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (statusFilter) params.set('status', statusFilter);
      if (floorFilter) params.set('floorId', floorFilter);
      const res = await api.get(`services?${params.toString()}`).json<{
        success: boolean;
        data: ServiceStatusRow[];
      }>();
      const exportRows = res.data ?? [];
      if (exportRows.length === 0) return;
      const headers = ['Service', 'Floor', 'Status', 'Open Complaints', 'Last Updated', 'Note'];
      const escapeCsv = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const rows = exportRows.map((s) => [
        escapeCsv(getLabel(s.serviceType)),
        escapeCsv(s.floor?.label ?? '—'),
        escapeCsv(s.status),
        escapeCsv(s.openComplaintCount ?? 0),
        escapeCsv(s.lastUpdatedAt ? new Date(s.lastUpdatedAt).toISOString().slice(0, 10) : '—'),
        escapeCsv(s.note ?? ''),
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `services-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const columns: DataTableColumn<ServiceStatusRow>[] = [
    {
      header: 'Service',
      accessor: (row) => {
        const Icon = getIcon(row.serviceType);
        return (
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-(--color-text-muted)">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <span className="font-semibold text-(--color-text-primary)">
                {getLabel(row.serviceType)}
              </span>
              {row.openComplaintCount ? (
                <span className="text-3xs ml-1.5 inline-flex items-center rounded-full bg-(--color-danger-100) px-1.5 py-0.5 font-mono font-bold text-(--color-danger-600)">
                  {row.openComplaintCount} open
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Floor',
      accessor: (row) => row.floor?.label ?? '—',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge variant={statusToVariant(row.status)} label={row.status.replace(/_/g, ' ')} />
      ),
    },
    {
      header: 'Last Updated',
      accessor: (row) =>
        row.lastUpdatedAt
          ? new Date(row.lastUpdatedAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      header: 'Updated By',
      accessor: (row) => row.lastUpdatedBy?.name ?? '—',
    },
    {
      header: 'Note',
      accessor: (row) => (
        <span className="block max-w-[200px] truncate text-xs text-(--color-text-muted)">
          {row.note ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/services/${row._id}`)}
          onEdit={() => router.push(`/services/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Status"
        description="Monitor and update service health across floors"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSyncAllFloors} loading={syncing}>
              <RotateCcw className="h-4 w-4" />
              Sync All Floor Services
            </Button>
            <Button onClick={() => router.push('/services/new')}>
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {provisionedRows.length > 0 && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          <p className="mb-2">Provisioning result, per floor, as the server answered it:</p>
          <ul className="space-y-1">
            {provisionedRows.map((row) => (
              <li key={`${row.floor}-${row.outcome}`} className="font-mono text-xs">
                <span className="font-semibold text-(--color-text-primary)">{row.floor}</span>
                <span className="mx-1 text-(--color-text-muted)">-</span>
                <span>{row.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Operational"
            value={summary.operational ?? 0}
            variant="success"
            icon={<CheckCircle className="h-5 w-5 text-(--color-success-600)" />}
            onClick={() => {
              setStatusFilter(statusFilter === 'operational' ? '' : 'operational');
              setPage(1);
            }}
            className="cursor-pointer"
          />
          <StatCard
            title="Degraded"
            value={summary.degraded ?? 0}
            variant="warning"
            icon={<AlertTriangle className="h-5 w-5 text-(--color-warning-600)" />}
            onClick={() => {
              setStatusFilter(statusFilter === 'degraded' ? '' : 'degraded');
              setPage(1);
            }}
            className="cursor-pointer"
          />
          <StatCard
            title="Down"
            value={summary.down ?? 0}
            variant="danger"
            icon={<XCircle className="h-5 w-5 text-(--color-danger-600)" />}
            onClick={() => {
              setStatusFilter(statusFilter === 'down' ? '' : 'down');
              setPage(1);
            }}
            className="cursor-pointer"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'operational', label: 'Operational' },
            { value: 'degraded', label: 'Degraded' },
            { value: 'down', label: 'Down' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
        <ResourceSelect
          endpoint="floors"
          value={floorFilter}
          onChange={(val) => {
            setFloorFilter(val);
            setPage(1);
          }}
          placeholder="All Floors"
          labelKey={floorLabel}
          dataPath="data"
          className="max-w-[200px]"
        />
        <Button variant="outline" onClick={handleExportCsv} disabled={services.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={services}
        keyExtractor={(row: ServiceStatusRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/services/${row._id}`)}
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
          <EmptyState
            icon={<Wrench className="h-12 w-12" />}
            title="No services yet"
            description="Add your first service status to start monitoring"
            action={{ label: 'Add Service', onClick: () => router.push('/services/new') }}
          />
        }
        mobileCardRenderer={(row) => {
          const Icon = getIcon(row.serviceType);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-(--color-text-muted)" />
                  <span className="text-sm font-semibold text-(--color-text-primary)">
                    {getLabel(row.serviceType)}
                  </span>
                </div>
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status.replace(/_/g, ' ')}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
                <span>{row.floor?.label ?? '—'}</span>
                {row.lastUpdatedAt && (
                  <span>
                    {new Date(row.lastUpdatedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/services/${row._id}`)}
                  onEdit={() => router.push(`/services/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            </div>
          );
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Service"
        message="Are you sure you want to delete this service status? This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
