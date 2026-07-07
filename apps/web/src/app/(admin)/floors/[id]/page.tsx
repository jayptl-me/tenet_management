'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building, Hash, DoorOpen, Pencil, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';

interface FloorDetail {
  _id: string;
  label: string;
  floorNumber: number;
  description?: string;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
  amenities?: {
    washingMachines?: number;
    fridges?: number;
  };
  createdAt: string;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error || !floor) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-bold text-gray-700 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
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
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-bold text-gray-700 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              {floor.label}
            </h2>
            <p className="text-gray-500 text-sm">Floor ID: {floor._id}</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2.5 font-black text-gray-900 shadow-[4px_4px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all text-sm">
          <Pencil className="h-4 w-4" />
          Edit Floor
        </button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Label</p>
          </div>
          <p className="text-2xl font-black text-gray-900">{floor.label}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Floor Number</p>
          </div>
          <p className="text-2xl font-black text-gray-900">{floor.floorNumber}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 mb-2">
            <DoorOpen className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Rooms</p>
          </div>
          <p className="text-2xl font-black text-gray-900">{floor.totalRooms}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Created</p>
          </div>
          <p className="text-2xl font-black text-gray-900">{formatDate(floor.createdAt)}</p>
        </div>
      </div>

      {/* Service Health Card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 tracking-tight mb-4">Service Health</h3>
        <FloorServiceGrid
          floorId={floor._id}
          floorLabel={floor.label}
          onReportIssue={(serviceType) => {
            router.push(
              `/complaints/new?category=${encodeURIComponent(serviceType)}&floorId=${encodeURIComponent(floor._id)}`,
            );
          }}
        />
      </div>

      {/* Amenities Card */}
      {floor.amenityCounts && floor.amenityCounts.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 tracking-tight mb-4">Amenities</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {floor.amenityCounts.map((ac: { amenityKey: string; count: number }) => {
              const label = ac.amenityKey
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <div
                  key={ac.amenityKey}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border-2 border-gray-300 bg-gray-50 p-4 shadow-[2px_2px_0px_0px_#d1d5db]"
                >
                  <div className="text-2xl font-black text-gray-900">{ac.count}</div>
                  <div>
                    <p className="font-bold text-sm text-gray-800">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description Card */}
      {floor.description && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 tracking-tight mb-4">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap text-sm">{floor.description}</p>
        </div>
      )}
    </div>
  );
}