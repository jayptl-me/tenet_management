'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  ChevronDown,
  AlertTriangle,
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shield,
  Shirt,
  Sparkles,
  ArrowUpDown,
  Car,
  BedSingle,
  ScrollText,
  MoonStar,
  Fan,
  Refrigerator,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AmenityDefinition } from '@pg/types';

// ── Dynamic icon resolution: lucide name (kebab-case) → component ──
const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  zap: Zap,
  droplets: Droplets,
  thermometer: Thermometer,
  shield: Shield,
  shirt: Shirt,
  sparkles: Sparkles,
  'arrow-up-down': ArrowUpDown,
  car: Car,
  wrench: Wrench,
  'bed-single': BedSingle,
  'scroll-text': ScrollText,
  'moon-star': MoonStar,
  fan: Fan,
  refrigerator: Refrigerator,
  'chevron-down': ChevronDown,
  'alert-triangle': AlertTriangle,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Wrench;
}

// ── Status styling (theme-token based, static) ──
const STATUS_CONFIG = {
  operational: {
    dot: 'bg-[color:var(--color-success-500)]',
    bg: 'bg-[color:var(--color-success-50)] border-[color:var(--color-success-200)]',
    text: 'text-[color:var(--color-success-700)]',
    label: 'Operational',
  },
  degraded: {
    dot: 'bg-[color:var(--color-warning-500)]',
    bg: 'bg-[color:var(--color-warning-50)] border-[color:var(--color-warning-200)]',
    text: 'text-[color:var(--color-warning-700)]',
    label: 'Degraded',
  },
  down: {
    dot: 'bg-[color:var(--color-danger-500)]',
    bg: 'bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-200)]',
    text: 'text-[color:var(--color-danger-700)]',
    label: 'Down',
  },
} as const;

// ── Types ──
interface FloorService {
  _id?: string;
  serviceType: string;
  status: keyof typeof STATUS_CONFIG;
  note?: string;
  openComplaintCount?: number;
  lastUpdatedAt?: string;
  floor?: { label: string };
}

interface FloorServiceGridProps {
  floorId: string;
  floorLabel?: string;
  compact?: boolean;
  onReportIssue?: (serviceType: string) => void;
}

