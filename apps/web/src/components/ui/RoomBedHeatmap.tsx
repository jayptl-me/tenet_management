'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bed, Users, Home, ExternalLink, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';

export interface RoomBedMatrixItem {
  _id: string;
  roomNumber: string;
  floorId?: string;
  floorLabel: string;
  floorNumber: number;
  sharingType: number;
  monthlyRent: number;
  totalBeds: number;
  occupiedBeds: number;
  beds: Array<{
    bedId: string;
    isOccupied: boolean;
    tenantName?: string;
  }>;
}

export interface RoomBedHeatmapProps {
  rooms: RoomBedMatrixItem[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Executive Rooms & Beds Occupancy Heatmap.
 * Gives property managers an instant, high-density physical map of every room
 * and bed in the building with live occupancy status and tenant tooltips.
 */
export function RoomBedHeatmap({ rooms, isLoading, className }: RoomBedHeatmapProps) {
  const router = useRouter();
  const [selectedFloor, setSelectedFloor] = useState<string>('all');

  // ── Overall Aggregated Statistics ─────────────────────
  const stats = useMemo(() => {
    let totalRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;

    for (const r of rooms) {
      totalRooms++;
      totalBeds += r.totalBeds || r.sharingType || 0;
      occupiedBeds += r.occupiedBeds || 0;
    }

    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const fillRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return { totalRooms, totalBeds, occupiedBeds, availableBeds, fillRate };
  }, [rooms]);

  // ── Group Rooms by Floor ──────────────────────────────
  const floorGroups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; floorNumber: number; rooms: RoomBedMatrixItem[] }
    >();

    for (const room of rooms) {
      const floorKey = room.floorId ?? 'unassigned';
      const floorLabel = room.floorLabel || 'Unassigned Floor';
      const floorNumber = room.floorNumber ?? 99;

      if (!map.has(floorKey)) {
        map.set(floorKey, { label: floorLabel, floorNumber, rooms: [] });
      }
      map.get(floorKey)!.rooms.push(room);
    }

    return Array.from(map.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [rooms]);

  // Filtered floors
  const visibleFloors = useMemo(() => {
    if (selectedFloor === 'all') return floorGroups;
    return floorGroups.filter((g) => g.label === selectedFloor);
  }, [floorGroups, selectedFloor]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 w-full animate-pulse rounded-[var(--radius-xl)] bg-[color:var(--color-surface-100)]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-surface-100)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-8 text-center">
        <Home className="mx-auto h-8 w-8 text-[color:var(--color-text-muted)]" />
        <h4 className="mt-2 text-sm font-bold text-[color:var(--color-text-primary)]">
          No rooms configured
        </h4>
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
          Add rooms and assign floors to view the live building occupancy heatmap.
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx('space-y-5', className)}
      role="region"
      aria-label="Rooms and Beds Occupancy Heatmap"
    >
      {/* ── Summary Metrics Bar ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className={clsx(surfaceNestedClass, 'p-3')}>
          <div className="flex items-center gap-1.5 text-[color:var(--color-text-muted)]">
            <Home className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Total Rooms</span>
          </div>
          <p className="font-display mt-1 text-xl font-bold text-[color:var(--color-text-primary)] tabular-nums">
            {stats.totalRooms}
          </p>
        </div>

        <div className={clsx(surfaceNestedClass, 'p-3')}>
          <div className="flex items-center gap-1.5 text-[color:var(--color-text-muted)]">
            <Bed className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Total Capacity</span>
          </div>
          <p className="font-display mt-1 text-xl font-bold text-[color:var(--color-text-primary)] tabular-nums">
            {stats.totalBeds}{' '}
            <span className="text-xs font-normal text-[color:var(--color-text-muted)]">beds</span>
          </p>
        </div>

        <div
          className={clsx(
            surfaceNestedClass,
            'border-l-2 border-l-[color:var(--color-brand-500)] p-3',
          )}
        >
          <div className="flex items-center gap-1.5 text-[color:var(--color-brand-700)]">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Occupied</span>
          </div>
          <p className="font-display mt-1 text-xl font-bold text-[color:var(--color-brand-800)] tabular-nums">
            {stats.occupiedBeds}
          </p>
        </div>

        <div
          className={clsx(
            surfaceNestedClass,
            'border-l-2 border-l-[color:var(--color-success-500)] p-3',
          )}
        >
          <div className="flex items-center gap-1.5 text-[color:var(--color-success-700)]">
            <Bed className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Vacant Beds</span>
          </div>
          <p className="font-display mt-1 text-xl font-bold text-[color:var(--color-success-800)] tabular-nums">
            {stats.availableBeds}
          </p>
        </div>

        <div
          className={clsx(
            surfaceNestedClass,
            'col-span-2 border-l-2 border-l-[color:var(--color-info-500)] p-3 sm:col-span-1',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Fill Rate
            </span>
            <span className="py-0.2 rounded-full bg-[color:var(--color-brand-100)] px-1.5 text-[9px] font-bold text-[color:var(--color-brand-800)]">
              {stats.fillRate}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-brand-500)] transition-all duration-500"
              style={{ width: `${stats.fillRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Floor Filter Strip ──────────────────────────── */}
      {floorGroups.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[color:var(--border-color)]/60 pb-3">
          <span className="mr-1 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-text-muted)]">
            <Filter className="h-3 w-3" />
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setSelectedFloor('all')}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              selectedFloor === 'all'
                ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-xs)]'
                : 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-200)]',
            )}
          >
            All Floors ({rooms.length})
          </button>
          {floorGroups.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setSelectedFloor(g.label)}
              className={clsx(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                selectedFloor === g.label
                  ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-xs)]'
                  : 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-200)]',
              )}
            >
              {g.label} ({g.rooms.length})
            </button>
          ))}
        </div>
      )}

      {/* ── Floor Sections & Room Tiles ─────────────────── */}
      <div className="space-y-6">
        {visibleFloors.map((group) => {
          const floorTotalBeds = group.rooms.reduce((s, r) => s + r.totalBeds, 0);
          const floorOccupied = group.rooms.reduce((s, r) => s + r.occupiedBeds, 0);
          const floorFillRate =
            floorTotalBeds > 0 ? Math.round((floorOccupied / floorTotalBeds) * 100) : 0;

          return (
            <div key={group.label} className="space-y-3">
              {/* Floor Subheader */}
              <div className="flex items-center justify-between border-b border-[color:var(--border-color)]/50 pb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
                    {group.label}
                  </h4>
                  <span className="rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
                    {group.rooms.length} {group.rooms.length === 1 ? 'room' : 'rooms'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-medium text-[color:var(--color-text-secondary)]">
                    {floorOccupied} of {floorTotalBeds} beds occupied ({floorFillRate}%)
                  </span>
                  <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--color-surface-200)] sm:block">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-brand-500)]"
                      style={{ width: `${floorFillRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Room Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {group.rooms.map((room) => {
                  const isFull = room.occupiedBeds >= room.totalBeds;
                  const isVacant = room.occupiedBeds === 0;
                  const availableCount = Math.max(room.totalBeds - room.occupiedBeds, 0);

                  return (
                    <div
                      key={room._id}
                      className={clsx(
                        surfaceCardClass,
                        'group relative flex flex-col justify-between p-3.5 transition-all duration-[var(--transition-duration)]',
                        'hover:border-[color:var(--color-brand-300)] hover:shadow-[var(--shadow-sm)]',
                        isFull && 'border-l-2 border-l-[color:var(--color-brand-500)]',
                        !isFull &&
                          !isVacant &&
                          'border-l-2 border-l-[color:var(--color-warning-500)]',
                        isVacant && 'border-l-2 border-l-[color:var(--color-success-500)]',
                      )}
                    >
                      {/* Room Header */}
                      <div className="flex items-start justify-between gap-1.5">
                        <Link
                          href={`/rooms/${room._id}`}
                          className="font-display inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--color-text-primary)] transition-colors hover:text-[color:var(--color-brand-600)]"
                        >
                          Room {room.roomNumber}
                          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <span
                          className={clsx(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-tight',
                            isFull &&
                              'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]',
                            !isFull &&
                              !isVacant &&
                              'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)]',
                            isVacant &&
                              'bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)]',
                          )}
                        >
                          {isFull ? 'Full' : isVacant ? 'Vacant' : `${availableCount} left`}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[10px] font-medium text-[color:var(--color-text-muted)]">
                        {room.sharingType} Sharing · ₹{room.monthlyRent.toLocaleString('en-IN')}/mo
                      </p>

                      {/* Interactive Bed Pips Matrix */}
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5">
                          {room.beds.map((bed) => (
                            <div
                              key={bed.bedId}
                              title={
                                bed.isOccupied
                                  ? `Bed ${bed.bedId}: Occupied by ${bed.tenantName ?? 'Tenant'}`
                                  : `Bed ${bed.bedId}: Vacant (₹${room.monthlyRent.toLocaleString('en-IN')}/mo)`
                              }
                              className={clsx(
                                'flex h-6 flex-1 items-center justify-center rounded-[var(--radius-sm)] text-[10px] font-bold transition-all',
                                bed.isOccupied
                                  ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-xs)]'
                                  : 'border border-dashed border-[color:var(--color-surface-400)] bg-[color:var(--color-surface-100)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand-400)]',
                              )}
                            >
                              {bed.bedId}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Action Footer */}
                      <div className="mt-2.5 flex items-center justify-between border-t border-[color:var(--border-color)]/50 pt-2 text-[10px] text-[color:var(--color-text-muted)]">
                        <span>
                          {room.occupiedBeds}/{room.totalBeds} filled
                        </span>
                        <button
                          type="button"
                          onClick={() => router.push(`/rooms/${room._id}`)}
                          className="font-semibold text-[color:var(--color-brand-600)] hover:underline"
                        >
                          Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoomBedHeatmap;
