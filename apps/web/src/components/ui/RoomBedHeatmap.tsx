'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { surfaceCardClass } from '@/lib/field-styles';

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

/** Horizontal scroll track row with smooth left/right scroll controls. */
function FloorScrollRow({
  group,
  onRoomClick,
}: {
  group: { label: string; floorNumber: number; rooms: RoomBedMatrixItem[] };
  onRoomClick: (roomId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const floorTotalBeds = group.rooms.reduce((s, r) => s + r.totalBeds, 0);
  const floorOccupied = group.rooms.reduce((s, r) => s + r.occupiedBeds, 0);
  const floorFillRate =
    floorTotalBeds > 0 ? Math.round((floorOccupied / floorTotalBeds) * 100) : 0;

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="space-y-2.5">
      {/* Floor Subheader */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-color)]/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-[13px] font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {group.label}
          </span>
          <span className="rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-text-muted)]">
            {group.rooms.length} {group.rooms.length === 1 ? 'room' : 'rooms'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
            <span className="tabular-nums font-semibold text-[color:var(--color-text-secondary)]">
              {floorOccupied}/{floorTotalBeds}
            </span>{' '}
            beds ({floorFillRate}%)
          </div>

          {/* Scroll Navigation Arrows */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-240)}
              aria-label={`Scroll ${group.label} left`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canScrollRight}
              onClick={() => scrollBy(240)}
              aria-label={`Scroll ${group.label} right`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontally Scrollable Room Cards Track */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {group.rooms.map((room) => {
          const isFull = room.occupiedBeds >= room.totalBeds;
          const isVacant = room.occupiedBeds === 0;
          const availableCount = Math.max(room.totalBeds - room.occupiedBeds, 0);

          return (
            <div
              key={room._id}
              role="button"
              tabIndex={0}
              onClick={() => onRoomClick(room._id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRoomClick(room._id);
                }
              }}
              className={clsx(
                surfaceCardClass,
                'group relative flex w-[220px] flex-shrink-0 flex-col justify-between rounded-[var(--radius-lg)] p-3 text-left transition-all duration-200 snap-start cursor-pointer',
                'hover:border-[color:var(--color-brand-400)] hover:shadow-[var(--shadow-sm)]',
              )}
            >
              {/* Room Title + Occupancy Tag */}
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display text-[13px] font-bold tracking-tight text-[color:var(--color-text-primary)] group-hover:text-[color:var(--color-brand-600)] transition-colors">
                    Room {room.roomNumber}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-tight',
                      isFull &&
                        'border border-[color:var(--badge-neutral-border)] bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-text)]',
                      !isFull &&
                        !isVacant &&
                        'border border-[color:var(--badge-warning-border)] bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-text)]',
                      isVacant &&
                        'border border-[color:var(--badge-success-border)] bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)]',
                    )}
                  >
                    {isFull ? 'Full' : isVacant ? 'Vacant' : `${availableCount} free`}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                  {room.sharingType} Sharing · ₹{room.monthlyRent.toLocaleString('en-IN')}/mo
                </p>
              </div>

              {/* Bed Pips Visualizer */}
              <div className="mt-3">
                <div className="flex items-center gap-1.5">
                  {room.beds.map((bed, idx) => (
                    <div
                      key={`${room._id}-${bed.bedId}-${idx}`}
                      title={
                        bed.isOccupied
                          ? `Bed ${bed.bedId}: Occupied by ${bed.tenantName ?? 'Tenant'}`
                          : `Bed ${bed.bedId}: Vacant (₹${room.monthlyRent.toLocaleString('en-IN')}/mo)`
                      }
                      className={clsx(
                        'flex h-6 flex-1 items-center justify-center rounded-[var(--radius-sm)] text-[10px] font-bold transition-all',
                        bed.isOccupied
                          ? 'bg-[color:var(--color-brand-500)] text-[color:var(--color-on-brand)] shadow-[var(--shadow-xs)]'
                          : 'border border-dashed border-[color:var(--color-surface-400)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)] group-hover:border-[color:var(--border-color-hover)]',
                      )}
                    >
                      {bed.bedId}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer: Simple Bed Count */}
              <div className="mt-2.5 flex items-center justify-between border-t border-[color:var(--border-color)]/60 pt-2 text-[10px] text-[color:var(--color-text-muted)]">
                <span>
                  {room.occupiedBeds} of {room.totalBeds} filled
                </span>
                <span className="font-semibold text-[color:var(--color-brand-600)] opacity-0 group-hover:opacity-100 transition-opacity">
                  View →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Executive Rooms & Beds Occupancy Heatmap (2026 Scalable Edition).
 * Displays floor racks with horizontal scrolling for limitless room capacity scaling,
 * unboxed minimalist metrics, and interactive floor filter tabs.
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
        <div className="h-10 w-full animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-surface-100)]" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 w-[220px] flex-shrink-0 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-surface-100)]"
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
      className={clsx('space-y-4', className)}
      role="region"
      aria-label="Rooms and Beds Occupancy Heatmap"
    >
      {/* ── Sleek Overview & Legend Bar ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-color)]/60 pb-3">
        {/* Floor Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFloor('all')}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              selectedFloor === 'all'
                ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-page-bg)] shadow-[var(--shadow-xs)]'
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
                  ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-page-bg)] shadow-[var(--shadow-xs)]'
                  : 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-200)]',
              )}
            >
              {g.label} ({g.rooms.length})
            </button>
          ))}
        </div>

        {/* Minimalist Capacity Status & Legend */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-[color:var(--color-text-muted)]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-brand-500)]" aria-hidden="true" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-dashed border-[color:var(--color-surface-400)]" aria-hidden="true" />
            <span>Available</span>
          </div>
          <div className="hidden sm:block border-l border-[color:var(--border-color)] pl-3 font-semibold text-[color:var(--color-text-secondary)]">
            <span className="text-[color:var(--color-brand-600)] tabular-nums">{stats.occupiedBeds}</span>
            <span className="text-[color:var(--color-text-muted)] font-normal"> / {stats.totalBeds} beds ({stats.fillRate}%)</span>
          </div>
        </div>
      </div>

      {/* ── Floor Racks (Horizontally Scrollable) ─────────── */}
      <div className="space-y-4">
        {visibleFloors.map((group) => (
          <FloorScrollRow
            key={group.label}
            group={group}
            onRoomClick={(roomId) => router.push(`/rooms/${roomId}`)}
          />
        ))}
      </div>
    </div>
  );
}

export default RoomBedHeatmap;
