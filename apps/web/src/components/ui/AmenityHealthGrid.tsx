'use client';

import { clsx } from 'clsx';
import {
  Wifi,
  Droplets,
  Zap,
  Layers,
  UtensilsCrossed,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { surfaceNestedClass } from '@/lib/field-styles';

export interface AmenityHealthData {
  operational: number;
  degraded: number;
  down: number;
  total: number;
}

export interface AmenityHealthGridProps {
  amenities: Record<string, AmenityHealthData>;
  onManageClick?: () => void;
  className?: string;
}

function getAmenityIcon(key: string) {
  const lower = key.toLowerCase();
  if (lower.includes('wifi')) return <Wifi className="h-4 w-4" />;
  if (lower.includes('water')) return <Droplets className="h-4 w-4" />;
  if (lower.includes('power') || lower.includes('electr')) return <Zap className="h-4 w-4" />;
  if (lower.includes('wash') || lower.includes('laundry')) return <Layers className="h-4 w-4" />;
  if (lower.includes('food') || lower.includes('meal'))
    return <UtensilsCrossed className="h-4 w-4" />;
  if (lower.includes('clean')) return <Sparkles className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

function formatAmenityTitle(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Modern Amenity Telemetry Grid — Linear & Datadog service status pattern.
 * Replaces technical stacked bar charts with high-density operational telemetry cards.
 */
export function AmenityHealthGrid({ amenities, onManageClick, className }: AmenityHealthGridProps) {
  const entries = Object.entries(amenities);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <Wifi className="mb-2 h-10 w-10 text-[color:var(--color-text-muted)]" />
        <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
          No amenities configured
        </p>
        <p className="mt-1 max-w-xs text-[11px] font-medium text-[color:var(--color-text-muted)]">
          Service monitoring will appear once floor amenities are configured.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {entries.map(([key, data]) => {
        const total = data.total || data.operational + data.degraded + data.down || 1;
        const uptimePct = Math.round((data.operational / total) * 100);
        const hasOutage = data.down > 0;
        const hasDegraded = data.degraded > 0;

        const statusTone = hasOutage ? 'danger' : hasDegraded ? 'warning' : 'success';

        return (
          <div
            key={key}
            onClick={onManageClick}
            className={clsx(
              surfaceNestedClass,
              'group relative flex flex-col justify-between p-3.5 transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-brand-300)] hover:shadow-[var(--shadow-xs)]',
              onManageClick && 'cursor-pointer',
            )}
          >
            {/* Header: Icon + Title + Status Pill */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border',
                    statusTone === 'success' &&
                      'border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)]',
                    statusTone === 'warning' &&
                      'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)]',
                    statusTone === 'danger' &&
                      'border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)]',
                  )}
                >
                  {getAmenityIcon(key)}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[color:var(--color-text-primary)]">
                    {formatAmenityTitle(key)}
                  </p>
                  <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                    {total} checks across floors
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-tight',
                  statusTone === 'success' &&
                    'border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)]',
                  statusTone === 'warning' &&
                    'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)]',
                  statusTone === 'danger' &&
                    'border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)]',
                )}
              >
                {statusTone === 'success' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {statusTone === 'warning' && <AlertTriangle className="h-2.5 w-2.5" />}
                {statusTone === 'danger' && <XCircle className="h-2.5 w-2.5" />}
                {hasOutage
                  ? `${data.down} Down`
                  : hasDegraded
                    ? `${data.degraded} Degraded`
                    : '100% Up'}
              </span>
            </div>

            {/* Health Meter */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-medium">
                <span className="text-[color:var(--color-text-muted)]">Health index</span>
                <span className="font-mono font-bold text-[color:var(--color-text-primary)] tabular-nums">
                  {uptimePct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    statusTone === 'success' && 'bg-[color:var(--color-success-500)]',
                    statusTone === 'warning' && 'bg-[color:var(--color-warning-500)]',
                    statusTone === 'danger' && 'bg-[color:var(--color-danger-500)]',
                  )}
                  style={{ width: `${uptimePct}%` }}
                />
              </div>
            </div>

            {/* Footer Breakdown Chips */}
            <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border-color)]/50 pt-2 text-[10px]">
              <div className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success-500)]" />
                <span>{data.operational} operational</span>
                {data.degraded > 0 && (
                  <>
                    <span className="text-[color:var(--color-text-muted)]">·</span>
                    <span className="font-semibold text-[color:var(--color-warning-700)]">
                      {data.degraded} degraded
                    </span>
                  </>
                )}
                {data.down > 0 && (
                  <>
                    <span className="text-[color:var(--color-text-muted)]">·</span>
                    <span className="font-semibold text-[color:var(--color-danger-700)]">
                      {data.down} down
                    </span>
                  </>
                )}
              </div>

              {onManageClick && (
                <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AmenityHealthGrid;
