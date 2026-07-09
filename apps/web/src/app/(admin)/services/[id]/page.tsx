'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Wifi,
  Calendar,
  Building,
  User,
  Pencil,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
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
      .then((res) => setService(res.data))
      .catch(() => setError('Failed to load service details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !service)) {
    return (
      <FormPage
        title="Service Details"
        description="View service information"
        backHref="/services"
        error={error || 'Service not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = service ? statusToVariant(service.status) : 'neutral';
  const label = service
    ? (serviceLabels[service.serviceType] ?? service.serviceType)
    : 'Service Details';
  const floorLabel = service?.floor?.label ?? 'N/A';
  const openCount = service?.openComplaintCount ?? 0;

  return (
    <FormPage
      title={label}
      description={
        service
          ? `${floorLabel}${service.floor?.floorNumber != null ? ` (Floor #${service.floor.floorNumber})` : ''}`
          : undefined
      }
      backHref="/services"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        service ? (
          <StatusBadge
            variant={statusVariant}
            label={service.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        service ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/services/${service._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {service && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Floor"
              value={floorLabel}
              icon={<Building className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Status"
              value={service.status.replace(/_/g, ' ')}
              icon={<Wifi className="h-4 w-4" />}
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : 'danger'
              }
            />
            <StatCard
              title="Open Complaints"
              value={openCount.toString()}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={openCount > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Service Information" icon={<Wifi />}>
              <DetailList>
                <DetailRow label="Type" value={label} />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={service.status.replace(/_/g, ' ')}
                    />
                  }
                />
                <DetailRow
                  label="Floor"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {floorLabel}
                      {service.floor?.floorNumber != null
                        ? ` #${service.floor.floorNumber}`
                        : ''}
                    </span>
                  }
                />
                <DetailRow
                  label="Last Updated"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDateTime(service.lastUpdatedAt || service.updatedAt)}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Last Updated By" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Name"
                  value={service.lastUpdatedBy?.name ?? 'System'}
                />
                <DetailRow
                  label="Timestamp"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDateTime(service.lastUpdatedAt || service.updatedAt)}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          {openCount > 0 && (
            <DetailCard
              title={`${openCount} Open Complaint${openCount > 1 ? 's' : ''}`}
              icon={<AlertTriangle />}
              variant="danger"
            >
              <p className="text-sm font-medium text-[color:var(--color-text-secondary)]">
                There {openCount === 1 ? 'is' : 'are'} currently {openCount} unresolved
                complaint{openCount > 1 ? 's' : ''} related to this service on this floor.
              </p>
            </DetailCard>
          )}

          {service.note && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {service.note}
              </p>
            </DetailCard>
          )}

          <DetailCard title="Actions" icon={<Pencil />}>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => router.push(`/services/${service._id}/edit`)}
              >
                <Pencil className="h-4 w-4" /> Edit Service
              </Button>
            </div>
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
