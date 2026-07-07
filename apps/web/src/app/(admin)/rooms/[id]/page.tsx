'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Home, Building, Users, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';

interface BedDetail {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string;
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
  occupancyCount?: number;
  createdAt: string;
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
      .then((res) => {
        setRoom(res.data);
      })
      .catch(() => {
        setError('Failed to load room details');
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

  if (error || !room) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Room not found'}
        </div>
      </div>
    );
  }

  const statusLabel = room.isActive ? 'Active' : 'Inactive';
  const totalBeds = room.beds?.length ?? 0;
  const occupiedBeds = room.beds?.filter((b) => b.isOccupied).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;

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
              Room {room.roomNumber}
            </h2>
            <p className="text-surface-500 text-sm">Room ID: {room._id}</p>
          </div>
        </div>
        <StatusBadge variant={statusToVariant(statusLabel)} label={statusLabel} />
      </div>

      {/* Room Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Room Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Room Number</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Home className="text-surface-400 h-3.5 w-3.5" />
              {room.roomNumber}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Floor</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Building className="text-surface-400 h-3.5 w-3.5" />
              {room.floor?.label ?? 'N/A'}
              {room.floor?.floorNumber != null && ` (#${room.floor.floorNumber})`}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Sharing Type</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Users className="text-surface-400 h-3.5 w-3.5" />
              {room.sharingType} Sharing
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Monthly Rent</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <CreditCard className="text-surface-400 h-3.5 w-3.5" />₹
              {room.monthlyRent?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Occupancy</p>
            <p className="text-surface-700 text-sm">
              {occupiedBeds}/{totalBeds} beds occupied ({availableBeds} available)
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Created</p>
            <p className="text-surface-700 text-sm">
              {new Date(room.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Beds Table Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Beds</h3>
        {room.beds && room.beds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[color:var(--border-color)]">
                  <th className="text-surface-800 font-display px-3 py-2 text-left text-xs font-semibold">
                    Bed ID
                  </th>
                  <th className="text-surface-800 font-display px-3 py-2 text-left text-xs font-semibold">
                    Status
                  </th>
                  <th className="text-surface-800 font-display px-3 py-2 text-left text-xs font-semibold">
                    Tenant
                  </th>
                </tr>
              </thead>
              <tbody>
                {room.beds.map((bed) => (
                  <tr key={bed.bedId} className="border-[color:var(--color-surface-200)] border-b last:border-b-0">
                    <td className="text-surface-900 px-3 py-2 font-semibold">{bed.bedId}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        variant={statusToVariant(bed.isOccupied ? 'occupied' : 'available')}
                        label={bed.isOccupied ? 'Occupied' : 'Available'}
                      />
                    </td>
                    <td className="text-surface-700 px-3 py-2">
                      {bed.isOccupied ? (bed.tenantName ?? 'Occupied') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No bed information available</p>
        )}
      </div>

      {/* Description Card */}
      {room.description && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Description</h3>
          <p className="text-surface-700 whitespace-pre-wrap text-sm">{room.description}</p>
        </div>
      )}

      {/* Photos Card */}
      {room.photos && room.photos.length > 0 && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Photos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {room.photos.map((photo, index) => (
              <a
                key={index}
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface-100 block aspect-square overflow-hidden rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] ring-[color:var(--color-brand-500)] transition-shadow hover:ring-[length:var(--bw-default)]"
              >
                <img
                  src={photo}
                  alt={`Room ${room.roomNumber} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    target.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                    target.parentElement!.innerHTML =
                      '<span class="text-surface-400"><svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span>';
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
