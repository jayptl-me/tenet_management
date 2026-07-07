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
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !room) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Room not found'}</p>
        </div>
      </div>
    );
  }

  const totalBeds = room.beds?.length ?? 0;
  const occupiedBeds = room.beds?.filter((b) => b.isOccupied).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Room {room.roomNumber}
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {room.floor?.label ?? 'No floor'} · {room.sharingType} Sharing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            variant={statusToVariant(room.isActive ? 'active' : 'inactive')}
            label={room.isActive ? 'Active' : 'Inactive'}
          />
          <Button variant="outline" size="icon" onClick={() => router.push(`/rooms/${id}/edit`)} title="Edit room">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Monthly Rent" value={formatCurrency(room.monthlyRent)} icon={<Banknote className="h-4 w-4" />} variant="default" />
        <StatCard title="Total Beds" value={totalBeds.toString()} icon={<Bed className="h-4 w-4" />} variant="default" />
        <StatCard title="Available" value={availableBeds.toString()} icon={<Users className="h-4 w-4" />} variant={availableBeds > 0 ? 'success' : 'warning'} />
        <StatCard title="Occupancy" value={`${occupancyPct}%`} icon={<Home className="h-4 w-4" />} variant="brand" />
      </motion.div>

      {/* ── Beds Section ───────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
          <Bed className="h-5 w-5 text-[color:var(--color-warning-500)]" />
          Bed Allocations
        </h3>
        {room.beds && room.beds.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {room.beds.map((bed) => (
              <div
                key={bed.bedId}
                className={`rounded-xl border p-4 transition-all duration-[var(--transition-duration)] ${
                  bed.isOccupied
                    ? 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] shadow-[var(--shadow-sm)]'
                    : 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] shadow-[var(--shadow-sm)]'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[color:var(--color-text-primary)]">{bed.bedId}</span>
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      bed.isOccupied
                        ? 'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]'
                        : 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]'
                    }`}
                  >
                    {bed.isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>
                {bed.isOccupied && (
                  <p className="truncate text-xs font-semibold text-[color:var(--color-text-secondary)]">
                    {bed.tenantName ?? 'Occupied'}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-[color:var(--color-text-muted)]">No bed information available</p>
        )}
      </motion.div>

      {/* ── Floor Info ──────────────────────────── */}
      {room.floor && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Building className="h-5 w-5 text-[color:var(--color-brand-500)]" />
            Floor Details
          </h3>
          <div className="flex gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Label</p>
              <p className="text-lg font-bold text-[color:var(--color-text-primary)]">{room.floor.label}</p>
            </div>
            {room.floor.floorNumber != null && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Floor #</p>
                <p className="text-lg font-bold text-[color:var(--color-text-primary)]">{room.floor.floorNumber}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Room Amenities ──────────────────────── */}
      {room.roomAmenities && room.roomAmenities.length > 0 && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Room Amenities Status</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.roomAmenities.map((a) => {
              const colorMap: Record<string, { border: string; bg: string; text: string }> = {
                operational: {
                  border: 'border-[color:var(--color-success-200)]',
                  bg: 'bg-[color:var(--color-success-50)]',
                  text: 'text-[color:var(--color-success-700)]',
                },
                degraded: {
                  border: 'border-[color:var(--color-warning-200)]',
                  bg: 'bg-[color:var(--color-warning-50)]',
                  text: 'text-[color:var(--color-warning-700)]',
                },
                down: {
                  border: 'border-[color:var(--color-danger-200)]',
                  bg: 'bg-[color:var(--color-danger-50)]',
                  text: 'text-[color:var(--color-danger-700)]',
                },
              };
              const colors = colorMap[a.status] ?? colorMap.operational;
              return (
                <div
                  key={a.amenityKey}
                  className={`rounded-xl border p-3 shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] ${colors.border} ${colors.bg}`}
                >
                  <p className={`text-sm font-bold capitalize ${colors.text}`}>
                    {a.amenityKey.replace(/_/g, ' ')}
                  </p>
                  <p className={`mt-0.5 text-xs font-bold uppercase opacity-75 ${colors.text}`}>{a.status}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Description ─────────────────────────── */}
      {room.description && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-warning-600)] mb-1">Notes</p>
          <p className="font-semibold text-[color:var(--color-warning-900)]">{room.description}</p>
        </motion.div>
      )}

      {/* ── Photos ──────────────────────────────── */}
      {room.photos && room.photos.length > 0 && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Photos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.photos.map((photo, index) => (
              <a
                key={index}
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-xl border border-[color:var(--border-color)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)]"
              >
                <img
                  src={photo}
                  alt={`Room ${room.roomNumber} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = 'none';
                    if (t.parentElement) {
                      t.parentElement.classList.add('flex', 'items-center', 'justify-center', 'bg-[color:var(--color-surface-50)]');
                      t.parentElement.innerHTML = '<svg class="h-8 w-8 text-[color:var(--color-text-muted)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    }
                  }}
                />
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}