'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  Building,
  Users,
  Banknote,
  Bed,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface BedDetail {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string;
}

interface RoomAmenityStatusDoc {
  amenityKey: string;
  status: string;
}

interface RoomDetail {
  _id: string;
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  photos?: string[];
  beds?: BedDetail[];
  roomAmenities?: RoomAmenityStatusDoc[];
  createdAt: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`rooms/${id}`)
      .json<{ success: boolean; data: RoomDetail }>()
      .then((res) => setRoom(res.data))
      .catch(() => setError('Failed to load room details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-t-brand-600 h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Room not found'}
        </div>
      </div>
    );
  }

  const totalBeds = room.beds?.length ?? 0;
  const occupiedBeds = room.beds?.filter((b) => b.isOccupied).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              Room {room.roomNumber}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {room.floor?.label ?? 'No floor'} • {room.sharingType} Sharing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border-2 px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] ${room.isActive ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-emerald-400' : 'border-red-300 bg-red-50 text-red-600 shadow-red-300'}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${room.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
            {room.isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => router.push(`/rooms/${id}/edit`)}
            className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-gray-600 hover:text-gray-900"
            title="Edit room"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <Banknote className="h-3.5 w-3.5" /> Monthly Rent
          </div>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(room.monthlyRent)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <Bed className="h-3.5 w-3.5" /> Total Beds
          </div>
          <p className="text-2xl font-black text-gray-900">{totalBeds}</p>
        </div>
        <div className={`rounded-[var(--radius-lg)] border-2 p-5 shadow-[4px_4px_0px_0px_currentColor] ${availableBeds > 0 ? 'border-emerald-400 bg-emerald-50 shadow-emerald-400' : 'border-orange-400 bg-orange-50 shadow-orange-400'}`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${availableBeds > 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
            <Users className="h-3.5 w-3.5" /> Available
          </div>
          <p className={`text-2xl font-black ${availableBeds > 0 ? 'text-emerald-800' : 'text-orange-800'}`}>
            {availableBeds}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-blue-400 bg-blue-50 p-5 shadow-[4px_4px_0px_0px_#60a5fa]">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Home className="h-3.5 w-3.5" /> Occupancy
          </div>
          <p className="text-2xl font-black text-blue-800">{occupancyPct}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-blue-200 overflow-hidden border border-blue-300">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Beds Section */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Bed className="h-5 w-5 text-amber-500" />
          Bed Allocations
        </h3>
        {room.beds && room.beds.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {room.beds.map((bed) => (
              <div
                key={bed.bedId}
                className={`rounded-[var(--radius-md)] border-2 p-4 transition-all ${
                  bed.isOccupied
                    ? 'border-gray-300 bg-gray-50 shadow-[2px_2px_0px_0px_#d1d5db]'
                    : 'border-emerald-300 bg-emerald-50 shadow-[2px_2px_0px_0px_#6ee7b7]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-gray-900 text-sm">{bed.bedId}</span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      bed.isOccupied
                        ? 'border-amber-300 bg-amber-100 text-amber-700'
                        : 'border-emerald-300 bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {bed.isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>
                {bed.isOccupied && (
                  <p className="text-gray-600 text-xs font-semibold truncate">
                    {bed.tenantName ?? 'Occupied'}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 font-semibold text-sm">No bed information available</p>
        )}
      </div>

      {/* Floor Info */}
      {room.floor && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-3 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-500" />
            Floor Details
          </h3>
          <div className="flex gap-4">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Label</p>
              <p className="text-gray-900 font-extrabold text-lg">{room.floor.label}</p>
            </div>
            {room.floor.floorNumber != null && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Floor #</p>
                <p className="text-gray-900 font-extrabold text-lg">{room.floor.floorNumber}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Room Amenities */}
      {room.roomAmenities && room.roomAmenities.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">Room Amenities Status</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.roomAmenities.map((a) => {
              const colorMap: Record<string, string> = {
                operational: 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-emerald-300',
                degraded: 'border-amber-300 bg-amber-50 text-amber-700 shadow-amber-300',
                down: 'border-red-300 bg-red-50 text-red-700 shadow-red-300',
              };
              return (
                <div
                  key={a.amenityKey}
                  className={`rounded-[var(--radius-md)] border-2 p-3 shadow-[2px_2px_0px_0px_currentColor] ${colorMap[a.status] ?? colorMap.operational}`}
                >
                  <p className="font-black text-sm capitalize">
                    {a.amenityKey.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs font-bold uppercase mt-0.5 opacity-75">{a.status}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {room.description && (
        <div className="rounded-[var(--radius-lg)] border-2 border-amber-300 bg-amber-50 p-5 shadow-[4px_4px_0px_0px_#fcd34d]">
          <p className="text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">Notes</p>
          <p className="text-amber-900 font-semibold">{room.description}</p>
        </div>
      )}

      {/* Photos */}
      {room.photos && room.photos.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">Photos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.photos.map((photo, index) => (
              <a
                key={index}
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-[var(--radius-md)] border-2 border-gray-300 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <img
                  src={photo}
                  alt={`Room ${room.roomNumber} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = 'none';
                    if (t.parentElement) {
                      t.parentElement.classList.add('flex', 'items-center', 'justify-center', 'bg-gray-100');
                      t.parentElement.innerHTML = '<svg class="h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    }
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
