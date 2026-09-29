'use client';

import { clsx } from 'clsx';
import { CheckCircle2, Clock, AlertTriangle, Flame, ArrowRight, ShieldAlert } from 'lucide-react';
import type { IComplaintSlaMetrics } from '@pg/types';
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
  onStatusClick?: (status: string) => void;
  onAgingClick?: (tier: 'under24h' | 'between24And48h' | 'over48h') => void;
  onManageClick?: () => void;
  className?: string;
}

/**
 * Linear-style Continuous Operational Command Console
 * Zero nested card boxes: renders as a single seamless operational telemetry surface
 * with an integrated lifecycle pipeline strip, SLA aging horizon rail, and priority distribution.
 */
export function ComplaintResolutionHub({
  complaints,
  totalComplaints,
  resolvedRate,
  slaMetrics,
  onStatusClick,
  onAgingClick,
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
      {/* ── Top HUD: Metrics & SLA Telemetry Strip ────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-color)] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
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
            <p className="text-[13px] font-bold text-[color:var(--color-text-primary)]">
              {complaints.resolved} of {totalComplaints} Resolved
            </p>
            <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              {activeCount} active tickets awaiting closure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {avgResolutionHours != null && (
            <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-[11px]">
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
                ? 'border-[color:var(--badge-success-border)] bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)]'
                : 'border-[color:var(--badge-warning-border)] bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-text)]',
            )}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>SLA: {slaComplianceRate}% in &lt;48h</span>
          </div>
        </div>
      </div>

      {/* ── Continuous Segmented Pipeline Strip (Zero Nested Cards) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            Ticket Lifecycle Pipeline
          </p>
          <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
            Click segment to filter
          </span>
        </div>

        <div className="grid grid-cols-2 divide-y divide-[color:var(--border-color)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/40 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {/* Open */}
          <button
            type="button"
            onClick={() => onStatusClick?.('open')}
            className={clsx(
              'group relative flex flex-col items-start p-3 text-left transition-colors duration-[var(--transition-duration)]',
              'hover:bg-[color:var(--color-danger-500)]/10',
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
              'group relative flex flex-col items-start p-3 text-left transition-colors duration-[var(--transition-duration)]',
              'hover:bg-[color:var(--color-warning-500)]/10',
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
              'group relative flex flex-col items-start p-3 text-left transition-colors duration-[var(--transition-duration)]',
              'hover:bg-[color:var(--color-success-500)]/10',
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
              'group relative flex flex-col items-start p-3 text-left transition-colors duration-[var(--transition-duration)]',
              'hover:bg-[color:var(--color-field-bg)]',
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

      {/* ── Continuous SLA Aging Horizon Rail (Zero Nested Cards) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            Active Ticket SLA Aging
          </p>
          <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
            Based on creation timestamp
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-[color:var(--border-color)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {/* < 24h Normal */}
          <button
            type="button"
            onClick={() => onAgingClick?.('under24h')}
            className="group flex flex-col justify-between p-3 text-left transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-success-500)]/10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-success-600)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success-500)]" />
                <span>&lt; 24h</span>
              </div>
              <span className="rounded-full border border-[color:var(--badge-success-border)] bg-[color:var(--badge-success-bg)] px-2 py-0.5 font-mono text-[11px] font-bold text-[color:var(--badge-success-text)]">
                {aging.under24h}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              Within optimal SLA window
            </p>
          </button>

          {/* 24-48h Aging */}
          <button
            type="button"
            onClick={() => onAgingClick?.('between24And48h')}
            className={clsx(
              'group flex flex-col justify-between p-3 text-left transition-colors duration-[var(--transition-duration)]',
              aging.between24And48h > 0
                ? 'bg-[color:var(--color-warning-500)]/10 hover:bg-[color:var(--color-warning-500)]/15'
                : 'hover:bg-[color:var(--color-field-bg)]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-warning-600)]">
                <Clock className="h-3.5 w-3.5 text-[color:var(--color-warning-500)]" />
                <span>24 - 48h</span>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                  aging.between24And48h > 0
                    ? 'border border-[color:var(--badge-warning-border)] bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-text)]'
                    : 'bg-[color:var(--chart-track)] text-[color:var(--color-text-muted)]',
                )}
              >
                {aging.between24And48h}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              At risk of SLA breach
            </p>
          </button>

          {/* > 48h Overdue */}
          <button
            type="button"
            onClick={() => onAgingClick?.('over48h')}
            className={clsx(
              'group flex flex-col justify-between p-3 text-left transition-colors duration-[var(--transition-duration)]',
              aging.over48h > 0
                ? 'bg-[color:var(--color-danger-500)]/10 hover:bg-[color:var(--color-danger-500)]/15'
                : 'hover:bg-[color:var(--color-field-bg)]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-danger-600)]">
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
                    ? 'border border-[color:var(--badge-danger-border)] bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)]'
                    : 'bg-[color:var(--chart-track)] text-[color:var(--color-text-muted)]',
                )}
              >
                {aging.over48h}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              SLA Breached · Immediate action
            </p>
          </button>
        </div>
      </div>

      {/* ── Priority Distribution Bar ──────────────────────── */}
      {activeCount > 0 && (
        <div className="pt-1">
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
    </div>
  );
}
