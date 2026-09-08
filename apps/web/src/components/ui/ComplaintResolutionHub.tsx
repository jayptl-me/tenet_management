'use client';

import { clsx } from 'clsx';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ArrowRight,
  ShieldAlert,
  Wifi,
  Droplets,
  Zap,
  Layers,
  UtensilsCrossed,
  Sparkles,
  Volume2,
  HelpCircle,
} from 'lucide-react';
import type { IComplaintSlaMetrics } from '@pg/types';
import { surfaceNestedClass } from '@/lib/field-styles';
import { chartTokens } from '@/lib/chart-theme';

export interface ComplaintStatusCounts {
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
}

export interface ComplaintResolutionHubProps {
  complaints: ComplaintStatusCounts;
  totalComplaints: number;
  resolvedRate: number;
  slaMetrics?: IComplaintSlaMetrics;
  categories?: Array<{ _id: string; count: number }>;
  onStatusClick?: (status: string) => void;
  onAgingClick?: (tier: 'under24h' | 'between24And48h' | 'over48h') => void;
  onManageClick?: () => void;
  className?: string;
}

function getCategoryIcon(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes('wifi') || lower.includes('internet')) return <Wifi className="h-3.5 w-3.5" />;
  if (lower.includes('water') || lower.includes('washroom') || lower.includes('plumb')) {
    return <Droplets className="h-3.5 w-3.5" />;
  }
  if (lower.includes('electr') || lower.includes('light') || lower.includes('power')) {
    return <Zap className="h-3.5 w-3.5" />;
  }
  if (lower.includes('wash') || lower.includes('laundry'))
    return <Layers className="h-3.5 w-3.5" />;
  if (lower.includes('food') || lower.includes('meal'))
    return <UtensilsCrossed className="h-3.5 w-3.5" />;
  if (lower.includes('clean')) return <Sparkles className="h-3.5 w-3.5" />;
  if (lower.includes('noise')) return <Volume2 className="h-3.5 w-3.5" />;
  return <HelpCircle className="h-3.5 w-3.5" />;
}

