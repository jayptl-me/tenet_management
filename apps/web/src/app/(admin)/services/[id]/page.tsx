'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Wifi, Calendar, Info, Building, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface ServiceDetail {
  _id: string;
  serviceType: string;
  status: string;
  note?: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  lastUpdatedBy?: { name: string };
  lastUpdatedAt?: string;
  openComplaintCount?: number;
  updatedAt: string;
}

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

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`services/${id}`)
      .json<{ success: boolean; data: ServiceDetail }>()
      .then((res) => {
        setService(res.data);
      })
      .catch(() => {
        setError('Failed to load service details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-[color:var(--color-brand-500)] h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Service not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="font-display text-[color:var(--color-surface-900)] text-2xl font-extrabold">
              {serviceLabels[service.serviceType] ?? service.serviceType}
            </h2>
            <p className="text-[color:var(--color-surface-500)] text-sm">ID: {service._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusVariant(service.status)}
          label={service.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Service Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
          <Wifi className="mr-1 inline h-4 w-4" />
          Service Information
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Service Type
            </p>
            <p className="text-[color:var(--color-surface-900)] mt-1 text-sm font-semibold">
              {serviceLabels[service.serviceType] ?? service.serviceType}
            </p>
          </div>
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Status
            </p>
            <p className="mt-1">
              <StatusBadge
                variant={statusVariant(service.status)}
                label={service.status.replace(/_/g, ' ')}
              />
            </p>
          </div>
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Floor
            </p>
            <p className="text-[color:var(--color-surface-700)] mt-1 flex items-center gap-1 text-sm">
              <Building className="h-3.5 w-3.5" />
              {service.floor?.label ?? 'N/A'}
              {service.floor?.floorNumber != null && ` (#${service.floor.floorNumber})`}
            </p>
          </div>
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Last Updated
            </p>
            <p className="text-[color:var(--color-surface-700)] mt-1 flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {service.lastUpdatedAt
                ? new Date(service.lastUpdatedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Open Complaints Card */}
      {service.openComplaintCount !== undefined && service.openComplaintCount > 0 && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-[color:var(--color-danger-800)] mb-2 text-lg font-bold">
            {service.openComplaintCount} Open Complaint{service.openComplaintCount > 1 ? 's' : ''}
          </h3>
          <p className="text-[color:var(--color-danger-600)] text-sm">
            There {service.openComplaintCount === 1 ? 'is' : 'are'} currently {service.openComplaintCount} unresolved complaint{service.openComplaintCount > 1 ? 's' : ''} related to this service on this floor.
          </p>
        </div>
      )}

      {/* Updated By Card */}
      {service.lastUpdatedBy && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
            <User className="mr-1 inline h-4 w-4" />
            Last Updated By
          </h3>
          <p className="text-[color:var(--color-surface-700)] text-sm">
            {service.lastUpdatedBy.name ?? 'Unknown'}
          </p>
        </div>
      )}

      {/* Note Card */}
      {service.note && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
            <Info className="mr-1 inline h-4 w-4" />
            Notes
          </h3>
          <p className="text-[color:var(--color-surface-700)] whitespace-pre-wrap text-sm">{service.note}</p>
        </div>
      )}
    </div>
  );
}
