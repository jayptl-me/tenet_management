'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Pencil, Trash2, Plus, Wrench, Wifi, Zap, Droplets, Thermometer, Shirt, Sparkles, BedSingle, ScrollText, MoonStar, Fan, Refrigerator, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
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

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'operational': return 'success';
    case 'degraded': return 'warning';
    case 'down': return 'danger';
    default: return 'neutral';
  }
}

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceStatusRow[]>([]);
  const [definitions, setDefinitions] = useState<AmenityDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceStatusRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch amenity definitions once
  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: { amenityDefinitions?: AmenityDefinition[] } }>()
      .then((res) => {
        setDefinitions(res.data?.amenityDefinitions ?? []);
      })
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`services/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchServices();
    } catch {
      setError('Failed to delete service');
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

      const res = await api.get(`services?${params.toString()}`).json<{
        success: boolean;
        data: ServiceStatusRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setServices(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Dynamic label resolver
  const getLabel = (serviceType: string): string => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return def.label;
    return serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Dynamic icon resolver
  const getIcon = (serviceType: string): LucideIcon => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return resolveIcon(def.icon);
    return Wrench;
  };

  const columns: DataTableColumn<ServiceStatusRow>[] = [
    {
      header: 'Service',
      accessor: (row) => {
        const Icon = getIcon(row.serviceType);
        return (
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-[color:var(--color-surface-500)]">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[color:var(--color-surface-900)] font-semibold">
                {getLabel(row.serviceType)}
              </span>
              {row.openComplaintCount ? (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-[color:var(--color-danger-100)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[color:var(--color-danger-600)]">
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
        <StatusBadge
          variant={statusVariant(row.status)}
          label={row.status.replace(/_/g, ' ')}
        />
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
        <span className="block max-w-[200px] truncate text-xs text-[color:var(--color-surface-500)]">
          {row.note ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/services/${row._id}`);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-surface-700)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)]"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/services/${row._id}/edit`);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-50)]"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-danger-50)]"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family:var(--font-display)] text-2xl font-extrabold text-[color:var(--color-surface-900)]">
            Service Status
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Monitor and update service health across floors
          </p>
        </div>
        <Button onClick={() => router.push('/services/new')}>
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-4 text-sm font-semibold text-[color:var(--color-danger-800)]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
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
                  <Icon className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                  <span className="font-semibold text-[color:var(--color-text-primary)] text-sm">
                    {getLabel(row.serviceType)}
                  </span>
                </div>
                <StatusBadge
                  variant={statusVariant(row.status)}
                  label={row.status.replace(/_/g, ' ')}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/services/${row._id}`);
                  }}
                  className="text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-200)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                  title="View"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/services/${row._id}/edit`);
                  }}
                  className="text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(row);
                  }}
                  className="text-[color:var(--color-danger-600)] hover:bg-[color:var(--color-danger-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
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
