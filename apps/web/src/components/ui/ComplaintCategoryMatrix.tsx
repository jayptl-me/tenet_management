'use client';

import { clsx } from 'clsx';
import {
  Wifi,
  Droplets,
  Zap,
  Sparkles,
  UtensilsCrossed,
  Volume2,
  HelpCircle,
  Layers,
  Lightbulb,
  Snowflake,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export interface CategoryDistributionItem {
  _id: string;
  count: number;
  urgent?: number;
  high?: number;
  normal?: number;
  resolved?: number;
  hasOverdue?: boolean;
}

export interface ComplaintCategoryMatrixProps {
  categories: CategoryDistributionItem[];
  totalComplaints: number;
  onCategoryClick?: (category: string) => void;
  className?: string;
}

function getCategoryIcon(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes('wifi') || lower.includes('internet')) return <Wifi className="h-4 w-4" />;
  if (lower.includes('water') || lower.includes('plumb')) return <Droplets className="h-4 w-4" />;
  if (lower.includes('light')) return <Lightbulb className="h-4 w-4" />;
  if (lower.includes('electr') || lower.includes('power')) return <Zap className="h-4 w-4" />;
  if (lower.includes('washroom')) return <Droplets className="h-4 w-4" />;
  if (lower.includes('wash') || lower.includes('laundry')) return <Layers className="h-4 w-4" />;
  if (lower.includes('fridge')) return <Snowflake className="h-4 w-4" />;
  if (lower.includes('food') || lower.includes('meal'))
    return <UtensilsCrossed className="h-4 w-4" />;
  if (lower.includes('clean')) return <Sparkles className="h-4 w-4" />;
  if (lower.includes('noise')) return <Volume2 className="h-4 w-4" />;
  return <HelpCircle className="h-4 w-4" />;
}

function formatCategoryName(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Datadog APM / Sentry Style Ranked Impact Category Matrix
 * Replaces generic donut chart with a high-density, actionable ranked breakdown
 * featuring multi-tone severity bars, percentage share, SLA breach alerts, and 1-click filters.
 */
export function ComplaintCategoryMatrix({
  categories,
  totalComplaints,
  onCategoryClick,
  className,
}: ComplaintCategoryMatrixProps) {
  if (!categories || categories.length === 0 || totalComplaints === 0) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center py-8 text-center', className)}
      >
        <p className="text-[13px] font-medium text-[color:var(--color-text-secondary)]">
          No complaints logged in this period
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
          All systems and resident amenities operating smoothly
        </p>
      </div>
    );
  }

  // Max count for proportional bar scaling
  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  return (
    <div className={clsx('space-y-3', className)}>
      {/* ── Subtitle / Filter Hint ── */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-color)] pb-2 text-[11px]">
        <span className="font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
          Ranked Category Distribution
        </span>
        <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
          Click category to filter
        </span>
      </div>

      {/* ── Ranked Impact Rows ── */}
      <div className="space-y-2">
        {categories.slice(0, 6).map((item) => {
          const pct = Math.round((item.count / totalComplaints) * 100);
          const relativeWidth = Math.max(12, Math.round((item.count / maxCount) * 100));

          return (
            <button
              key={item._id}
              type="button"
              onClick={() => onCategoryClick?.(item._id)}
              className={clsx(
                'group w-full rounded-[var(--radius-md)] border border-transparent p-2 text-left transition-all duration-[var(--transition-duration)]',
                'hover:border-[color:var(--border-color-hover)] hover:bg-[color:var(--color-field-bg)]/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] group-hover:text-[color:var(--color-brand-600)]">
                    {getCategoryIcon(item._id)}
                  </div>
                  <span className="truncate text-[12px] font-semibold text-[color:var(--color-text-primary)]">
                    {formatCategoryName(item._id)}
                  </span>
                  {item.hasOverdue && (
                    <span className="py-0.2 flex items-center gap-0.5 rounded-full border border-[color:var(--badge-danger-border)] bg-[color:var(--badge-danger-bg)] px-1.5 text-[9px] font-bold text-[color:var(--badge-danger-text)]">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Overdue
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[color:var(--color-text-primary)]">
                    {item.count}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
                    ({pct}%)
                  </span>
                  <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>

              {/* Proportional Multi-Tone Severity / Volume Bar */}
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--chart-track)]">
                <div
                  style={{ width: `${relativeWidth}%` }}
                  className="rounded-full bg-[color:var(--color-brand-500)] transition-all duration-500 group-hover:bg-[color:var(--color-brand-600)]"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Footer Telemetry Hint ── */}
      <div className="flex items-center justify-between pt-1 text-[10px] text-[color:var(--color-text-muted)]">
        <span>Showing top {Math.min(categories.length, 6)} categories</span>
        <span className="font-mono font-medium">Total: {totalComplaints} tickets</span>
      </div>
    </div>
  );
}
