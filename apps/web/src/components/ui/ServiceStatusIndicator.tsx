'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shirt,
  Sparkles,
  BedSingle,
  ScrollText,
  MoonStar,
  Fan,
  Refrigerator,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AmenityDefinition } from '@pg/types';

// ── Dynamic icon resolution ──
const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  zap: Zap,
  droplets: Droplets,
  thermometer: Thermometer,
  shirt: Shirt,
  sparkles: Sparkles,
  'bed-single': BedSingle,
  'scroll-text': ScrollText,
  'moon-star': MoonStar,
  fan: Fan,
  refrigerator: Refrigerator,
  wrench: Wrench,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Wrench;
}

// ── Theme-token based status colors ──
const STATUS_COLORS: Record<string, { dot: string; bg: string }> = {
  operational: {
    dot: 'bg-[color:var(--color-success-500)]',
    bg: 'bg-[color:var(--color-success-100)]',
  },
  degraded: {
    dot: 'bg-[color:var(--color-warning-500)]',
    bg: 'bg-[color:var(--color-warning-100)]',
  },
  down: {
    dot: 'bg-[color:var(--color-danger-500)]',
    bg: 'bg-[color:var(--color-danger-100)]',
  },
};

// ── Module-level caches (shared across ALL instances) ──
let cachedDefinitions: AmenityDefinition[] | null = null;
let definitionsPromise: Promise<AmenityDefinition[]> | null = null;
const floorServicesCache = new Map<string, ServiceInfo[]>();
const floorServicesPromises = new Map<string, Promise<ServiceInfo[]>>();

function fetchDefinitionsOnce(): Promise<AmenityDefinition[]> {
  if (cachedDefinitions) return Promise.resolve(cachedDefinitions);
  if (definitionsPromise) return definitionsPromise;

  definitionsPromise = api
    .get('app-config')
    .json<{ success: boolean; data: { amenityDefinitions?: AmenityDefinition[] } }>()
    .then((res) => {
      cachedDefinitions = res.data?.amenityDefinitions ?? [];
      return cachedDefinitions;
    })
    .catch(() => {
      cachedDefinitions = [];
      return cachedDefinitions;
    });

  return definitionsPromise;
}

function fetchFloorServicesOnce(floorId: string): Promise<ServiceInfo[]> {
  const cached = floorServicesCache.get(floorId);
  if (cached) return Promise.resolve(cached);

  const pending = floorServicesPromises.get(floorId);
  if (pending) return pending;

  const params = new URLSearchParams({ floorId, limit: '50' });
  const promise = api
    .get(`services?${params}`)
    .json<{ success: boolean; data: ServiceInfo[] }>()
    .then((res) => {
      const data = res.data ?? [];
      floorServicesCache.set(floorId, data);
      return data;
    })
    .catch(() => {
      const data: ServiceInfo[] = [];
      floorServicesCache.set(floorId, data);
      return data;
    })
    .finally(() => {
      floorServicesPromises.delete(floorId);
    });

  floorServicesPromises.set(floorId, promise);
  return promise;
}

// ── Types ──
interface ServiceInfo {
  serviceType: string;
  status: string;
}

interface ServiceStatusIndicatorProps {
  floorId?: string;
  compact?: boolean;
  amenityKeys?: string[]; // Optional: filter to specific amenity keys
  showOnlyStatusLabel?: boolean; // Only show amenities with showAsStatusLabel=true
}

// ── Main Component ──
export function ServiceStatusIndicator({
  floorId,
  compact = false,
  amenityKeys,
  showOnlyStatusLabel = true,
}: ServiceStatusIndicatorProps) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [definitions, setDefinitions] = useState<AmenityDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch amenity definitions (shared cache — only one request across all instances)
  useEffect(() => {
    fetchDefinitionsOnce().then(setDefinitions);
  }, []);

  // Fetch floor services (shared cache per floorId)
  useEffect(() => {
    if (!floorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchFloorServicesOnce(floorId)
      .then(setServices)
      .finally(() => setLoading(false));
  }, [floorId]);

  // Resolve label dynamically
  const getLabel = (serviceType: string): string => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return def.label;
    return serviceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Resolve icon dynamically
  const getIcon = (serviceType: string): LucideIcon => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return resolveIcon(def.icon);
    return Wrench;
  };

  // Filter services based on props
  const displayServices = useMemo(() => {
    let filtered = services;

    // If we have definitions, filter by amenity criteria
    if (definitions.length > 0) {
      if (amenityKeys && amenityKeys.length > 0) {
        // Explicit filter: only show these specific amenity keys
        const keySet = new Set(amenityKeys);
        filtered = filtered.filter((s) => keySet.has(s.serviceType));
      } else if (showOnlyStatusLabel) {
        // Default: only show amenities with showAsStatusLabel=true AND isPerFloor=true
        const statusLabelKeys = new Set(
          definitions
            .filter((d) => d.showAsStatusLabel && d.isPerFloor)
            .map((d) => d.key),
        );
        if (statusLabelKeys.size > 0) {
          filtered = filtered.filter((s) => statusLabelKeys.has(s.serviceType));
        } else {
          // Fallback: if no definitions match, show all (backward compat)
          filtered = filtered.filter((s) => {
            const def = definitions.find((d) => d.key === s.serviceType);
            return def ? def.showAsStatusLabel && def.isPerFloor : true;
          });
        }
      }
    }

    return filtered;
  }, [services, definitions, amenityKeys, showOnlyStatusLabel]);

  // ── Loading ──
  if (loading || !floorId) return null;

  // ── Empty ──
  if (displayServices.length === 0) return null;

  // ── Compact mode: single aggregate badge ──
  if (compact) {
    const allOk = displayServices.every((s) => s.status === 'operational');
    const anyDown = displayServices.some((s) => s.status === 'down');

    return (
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${
          anyDown
            ? 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]'
            : allOk
              ? 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]'
              : 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]'
        }`}
        title={displayServices
          .map((s) => `${getLabel(s.serviceType)}: ${s.status}`)
          .join(', ')}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            anyDown
              ? 'bg-[color:var(--color-danger-500)]'
              : allOk
                ? 'bg-[color:var(--color-success-500)]'
                : 'bg-[color:var(--color-warning-500)]'
          }`}
        />
        {anyDown ? 'Service Issue' : allOk ? 'All OK' : 'Degraded'}
      </div>
    );
  }

  // ── Full mode: individual status chips ──
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {displayServices.map((s) => {
        const colors = STATUS_COLORS[s.status] ?? STATUS_COLORS.operational;
        const Icon = getIcon(s.serviceType);

        return (
          <div
            key={s.serviceType}
            className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] font-semibold leading-none ${colors.bg}`}
            title={`${getLabel(s.serviceType)}: ${s.status}`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            <Icon className="h-3 w-3 text-[color:var(--color-surface-600)]" />
            <span className="hidden sm:inline text-[color:var(--color-surface-700)]">
              {getLabel(s.serviceType)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
