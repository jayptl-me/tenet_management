'use client';

import { useState, useEffect, useCallback } from 'react';
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

// ── Component ──────────────────────────────────────────

export function OccupancyBedPicker({
  roomId,
  value,
  onChange,
  currentBedId,
  error,
  label = 'Bed',
}: OccupancyBedPickerProps) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBeds = useCallback(async () => {
    if (!roomId) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomData }>();
      const room = res.data;
      const roomBeds = Array.isArray(room.beds) && room.beds.length > 0 ? room.beds : null;
      const bedIds =
        roomBeds != null
          ? roomBeds.map((b) => b.bedId)
          : ['A', 'B', 'C', 'D'].slice(0, room.sharingType ?? 4);
      const beds = bedIds.map((bedId) => {
        const bedMeta = roomBeds?.find((b) => b.bedId === bedId);
        const isCurrent = currentBedId != null && bedId === currentBedId;
        const occupiedByOther = !!bedMeta?.isOccupied && !isCurrent;
        return {
          value: bedId,
          label: occupiedByOther ? `Bed ${bedId} (Occupied)` : `Bed ${bedId}`,
          disabled: occupiedByOther,
        };
      });
      // Keep occupied beds visible but disabled so the admin sees occupancy state
      setOptions(beds);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, currentBedId]);

  useEffect(() => {
    void loadBeds();
  }, [loadBeds]);

  // Ensure value is never dropped while async loadBeds is in flight
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
