'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Package, MapPin, Hash, Calendar, Wrench, User, FileText, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface AssetDetail {
  _id: string;
  name: string;
  category: string;
  serialNumber?: string;
  location?: string;
  assignedTo?: {
    _id: string;
    user?: { _id: string; name: string };
    room?: { _id: string; roomNumber: string };
  };
  status: string;
  quantity: number;
  lowStockThreshold?: number;
  purchaseDate?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
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

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`assets/${id}`)
      .json<{ success: boolean; data: AssetDetail }>()
      .then((res) => setAsset(res.data))
      .catch(() => setError('Failed to load asset details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !asset)) {
    return (
      <FormPage
        title="Asset Details"
        description="View asset information"
        backHref="/assets"
        error={error || 'Asset not found'}
        maxWidth="4xl"
      />
    );
  }

  return (
    <FormPage
      title={asset?.name ?? 'Asset Details'}
      description="Asset details"
      backHref="/assets"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        asset ? (
          <StatusBadge
            variant={statusToVariant(asset.status)}
            label={asset.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        asset ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/assets/${asset._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {asset && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Identification" icon={<Package />}>
              <DetailList>
                <DetailRow label="Name" value={asset.name} />
                <DetailRow
                  label="Category"
                  value={<span className="capitalize">{asset.category}</span>}
                />
                <DetailRow
                  label="Serial Number"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {asset.serialNumber ?? '—'}
                    </span>
                  }
                />
                <DetailRow
                  label="Location"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {asset.location ?? '—'}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Status & Assignment" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusToVariant(asset.status)}
                      label={asset.status.replace(/_/g, ' ')}
                    />
                  }
                />
                <DetailRow label="Quantity" value={asset.quantity} />
                {asset.lowStockThreshold != null && (
                  <DetailRow label="Low Stock Threshold" value={asset.lowStockThreshold} />
                )}
                {asset.assignedTo && (
                  <DetailRow
                    label="Assigned To"
                    value={
                      <span className="flex flex-col items-end gap-0.5">
                        <span>{asset.assignedTo.user?.name ?? 'N/A'}</span>
                        {asset.assignedTo.room && (
                          <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                            Room {asset.assignedTo.room.roomNumber}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Dates & Service" icon={<Wrench />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Purchase Date
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatDate(asset.purchaseDate)}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Last Service
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatDate(asset.lastServiceDate)}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Next Service
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatDate(asset.nextServiceDate)}
                </p>
              </div>
            </div>
          </DetailCard>

          {asset.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {asset.notes}
              </p>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Created {formatDateTime(asset.createdAt)} · Updated {formatDateTime(asset.updatedAt)}
          </p>
        </div>
      )}
    </FormPage>
  );
}
