'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building, Hash, DoorOpen, WashingMachine, Refrigerator } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';

interface FloorDetail {
  _id: string;
  label: string;
  floorNumber: number;
  description?: string;
  totalRooms: number;
  amenities?: {
    washingMachines?: number;
    fridges?: number;
  };
  createdAt: string;
}

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`floors/${id}`)
      .json<{ success: boolean; data: FloorDetail }>()
      .then((res) => {
        setFloor(res.data);
      })
      .catch(() => {
        setError('Failed to load floor details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !floor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Floor not found'}
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
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              {floor.label}
            </h2>
            <p className="text-surface-500 text-sm">Floor ID: {floor._id}</p>
          </div>
        </div>
      </div>

      {/* Floor Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Floor Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Label</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Building className="text-surface-400 h-3.5 w-3.5" />
              {floor.label}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Floor Number</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Hash className="text-surface-400 h-3.5 w-3.5" />
              {floor.floorNumber}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Total Rooms</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <DoorOpen className="text-surface-400 h-3.5 w-3.5" />
              {floor.totalRooms}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Created</p>
            <p className="text-surface-700 text-sm">
              {new Date(floor.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Service Health Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Service Health</h3>
        <FloorServiceGrid floorId={floor._id} floorLabel={floor.label} />
      </div>

      {/* Amenities Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Amenities</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
            <WashingMachine className="text-brand-600 h-6 w-6" />
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">
                Washing Machines
              </p>
              <p className="text-surface-900 font-display text-2xl font-extrabold">
                {floor.amenities?.washingMachines ?? 0}
              </p>
            </div>
          </div>
          <div className="bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
            <Refrigerator className="text-brand-600 h-6 w-6" />
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Fridges</p>
              <p className="text-surface-900 font-display text-2xl font-extrabold">
                {floor.amenities?.fridges ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description Card */}
      {floor.description && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Description</h3>
          <p className="text-surface-700 whitespace-pre-wrap text-sm">{floor.description}</p>
        </div>
      )}
    </div>
  );
}