function formatCategoryLabel(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Modern Linear Triage & SLA Incident Command Matrix
 * Replaces legacy semi-circular gauges with actionable ticket pipeline,
 * SLA aging telemetry (<24h, 24-48h, >48h), MTTR indicators, and priority distribution.
 */
export function ComplaintResolutionHub({
  complaints,
  totalComplaints,
  resolvedRate,
  slaMetrics,
  categories = [],
  onStatusClick,
  onAgingClick,
  onManageClick,
  className,
}: ComplaintResolutionHubProps) {
  const activeCount = complaints.open + complaints.inProgress;

  const aging = slaMetrics?.aging ?? { under24h: 0, between24And48h: 0, over48h: 0 };
  const priority = slaMetrics?.priority ?? { urgent: 0, high: 0, medium: 0, low: 0 };
  const avgResolutionHours = slaMetrics?.avgResolutionHours ?? null;
  const slaComplianceRate = slaMetrics?.slaComplianceRate ?? 100;

  const totalPriorityCount = priority.urgent + priority.high + priority.medium + priority.low || 1;

  return (
    <div className={clsx('space-y-4', className)}>
      {/* ── Metric Bar: Resolution Rate & MTTR / SLA ────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/60 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center">
            {/* Mini Circular Ring */}
            <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[color:var(--chart-track)]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${totalComplaints > 0 ? resolvedRate : 0}, 100`}
                strokeLinecap="round"
                stroke={
                  resolvedRate >= 70
                    ? chartTokens.success
                    : resolvedRate >= 40
                      ? chartTokens.warning
                      : chartTokens.danger
                }
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-bold text-[color:var(--color-text-primary)]">
              {resolvedRate}%
            </span>
          </div>
          <div>
            <p className="text-[12px] font-bold text-[color:var(--color-text-primary)]">
              {complaints.resolved} of {totalComplaints} Resolved
            </p>
            <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              {activeCount} active tickets awaiting closure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {avgResolutionHours != null && (
            <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2.5 py-1 text-[11px]">
              <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-secondary)]" />
              <span className="font-medium text-[color:var(--color-text-secondary)]">
                Avg MTTR:
              </span>
              <span className="font-mono font-bold text-[color:var(--color-text-primary)]">
                {avgResolutionHours}h
              </span>
            </div>
          )}

          <div
            className={clsx(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              slaComplianceRate >= 80
                ? 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)]'
                : 'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)]',
            )}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>SLA: {slaComplianceRate}% in &lt;48h</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Ticket Pipeline Strip ───────────────── */}
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
          Ticket Lifecycle Pipeline
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Open */}
          <button
            type="button"
            onClick={() => onStatusClick?.('open')}
            className={clsx(
              surfaceNestedClass,
              'group relative flex flex-col items-start p-3 text-left transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-danger-300)] hover:bg-[color:var(--color-danger-50)]/40 hover:shadow-[var(--shadow-sm)]',
              complaints.open > 0 && 'border-l-2 border-l-[color:var(--color-danger-500)]',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
                <span
                  className={clsx(
                    'h-2 w-2 rounded-full bg-[color:var(--color-danger-500)]',
                    complaints.open > 0 && 'animate-pulse',
                  )}
                />
                Open
              </span>
              <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-[color:var(--color-danger-600)] tabular-nums">
              {complaints.open}
            </p>
            <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
              Needs triage
            </span>
          </button>

          {/* In Progress */}
          <button
            type="button"
            onClick={() => onStatusClick?.('in_progress')}
            className={clsx(
              surfaceNestedClass,
              'group relative flex flex-col items-start p-3 text-left transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-warning-300)] hover:bg-[color:var(--color-warning-50)]/40 hover:shadow-[var(--shadow-sm)]',
              complaints.inProgress > 0 && 'border-l-2 border-l-[color:var(--color-warning-500)]',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning-500)]" />
                In Progress
              </span>
              <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-[color:var(--color-warning-600)] tabular-nums">
              {complaints.inProgress}
            </p>
            <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
              Under repair
            </span>
          </button>

          {/* Resolved */}
          <button
            type="button"
            onClick={() => onStatusClick?.('resolved')}
            className={clsx(
              surfaceNestedClass,
              'group relative flex flex-col items-start p-3 text-left transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-success-300)] hover:bg-[color:var(--color-success-50)]/40 hover:shadow-[var(--shadow-sm)]',
              complaints.resolved > 0 && 'border-l-2 border-l-[color:var(--color-success-500)]',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-500)]" />
                Resolved
              </span>
              <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-[color:var(--color-success-600)] tabular-nums">
              {complaints.resolved}
            </p>
            <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
              Closed tickets
            </span>
          </button>

          {/* Dismissed */}
          <button
            type="button"
            onClick={() => onStatusClick?.('dismissed')}
            className={clsx(
              surfaceNestedClass,
              'group relative flex flex-col items-start p-3 text-left transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--border-color)] hover:shadow-[var(--shadow-sm)]',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-text-muted)]" />
                Dismissed
              </span>
              <ArrowRight className="h-3 w-3 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-[color:var(--color-text-secondary)] tabular-nums">
              {complaints.dismissed}
            </p>
            <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
              Rejected / invalid
            </span>
          </button>
        </div>
      </div>

      {/* ── SLA Aging Urgency Matrix ────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            Active Ticket SLA Aging
          </p>
          <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
            Based on creation timestamp
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {/* < 24h Normal */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onAgingClick?.('under24h')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onAgingClick?.('under24h');
            }}
            className={clsx(
              surfaceNestedClass,
              'group cursor-pointer p-3 transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-success-200)] hover:shadow-[var(--shadow-sm)]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-success-700)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success-500)]" />
                <span>&lt; 24h</span>
              </div>
              <span className="rounded-full bg-[color:var(--color-success-50)] px-2 py-0.5 font-mono text-[11px] font-bold text-[color:var(--color-success-700)]">
                {aging.under24h}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              Within optimal SLA window
            </p>
          </div>

          {/* 24-48h Aging */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onAgingClick?.('between24And48h')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onAgingClick?.('between24And48h');
            }}
            className={clsx(
              surfaceNestedClass,
              'group cursor-pointer p-3 transition-all duration-[var(--transition-duration)]',
              aging.between24And48h > 0
                ? 'border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)]/30'
                : 'hover:border-[color:var(--border-color)]',
              'hover:shadow-[var(--shadow-sm)]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-warning-700)]">
                <Clock className="h-3.5 w-3.5 text-[color:var(--color-warning-500)]" />
                <span>24 - 48h</span>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                  aging.between24And48h > 0
                    ? 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)]'
                    : 'bg-[color:var(--chart-track)] text-[color:var(--color-text-muted)]',
                )}
              >
                {aging.between24And48h}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              At risk of SLA breach
            </p>
          </div>

          {/* > 48h Overdue */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onAgingClick?.('over48h')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onAgingClick?.('over48h');
            }}
            className={clsx(
              surfaceNestedClass,
              'group cursor-pointer p-3 transition-all duration-[var(--transition-duration)]',
              aging.over48h > 0
                ? 'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)]/40'
                : 'hover:border-[color:var(--border-color)]',
              'hover:shadow-[var(--shadow-sm)]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-danger-700)]">
                <AlertTriangle
                  className={clsx(
                    'h-3.5 w-3.5 text-[color:var(--color-danger-500)]',
                    aging.over48h > 0 && 'animate-pulse',
                  )}
                />
                <span>&gt; 48h Overdue</span>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                  aging.over48h > 0
                    ? 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)]'
                    : 'bg-[color:var(--chart-track)] text-[color:var(--color-text-muted)]',
                )}
              >
                {aging.over48h}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              SLA Breached · Immediate action
            </p>
          </div>
        </div>
      </div>

      {/* ── Priority Distribution Bar ──────────────────────── */}
      {activeCount > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Active Priority Distribution
            </span>
            <div className="flex items-center gap-3 font-mono text-[10px] font-bold">
              {priority.urgent > 0 && (
                <span className="flex items-center gap-1 text-[color:var(--color-danger-600)]">
                  <Flame className="h-3 w-3" />
                  {priority.urgent} Urgent
                </span>
              )}
              {priority.high > 0 && (
                <span className="text-[color:var(--color-warning-600)]">{priority.high} High</span>
              )}
              {priority.medium > 0 && (
                <span className="text-[color:var(--color-brand-600)]">{priority.medium} Med</span>
              )}
              {priority.low > 0 && (
                <span className="text-[color:var(--color-text-secondary)]">{priority.low} Low</span>
              )}
            </div>
          </div>

          <div className="flex h-2 overflow-hidden rounded-full bg-[color:var(--chart-track)]">
            {priority.urgent > 0 && (
              <div
                style={{ width: `${(priority.urgent / totalPriorityCount) * 100}%` }}
                className="bg-[color:var(--color-danger-500)] transition-all duration-500"
                title={`${priority.urgent} Urgent`}
              />
            )}
            {priority.high > 0 && (
              <div
                style={{ width: `${(priority.high / totalPriorityCount) * 100}%` }}
                className="bg-[color:var(--color-warning-500)] transition-all duration-500"
                title={`${priority.high} High`}
              />
            )}
            {priority.medium > 0 && (
              <div
                style={{ width: `${(priority.medium / totalPriorityCount) * 100}%` }}
                className="bg-[color:var(--color-brand-500)] transition-all duration-500"
                title={`${priority.medium} Medium`}
              />
            )}
            {priority.low > 0 && (
              <div
                style={{ width: `${(priority.low / totalPriorityCount) * 100}%` }}
                className="bg-[color:var(--color-text-muted)] transition-all duration-500"
                title={`${priority.low} Low`}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Top Categories Telemetry Strip ─────────────────── */}
      {categories.length > 0 && (
        <div className="border-t border-[color:var(--border-color)]/60 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Top Incident Categories
            </span>
            {onManageClick && (
              <button
                type="button"
                onClick={onManageClick}
                className="text-[11px] font-semibold text-[color:var(--color-brand-600)] hover:underline"
              >
                View All Categories
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.slice(0, 4).map((cat) => {
              const count = cat.count;
              const pct = totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0;
              return (
                <div
                  key={cat._id}
                  className={clsx(surfaceNestedClass, 'flex items-center gap-2 p-2 text-left')}
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] text-[color:var(--color-brand-600)]">
                    {getCategoryIcon(cat._id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[color:var(--color-text-primary)]">
                      {formatCategoryLabel(cat._id)}
                    </p>
                    <p className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
                      {count} ({pct}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
