'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';

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

import {
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shirt,
  Sparkles,
  Wrench,
} from 'lucide-react';

const serviceIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-5 w-5" />,
  electricity: <Zap className="h-5 w-5" />,
  water_supply: <Droplets className="h-5 w-5" />,
  washing_machine_1: <Shirt className="h-5 w-5" />,
  washing_machine_2: <Shirt className="h-5 w-5" />,
  fridge: <Sparkles className="h-5 w-5" />,
  geyser: <Thermometer className="h-5 w-5" />,
};

const serviceLabels: Record<string, string> = {
  wifi: 'WiFi',
  electricity: 'Electricity',
  water_supply: 'Water Supply',
  washing_machine_1: 'Washing Machine 1',
  washing_machine_2: 'Washing Machine 2',
  fridge: 'Fridge',
  geyser: 'Geyser',
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceStatusRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const columns: DataTableColumn<ServiceStatusRow>[] = [
    {
      header: 'Service',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-surface-600 flex-shrink-0">
            {serviceIcons[row.serviceType] ?? <Wrench className="h-5 w-5" />}
          </span>
          <div>
            <span className="text-surface-900 font-semibold">
              {serviceLabels[row.serviceType] ?? row.serviceType}
            </span>
            {row.openComplaintCount ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-danger-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-danger-600">
                {row.openComplaintCount} open
              </span>
            ) : null}
          </div>
        </div>
      ),
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
        <span className="text-surface-500 block max-w-[200px] truncate text-xs">
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
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/services/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
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
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Service Status</h2>
          <p className="text-surface-500 mt-0.5 text-sm">
            Monitor and update service health across floors
          </p>
        </div>
        <Button onClick={() => router.push('/services/new')}>
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
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