// ── Main Component ──
export function FloorServiceGrid({
  floorId,
  floorLabel,
  compact = false,
  onReportIssue,
}: FloorServiceGridProps) {
  const [services, setServices] = useState<FloorService[]>([]);
  const [definitions, setDefinitions] = useState<AmenityDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Fetch amenity definitions once (for label/icon resolution)
  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: { amenityDefinitions?: AmenityDefinition[] } }>()
      .then((res) => {
        setDefinitions(res.data?.amenityDefinitions ?? []);
      })
      .catch(() => {
        // Silently fail — use fallback labels from serviceType
      });
  }, []);

  // Fetch floor services
  useEffect(() => {
    if (!floorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    api
      .get(`services/floor/${floorId}/with-complaints`)
      .json<{ success: boolean; data: { services: FloorService[]; totalRooms: number } }>()
      .then((res) => {
        setServices(res.data.services ?? []);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load services');
      })
      .finally(() => setLoading(false));
  }, [floorId]);

  // Resolve label dynamically from definitions or fall back to formatted serviceType
  const resolveLabel = (serviceType: string): string => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return def.label;
    // Fallback: format snake_case → Title Case
    return serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Resolve icon dynamically
  const getIcon = (serviceType: string): LucideIcon => {
    const def = definitions.find((d) => d.key === serviceType);
    if (def) return resolveIcon(def.icon);
    return Wrench;
  };

  // Filter to only per-floor amenities (if definitions loaded)
  const perFloorServices = useMemo(() => {
    if (definitions.length === 0) return services; // Can't filter, show all
    const perFloorKeys = new Set(definitions.filter((d) => d.isPerFloor).map((d) => d.key));
    return services.filter((s) => perFloorKeys.has(s.serviceType));
  }, [services, definitions]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[color:var(--color-surface-400)]">
        <div className="h-3 w-3 animate-spin rounded-full border-[length:var(--bw-default)] border-[color:var(--color-surface-300)] border-t-[color:var(--color-brand-500)]" />
        Loading services...
      </div>
    );
  }

  // ── Error State ──
  if (error && services.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-danger-600)]">
        <AlertTriangle className="h-3 w-3" />
        {error}
      </div>
    );
  }

  // ── Empty State ──
  if (perFloorServices.length === 0) return null;

  // ── Compute aggregates ──
  const anyDown = perFloorServices.some((s) => s.status === 'down');
  const anyDegraded = perFloorServices.some((s) => s.status === 'degraded');
  const totalComplaints = perFloorServices.reduce((sum, s) => sum + (s.openComplaintCount ?? 0), 0);

  // ── Compact Mode ──
  if (compact) {
    const visibleCount = 6;
    const visibleServices = perFloorServices.slice(0, visibleCount);
    const hasMore = perFloorServices.length > visibleCount;

    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleServices.map((svc) => {
            const cfg = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.operational;
            const Icon = getIcon(svc.serviceType);
            return (
              <div
                key={svc.serviceType}
                className="group relative inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[color:var(--color-text-secondary)]"
                title={`${resolveLabel(svc.serviceType)}: ${cfg.label}${svc.openComplaintCount ? ` (${svc.openComplaintCount} open complaints)` : ''}`}
              >
                <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                <Icon className="hidden h-3 w-3 text-[color:var(--color-text-muted)] sm:inline" />
                <span className="hidden sm:inline">{resolveLabel(svc.serviceType)}</span>
                {svc.openComplaintCount ? (
                  <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[color:var(--color-danger-100)] px-1 font-mono text-[8px] font-bold text-[color:var(--color-danger-600)]">
                    {svc.openComplaintCount}
                  </span>
                ) : null}
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)] transition-colors duration-[var(--transition-duration)] hover:text-[color:var(--color-text-secondary)]"
            >
              +{perFloorServices.length - visibleCount} more <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 space-y-1 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-2">
            {perFloorServices.map((svc) => {
              const cfg = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.operational;
              const Icon = getIcon(svc.serviceType);
              return (
                <div
                  key={svc.serviceType}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
                    />
                    <Icon className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                    <span className="font-semibold text-[color:var(--color-text-primary)]">
                      {resolveLabel(svc.serviceType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                    {svc.openComplaintCount ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-danger-100)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[color:var(--color-danger-600)]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {svc.openComplaintCount}
                      </span>
                    ) : null}
                    {onReportIssue && svc.status !== 'operational' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReportIssue(svc.serviceType);
                        }}
                        className="rounded px-1 py-0.5 text-[9px] font-semibold text-[color:var(--color-brand-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-50)]"
                      >
                        Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Full Grid Mode ──
  return (
    <div className="space-y-2">
      {/* Header with health summary */}
      {floorLabel && (
        <div className="flex items-center gap-2">
          <h4 className="font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-primary)]">
            {floorLabel}
          </h4>
          {anyDown ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-danger-700)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-danger-500)]" />
              Service Issues
            </span>
          ) : anyDegraded ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-warning-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-warning-700)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-warning-500)]" />
              Degraded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-success-700)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success-500)]" />
              All OK
            </span>
          )}
          {totalComplaints > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-danger-700)]">
              <AlertTriangle className="h-3 w-3" />
              {totalComplaints} open
            </span>
          )}
        </div>
      )}

      {/* Service cards grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {perFloorServices.map((svc) => {
          const cfg = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.operational;
          const Icon = getIcon(svc.serviceType);

          return (
            <div
              key={svc.serviceType}
              className={`flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-3 py-2 ${cfg.bg}`}
            >
              <span className="flex-shrink-0 opacity-70">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                  <span className={`truncate text-xs font-semibold ${cfg.text}`}>
                    {resolveLabel(svc.serviceType)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium opacity-80 ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  {svc.openComplaintCount ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-danger-100)] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[color:var(--color-danger-600)]">
                      {svc.openComplaintCount} open
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
