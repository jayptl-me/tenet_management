'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';

interface ServiceStatusRow {
  _id: string;
  serviceType: string;
  status: string;
  floor?: { label: string };
  lastUpdatedAt?: string;
  lastUpdatedBy?: { name: string };
  note?: string;
}

import {
  Wifi,
  Droplets,
  Zap,
  Thermometer,
  Shirt,
  Sparkles,
  Shield,
  ArrowUpDown,
  Car,
  Wrench,
} from 'lucide-react';

const serviceIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-5 w-5" />,
  water: <Droplets className="h-5 w-5" />,
  power: <Zap className="h-5 w-5" />,
  ac: <Thermometer className="h-5 w-5" />,
  laundry: <Shirt className="h-5 w-5" />,
  cleaning: <Sparkles className="h-5 w-5" />,
  security: <Shield className="h-5 w-5" />,
  elevator: <ArrowUpDown className="h-5 w-5" />,
  parking: <Car className="h-5 w-5" />,
  other: <Wrench className="h-5 w-5" />,
};

const serviceLabels: Record<string, string> = {
  wifi: 'WiFi',
  water: 'Water Supply',
  power: 'Power',
  ac: 'Air Conditioning',
  laundry: 'Laundry',
  cleaning: 'Cleaning',
  security: 'Security',
  elevator: 'Elevator',
  parking: 'Parking',
  other: 'Other',
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceStatusRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

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
          <span className="text-surface-900 font-semibold">
            {serviceLabels[row.serviceType] ?? row.serviceType}
          </span>
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
          variant={
            row.status === 'operational'
              ? 'success'
              : row.status === 'degraded'
                ? 'warning'
                : 'danger'
          }
          label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
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
        </div>
      ),
      className: 'w-[90px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-surface-900 text-2xl font-extrabold">Service Status</h2>
        <p className="text-surface-500 mt-0.5 text-sm">
          Monitor and update service health across floors
        </p>
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
    </div>
  );
}
