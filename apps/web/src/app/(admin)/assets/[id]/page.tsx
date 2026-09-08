'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Package,
  Boxes,
  MapPin,
  Calendar,
  Wrench,
  FileText,
  Pencil,
  Trash2,
  CalendarClock,
  History,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import {
  AssetCategoryIcon,
  AssetServiceTimeline,
  AssetStockMeter,
  assetCategoryLabel,
  formatShortDate,
  isLowStock,
} from '@/components/ui/AssetVisuals';

interface AssetDetail {
  _id: string;
  name: string;
  category: string;
  location?: string;
  floorId?: { _id?: string; label?: string; floorNumber?: number } | string | null;
  roomId?: { _id?: string; roomNumber?: string } | string | null;
  status: string;
  quantity: number;
  lowStockThreshold?: number;
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

function serviceHealth(status: string, nextServiceDate?: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'default' } {
  if (status === 'retired') return { label: 'Closed', variant: 'default' };
  if (!nextServiceDate) return { label: 'Unscheduled', variant: 'default' };
  if (new Date(nextServiceDate).getTime() < Date.now()) return { label: 'Overdue', variant: 'danger' };
  return { label: formatShortDate(nextServiceDate), variant: 'success' };
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`assets/${id}`)
      .json<{ success: boolean; data: AssetDetail }>()
      .then((res) => setAsset(res.data))
      .catch(async (err) => {
        setError((await parseApiError(err)).message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleRetire = async () => {
    if (!asset) return;
    setIsRetiring(true);
    try {
      await api.delete(`assets/${asset._id}`).json();
      toast.success('Asset retired');
      router.push('/assets');
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setIsRetiring(false);
      setRetireModalOpen(false);
    }
  };

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

  const health = asset ? serviceHealth(asset.status, asset.nextServiceDate) : null;
  const low = asset ? isLowStock(asset.quantity, asset.lowStockThreshold) : false;

  return (
    <FormPage
      title={asset?.name ?? 'Asset Details'}
      description={
        asset ? `${assetCategoryLabel(asset.category)} · ${asset.location ?? 'No location'}` : 'Asset details'
      }
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/assets/${asset._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {asset.status !== 'retired' && (
              <Button variant="danger" size="sm" onClick={() => setRetireModalOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Retire
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {asset && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Quantity on hand"
              value={asset.quantity}
              icon={<Boxes className="h-4 w-4" />}
              variant={low ? 'warning' : 'default'}
              trend={
                low
                  ? { value: 'Low', direction: 'down', label: `threshold ${asset.lowStockThreshold ?? 0}` }
                  : undefined
              }
            />
            <StatCard
              title="Category"
              value={assetCategoryLabel(asset.category)}
              icon={<AssetCategoryIcon category={asset.category} className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Next service"
              value={health?.label ?? '—'}
              icon={<CalendarClock className="h-4 w-4" />}
              variant={health?.variant ?? 'default'}
            />
            <StatCard
              title="Placement"
              value={
                (asset.roomId && typeof asset.roomId === 'object' && asset.roomId.roomNumber
                  ? `Room ${asset.roomId.roomNumber}`
                  : null) ??
                (asset.floorId && typeof asset.floorId === 'object'
                  ? (asset.floorId.label ??
                    (asset.floorId.floorNumber != null ? `Floor ${asset.floorId.floorNumber}` : null))
                  : null) ??
                (asset.location ? asset.location.slice(0, 18) : null) ??
                'Unassigned'
              }
              icon={<MapPin className="h-4 w-4" />}
              variant="default"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Identification" icon={<Package />}>
              <DetailList>
                <DetailRow label="Name" value={asset.name} />
                <DetailRow
                  label="Category"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <AssetCategoryIcon
                        category={asset.category}
                        className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]"
                      />
                      {assetCategoryLabel(asset.category)}
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
                {asset.floorId != null && typeof asset.floorId === 'object' && (
                  <DetailRow
                    label="Floor"
                    value={
                      asset.floorId.label ??
                      (asset.floorId.floorNumber != null
                        ? `Floor ${asset.floorId.floorNumber}`
                        : '—')
                    }
                  />
                )}
                {asset.roomId != null && typeof asset.roomId === 'object' && (
                  <DetailRow
                    label="Room"
                    value={
                      <button
                        type="button"
                        onClick={() =>
                          asset.roomId &&
                          typeof asset.roomId === 'object' &&
                          asset.roomId._id &&
                          router.push(`/rooms/${asset.roomId._id}`)
                        }
                        className="font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                      >
                        {asset.roomId.roomNumber ?? 'Room'}
                      </button>
                    }
                  />
                )}
              </DetailList>
            </DetailCard>

            <DetailCard title="Inventory" icon={<Boxes />}>
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
                <DetailRow
                  label="Quantity"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span className="tabular-nums">{asset.quantity}</span>
                      {low && (
                        <span className="inline-flex items-center rounded-full bg-[color:var(--color-warning-100)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-warning-800)]">
                          Low Stock
                        </span>
                      )}
                    </span>
                  }
                />
                {asset.lowStockThreshold != null && (
                  <DetailRow label="Low Stock Threshold" value={asset.lowStockThreshold} />
                )}
              </DetailList>
              <AssetStockMeter
                quantity={asset.quantity}
                threshold={asset.lowStockThreshold}
                className="mt-3"
              />
            </DetailCard>
          </div>

          <DetailCard title="Dates & Service" icon={<Wrench />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <p className="text-[11px] font-semibold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                  Purchase Date
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatShortDate(asset.purchasedDate)}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <p className="text-[11px] font-semibold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                  Last Service
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatShortDate(asset.lastServicedDate)}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                    Next Service
                  </p>
                  {health?.variant === 'danger' && (
                    <span className="inline-flex items-center rounded-full bg-[color:var(--color-danger-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-danger-700)]">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  <Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {formatShortDate(asset.nextServiceDate)}
                </p>
                {asset.status !== 'retired' && (
                  <button
                    type="button"
                    onClick={() => router.push(`/assets/${asset._id}/edit`)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reschedule service
                  </button>
                )}
              </div>
            </div>
            <AssetServiceTimeline
              purchasedDate={asset.purchasedDate}
              lastServicedDate={asset.lastServicedDate}
              nextServiceDate={asset.nextServiceDate}
              status={asset.status}
              className="mt-5"
            />
          </DetailCard>

          {asset.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {asset.notes}
              </p>
            </DetailCard>
          )}

          <DetailCard title="Record history" icon={<History />}>
            <DetailList>
              <DetailRow label="Created" value={formatDateTime(asset.createdAt)} />
              <DetailRow label="Last updated" value={formatDateTime(asset.updatedAt)} />
              <DetailRow
                label="Lifecycle"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {asset.status === 'retired' ? 'Retired (terminal)' : 'Active record'}
                  </span>
                }
              />
            </DetailList>
          </DetailCard>

          <ConfirmModal
            open={retireModalOpen}
            title="Retire asset"
            message={`Retire "${asset.name}"? The asset will be marked as retired (not permanently deleted).`}
            loading={isRetiring}
            onConfirm={handleRetire}
            onCancel={() => setRetireModalOpen(false)}
          />
        </div>
      )}
    </FormPage>
  );
}
