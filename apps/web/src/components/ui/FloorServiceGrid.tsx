'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shield,
  Shirt,
  Sparkles,
  ArrowUpDown,
  Car,
  Wrench,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface FloorService {
  _id?: string;
  serviceType: string;
  status: string;
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

const serviceIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-4 w-4" />,
  electricity: <Zap className="h-4 w-4" />,
  water_supply: <Droplets className="h-4 w-4" />,
  power: <Zap className="h-4 w-4" />,
  water: <Droplets className="h-4 w-4" />,
  ac: <Thermometer className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  washing_machine_1: <Shirt className="h-4 w-4" />,
  washing_machine_2: <Shirt className="h-4 w-4" />,
  fridge: <Sparkles className="h-4 w-4" />,
  geyser: <Thermometer className="h-4 w-4" />,
  elevator: <ArrowUpDown className="h-4 w-4" />,
  parking: <Car className="h-4 w-4" />,
  cleaning: <Sparkles className="h-4 w-4" />,
  other: <Wrench className="h-4 w-4" />,
  lights: <Zap className="h-4 w-4" />,
};

const serviceLabels: Record<string, string> = {
  wifi: 'WiFi',
  electricity: 'Electricity',
  water_supply: 'Water Supply',
  power: 'Power',
  water: 'Water',
  ac: 'A/C',
  security: 'Security',
  washing_machine_1: 'Washing Machine 1',
  washing_machine_2: 'Washing Machine 2',
  fridge: 'Fridge',
  geyser: 'Geyser',
  elevator: 'Elevator',
  parking: 'Parking',
  cleaning: 'Cleaning',
  lights: 'Lights',
  other: 'Other',
};

const statusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  operational: {
    dot: 'bg-success-500',
    bg: 'bg-success-50 border-success-200',
    text: 'text-success-700',
    label: 'Operational',
  },
  degraded: {
    dot: 'bg-warning-500',
    bg: 'bg-warning-50 border-warning-200',
    text: 'text-warning-700',
    label: 'Degraded',
  },
  down: {
    dot: 'bg-danger-500',
    bg: 'bg-danger-50 border-danger-200',
    text: 'text-danger-700',
    label: 'Down',
  },
};

export function FloorServiceGrid({
  floorId,
  floorLabel,
  compact = false,
  onReportIssue,
}: FloorServiceGridProps) {
  const [services, setServices] = useState<FloorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!floorId) {
      setLoading(false);
      return;
    }

    api
      .get(`services/floor/${floorId}/with-complaints`)
      .json<{ success: boolean; data: { services: FloorService[]; totalRooms: number } }>()
      .then((res) => {
        setServices(res.data.services ?? []);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setLoading(false));
  }, [floorId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
        <div className="border-surface-300 border-t-brand-500 h-3 w-3 animate-spin rounded-full border" />
        Loading services...
      </div>
    );
  }

  if (services.length === 0) return null;

  // Determine overall health
  const anyDown = services.some((s) => s.status === 'down');
  const anyDegraded = services.some((s) => s.status === 'degraded');
  const totalComplaints = services.reduce((sum, s) => sum + (s.openComplaintCount ?? 0), 0);

  if (compact) {
    // Show only the dot row + overall status
    const visibleCount = 6;
    const visibleServices = services.slice(0, visibleCount);
    const hasMore = services.length > visibleCount;

    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleServices.map((svc) => {
            const cfg = statusConfig[svc.status] ?? statusConfig.operational;
            return (
              <div
                key={svc.serviceType}
                className="group relative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                title={`${serviceLabels[svc.serviceType] ?? svc.serviceType}: ${cfg.label}${svc.openComplaintCount ? ` (${svc.openComplaintCount} open complaints)` : ''}`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className="hidden sm:inline">{serviceLabels[svc.serviceType] ?? svc.serviceType}</span>
                {svc.openComplaintCount ? (
                  <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-danger-100 px-1 font-mono text-[8px] font-bold text-danger-600">
                    {svc.openComplaintCount}
                  </span>
                ) : null}
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-surface-400 hover:text-surface-600 inline-flex items-center gap-0.5 text-[10px] font-semibold"
            >
              +{services.length - visibleCount} more <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Expand details */}
        {expanded && (
          <div className="mt-2 space-y-1 rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-2">
            {services.map((svc) => {
              const cfg = statusConfig[svc.status] ?? statusConfig.operational;
              return (
                <div key={svc.serviceType} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="font-semibold">{serviceLabels[svc.serviceType] ?? svc.serviceType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                    {svc.openComplaintCount ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-danger-600">
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
                        className="text-brand-600 hover:bg-brand-50 rounded px-1 py-0.5 text-[9px] font-semibold"
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

  // Full grid mode
  return (
    <div className="space-y-2">
      {floorLabel && (
        <div className="flex items-center gap-2">
          <h4 className="font-display text-sm font-bold">{floorLabel}</h4>
          {anyDown ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-700">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
              Service Issues
            </span>
          ) : anyDegraded ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-semibold text-warning-700">
              <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
              Degraded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-semibold text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
              All OK
            </span>
          )}
          {totalComplaints > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-700">
              <AlertTriangle className="h-3 w-3" />
              {totalComplaints} open
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {services.map((svc) => {
          const cfg = statusConfig[svc.status] ?? statusConfig.operational;
          const Icon = serviceIcons[svc.serviceType] ?? <Wrench className="h-4 w-4" />;

          return (
            <div
              key={svc.serviceType}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 ${cfg.bg} ${cfg.text}`}
            >
              <span className="flex-shrink-0 opacity-70">{Icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span className="truncate text-xs font-semibold">
                    {serviceLabels[svc.serviceType] ?? svc.serviceType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium opacity-80">{cfg.label}</span>
                  {svc.openComplaintCount ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-danger-600">
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
