'use client';

import { useState, useEffect } from 'react';
import { BedDouble } from 'lucide-react';
import { api } from '@/lib/api';
import { Select, type SelectOption } from '@/components/ui/Select';

// ── Types ──────────────────────────────────────────────

interface RoomBed {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
}

interface RoomData {
  sharingType?: number;
  beds?: RoomBed[];
}

interface OccupancyBedPickerProps {
  roomId: string | null;
  value: string;
  onChange: (bedId: string) => void;
  currentBedId?: string;
  error?: string;
  label?: string;
}

// Pure data loader (no setState): room occupancy → picker options. Lives at
// module scope so the effect below only updates state in promise continuations.
async function fetchBedOptions(
  roomId: string,
  currentBedId: string | undefined,
): Promise<SelectOption[]> {
  const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomData }>();
  const room = res.data;
  const roomBeds = Array.isArray(room.beds) && room.beds.length > 0 ? room.beds : null;
  const standardCount = Math.max(room.sharingType ?? 0, roomBeds?.length ?? 0, 1);
  const standardSlots = ['A', 'B', 'C', 'D'].slice(0, standardCount);
  const bedIdSet = new Set([...standardSlots, ...(roomBeds?.map((b) => b.bedId) ?? [])]);
  const bedIds = Array.from(bedIdSet).sort();
  // Keep occupied beds visible but disabled so the admin sees occupancy state
  return bedIds.map((bedId) => {
    const bedMeta = roomBeds?.find((b) => b.bedId === bedId);
    const isCurrent = currentBedId != null && bedId === currentBedId;
    const occupiedByOther = !!bedMeta?.isOccupied && !isCurrent;
    return {
      value: bedId,
      label: occupiedByOther ? `Bed ${bedId} (Occupied)` : `Bed ${bedId}`,
      disabled: occupiedByOther,
    };
  });
}

// ── Component ──────────────────────────────────────────

export function OccupancyBedPicker({
  roomId,
  value,
  onChange,
  currentBedId,
  error,
  label = 'Bed',
}: OccupancyBedPickerProps) {
  const loadKey = roomId ? `${roomId}|${currentBedId ?? ''}` : null;
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(() => loadKey !== null);
  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(loadKey);

  // Reset/prime the picker when the room or the resident's current bed
  // changes (render-time adjustment instead of an effect).
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    if (loadKey === null) {
      setOptions([]);
    } else {
      setLoading(true);
    }
  }

  // Fetch-on-room-change (react/set-state-in-effect): state updates live only in
  // promise continuations, never synchronously in the effect. The ignore flag
  // drops stale flights when the room changes mid-fetch (fetch race guard).
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    fetchBedOptions(roomId, currentBedId).then(
      (beds) => {
        if (cancelled) return;
        setOptions(beds);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setOptions([]);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [roomId, currentBedId]);

  // Ensure value is never dropped while the async fetch is in flight
  const displayOptions =
    options.length > 0 ? options : value ? [{ value, label: `Bed ${value}` }] : [];

  return (
    <Select
      label={label}
      options={displayOptions}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      disabled={loading || !roomId}
      leftIcon={<BedDouble className="h-4 w-4" />}
      placeholder={loading ? 'Loading beds...' : roomId ? 'Select bed...' : 'Select a room first'}
    />
  );
}
