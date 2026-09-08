'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bed, Users, Home, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface BedItem {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string;
  tenantName?: string;
}

export interface RoomGridItem {
  _id: string;
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  beds?: BedItem[];
}

interface BedOccupancyGridProps {
  rooms: RoomGridItem[];
  isLoading?: boolean;
}

export function BedOccupancyGrid({ rooms, isLoading }: BedOccupancyGridProps) {
  const router = useRouter();

  // ── Aggregated Stats ───────────────────────────────────
  const stats = useMemo(() => {
    let totalRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;

    for (const room of rooms) {
      if (!room.isActive) continue;
      totalRooms++;
      const roomBeds = room.beds ?? [];
      totalBeds += roomBeds.length || room.sharingType || 0;
      occupiedBeds += roomBeds.filter((b) => b.isOccupied).length;
    }

    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return { totalRooms, totalBeds, occupiedBeds, availableBeds, occupancyRate };
  }, [rooms]);

  // ── Group Rooms by Floor ──────────────────────────────
  const floorGroups = useMemo(() => {
    const map = new Map<string, { label: string; floorNumber: number; rooms: RoomGridItem[] }>();

    for (const room of rooms) {
      const floorKey = room.floor?._id ?? 'unassigned';
      const floorLabel = room.floor?.label ?? 'Unassigned Floor';
      const floorNumber = room.floor?.floorNumber ?? 999;

      if (!map.has(floorKey)) {
        map.set(floorKey, { label: floorLabel, floorNumber, rooms: [] });
      }
      map.get(floorKey)!.rooms.push(room);
    }

    // Sort floors by floorNumber ascending
    return Array.from(map.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [rooms]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-8 text-center">
        <Home className="mx-auto h-8 w-8 text-[color:var(--color-text-muted)]" />
        <h3 className="font-display mt-2 text-sm font-bold text-[color:var(--color-text-primary)]">
          No rooms match filters
        </h3>
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
          Adjust the search criteria or add new rooms to view bed occupancy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" role="region" aria-label="Bed Occupancy Matrix">
      {/* ── Summary Counters ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
            <Home className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">Rooms</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-text-primary)]">
            {stats.totalRooms}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
            <Bed className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">Total Beds</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-text-primary)]">
            {stats.totalBeds}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 text-[color:var(--color-warning-700)]">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">Occupied</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-warning-800)]">
            {stats.occupiedBeds}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[color:var(--color-success-700)]">
              <Users className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-wider uppercase">Available</span>
            </div>
            <span className="rounded-full bg-[color:var(--color-success-200)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--color-success-800)]">
              {stats.occupancyRate}% full
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-success-800)]">
            {stats.availableBeds}
          </p>
        </div>
      </div>

      {/* ── Floor Groupings ───────────────────────────────── */}
      <div className="space-y-6">
        {floorGroups.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className="flex items-center justify-between border-b border-[color:var(--border-color)] pb-2">
              <h3 className="font-display text-base font-bold text-[color:var(--color-text-primary)]">
                {group.label}
              </h3>
              <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                {group.rooms.length} {group.rooms.length === 1 ? 'room' : 'rooms'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.rooms.map((room) => {
                const roomBeds = room.beds ?? [];
                const availableBedList = roomBeds.filter((b) => !b.isOccupied);
                const firstAvailableBed = availableBedList[0]?.bedId;

                return (
                  <div
                    key={room._id}
                    className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-400)]"
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            href={`/rooms/${room._id}`}
                            className="group font-display inline-flex items-center gap-1 text-base font-bold text-[color:var(--color-text-primary)] hover:text-[color:var(--color-brand-600)]"
                          >
                            Room {room.roomNumber}
                            <ExternalLink className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                          <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                            {room.sharingType} Sharing · ₹{room.monthlyRent.toLocaleString()}/mo
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            availableBedList.length > 0
                              ? 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]'
                              : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]'
                          }`}
                        >
                          {availableBedList.length > 0 ? `${availableBedList.length} free` : 'Full'}
                        </span>
                      </div>

                      {/* Bed Slots Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {roomBeds.map((bed) => {
                          if (!bed.isOccupied) {
                            return (
                              <button
                                key={bed.bedId}
                                type="button"
                                onClick={() =>
                                  router.push(`/tenants/new?roomId=${room._id}&bedId=${bed.bedId}`)
                                }
                                className="group/bed flex flex-col justify-between rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)]/30 p-2.5 text-left transition-all duration-[var(--transition-duration)] hover:border-solid hover:border-[color:var(--color-brand-400)] hover:bg-[color:var(--color-brand-50)]/50 hover:shadow-[var(--shadow-sm)]"
                                title={`Click to assign Bed ${bed.bedId} to a new tenant`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)] group-hover/bed:text-[color:var(--color-brand-700)]">
                                    Bed {bed.bedId}
                                  </span>
                                  <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-success-500)] group-hover/bed:bg-[color:var(--color-brand-500)]" />
                                </div>

                                <div className="mt-2 flex items-center justify-between truncate text-[11px] font-semibold text-[color:var(--color-success-700)] group-hover/bed:text-[color:var(--color-brand-700)]">
                                  <span>Available</span>
                                  <span className="text-[10px] font-bold opacity-0 transition-opacity group-hover/bed:opacity-100">
                                    Assign +
                                  </span>
                                </div>
                              </button>
                            );
                          }

                          return (
                            <div
                              key={bed.bedId}
                              className="flex flex-col justify-between rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-2.5 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)]">
                                  Bed {bed.bedId}
                                </span>
                                <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-warning-500)]" />
                              </div>

                              <div className="mt-2 truncate text-[11px] font-semibold">
                                {bed.tenantId ? (
                                  <Link
                                    href={`/tenants/${bed.tenantId}`}
                                    className="truncate text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                                    title={bed.tenantName ?? 'Occupied tenant'}
                                  >
                                    {bed.tenantName ?? 'Occupied'}
                                  </Link>
                                ) : (
                                  <span className="text-[color:var(--color-warning-700)]">
                                    {bed.tenantName ?? 'Occupied'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Room Quick Action */}
                    <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border-color)] pt-3 text-xs">
                      <button
                        type="button"
                        onClick={() => router.push(`/rooms/${room._id}`)}
                        className="font-semibold text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
                      >
                        Details
                      </button>

                      {firstAvailableBed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/tenants/new?roomId=${room._id}&bedId=${firstAvailableBed}`,
                            )
                          }
                          className="h-7 px-2 text-xs font-bold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)]"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Assign
                        </Button>
                      ) : (
                        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                          Occupied
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
