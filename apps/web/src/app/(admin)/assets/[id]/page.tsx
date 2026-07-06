'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Hash, Calendar, Wrench, User, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">Asset not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">{asset.name}</h2>
          <p className="text-surface-500 text-sm">Asset Details</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Identity Section */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Identification
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Package className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Name
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {asset.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Package className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Category
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold capitalize">
                    {asset.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Serial Number
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {asset.serialNumber ?? '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Location
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {asset.location ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Status & Assignment Section */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Status & Assignment
            </h3>

            <div className="space-y-3">
              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Status
                </p>
                <StatusBadge
                  variant={statusToVariant(asset.status)}
                  label={asset.status.replace(/_/g, ' ')}
                />
              </div>

              <div className="flex items-center gap-3">
                <Package className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Quantity
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {asset.quantity}
                  </p>
                </div>
              </div>

              {asset.lowStockThreshold != null && (
                <div className="flex items-center gap-3">
                  <Package className="text-surface-400 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                      Low Stock Threshold
                    </p>
                    <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                      {asset.lowStockThreshold}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {asset.assignedTo && (
              <div className="border-surface-200 bg-surface-50 mt-3 rounded-md border-[length:var(--bw-default)] p-4">
                <p className="font-display text-surface-400 mb-2 text-xs uppercase tracking-wide">
                  Assigned To
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="text-surface-400 h-4 w-4" />
                    <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                      {asset.assignedTo.user?.name ?? 'N/A'}
                    </p>
                  </div>
                  {asset.assignedTo.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="text-surface-400 h-4 w-4" />
                      <p className="text-surface-500 text-sm">
                        Room {asset.assignedTo.room.roomNumber}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Dates Section */}
        <section className="border-surface-200 mt-6 border-t-2 pt-4">
          <h3 className="font-display text-surface-900 mb-3 text-lg font-bold">Dates & Service</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border-surface-200 bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] p-3">
              <Calendar className="text-surface-400 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Purchase Date
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {asset.purchaseDate
                    ? new Date(asset.purchaseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="border-surface-200 bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] p-3">
              <Wrench className="text-surface-400 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Last Service
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {asset.lastServiceDate
                    ? new Date(asset.lastServiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="border-surface-200 bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] p-3">
              <Wrench className="text-surface-400 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Next Service
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {asset.nextServiceDate
                    ? new Date(asset.nextServiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notes Section */}
        {asset.notes && (
          <section className="border-surface-200 mt-6 border-t-2 pt-4">
            <div className="flex items-start gap-3">
              <FileText className="text-surface-400 mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Notes
                </p>
                <p className="text-surface-600 font-[family:var(--font-body)] text-sm leading-relaxed">
                  {asset.notes}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-surface-400 text-right text-xs">
        Created{' '}
        {new Date(asset.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        • Updated{' '}
        {new Date(asset.updatedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}
