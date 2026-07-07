'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Hash, Calendar, Wrench, User, FileText } from 'lucide-react';
import { api } from '@/lib/api';

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

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return '₹' + amount.toLocaleString('en-IN');
  } catch {
    return '₹' + String(amount);
  }
}

function assetStatusBadge(status: string) {
  const label = status.replace(/_/g, ' ');

  if (status === 'available' || status === 'active') {
    return (
      <span className="inline-flex rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-700 shadow-[2px_2px_0px_0px_#a7f3d0]">
        {label}
      </span>
    );
  }
  if (status === 'assigned' || status === 'in_use') {
    return (
      <span className="inline-flex rounded-full border-2 border-blue-300 bg-blue-50 px-3 py-0.5 text-xs font-black text-blue-700">
        {label}
      </span>
    );
  }
  if (status === 'maintenance' || status === 'damaged' || status === 'lost') {
    return (
      <span className="inline-flex rounded-full border-2 border-red-400 bg-red-50 px-3 py-0.5 text-xs font-black text-red-700 shadow-[2px_2px_0px_0px_#fca5a5]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border-2 border-gray-300 bg-gray-50 px-3 py-0.5 text-xs font-black text-gray-600">
      {label}
    </span>
  );
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error}
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          Asset not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h2 className="font-black text-2xl text-gray-900 tracking-tight">{asset.name}</h2>
          <p className="text-sm text-gray-500">Asset Details</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Identity Section */}
          <section className="space-y-4">
            <h3 className="border-b-2 border-gray-200 pb-2 font-black text-lg text-gray-900">
              Identification
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Name
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {asset.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Category
                  </p>
                  <p className="text-base font-black capitalize text-gray-900">
                    {asset.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Serial Number
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {asset.serialNumber ?? '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Location
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {asset.location ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Status & Assignment Section */}
          <section className="space-y-4">
            <h3 className="border-b-2 border-gray-200 pb-2 font-black text-lg text-gray-900">
              Status & Assignment
            </h3>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Status
                </p>
                {assetStatusBadge(asset.status)}
              </div>

              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Quantity
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {asset.quantity}
                  </p>
                </div>
              </div>

              {asset.lowStockThreshold != null && (
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Low Stock Threshold
                    </p>
                    <p className="text-base font-black text-gray-900">
                      {asset.lowStockThreshold}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {asset.assignedTo && (
              <div className="mt-3 rounded-md border-2 border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Assigned To
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <p className="text-base font-black text-gray-900">
                      {asset.assignedTo.user?.name ?? 'N/A'}
                    </p>
                  </div>
                  {asset.assignedTo.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="text-sm text-gray-500">
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
        <section className="mt-6 border-t-2 border-gray-200 pt-4">
          <h3 className="mb-3 font-black text-lg text-gray-900">Dates & Service</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-md border-2 border-gray-200 bg-gray-50 p-3">
              <Calendar className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Purchase Date
                </p>
                <p className="text-sm font-black text-gray-900">
                  {formatDate(asset.purchaseDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border-2 border-gray-200 bg-gray-50 p-3">
              <Wrench className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Last Service
                </p>
                <p className="text-sm font-black text-gray-900">
                  {formatDate(asset.lastServiceDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border-2 border-gray-200 bg-gray-50 p-3">
              <Wrench className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Next Service
                </p>
                <p className="text-sm font-black text-gray-900">
                  {formatDate(asset.nextServiceDate)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notes Section */}
        {asset.notes && (
          <section className="mt-6 border-t-2 border-gray-200 pt-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </p>
                <p className="text-sm leading-relaxed text-gray-600">
                  {asset.notes}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-right text-xs text-gray-400">
        Created {formatDateTime(asset.createdAt)} • Updated {formatDateTime(asset.updatedAt)}
      </p>
    </div>
  );
}