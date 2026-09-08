'use client';

import { clsx } from 'clsx';
import {
  AlertCircle,
  CreditCard,
  AlertTriangle,
  WifiOff,
  PhoneCall,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { surfaceCardClass } from '@/lib/field-styles';

export interface AttentionRequiredBannerProps {
  pendingVerificationsCount?: number;
  agingComplaintsCount?: number;
  issuesServicesCount?: number;
  newEnquiriesCount?: number;
  onNavigate: (href: string) => void;
  className?: string;
}

/**
 * Operational Triage Banner — Stripe & Mercury style.
 * Immediately alerts property managers to actionable bottlenecks:
 * unverified payments, aging complaints, service outages, new leads.
 */
export function AttentionRequiredBanner({
  pendingVerificationsCount = 0,
  agingComplaintsCount = 0,
  issuesServicesCount = 0,
  newEnquiriesCount = 0,
  onNavigate,
  className,
}: AttentionRequiredBannerProps) {
  const totalAlerts =
    pendingVerificationsCount + agingComplaintsCount + issuesServicesCount + newEnquiriesCount;

  if (totalAlerts === 0) {
    return (
      <div
        className={clsx(
          surfaceCardClass,
          'flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5',
          'border-l-4 border-l-[color:var(--color-success-500)]',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
              Operational Status: Normal
            </p>
            <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              No pending payment verifications, aging complaints, or service disruptions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-success-700)]">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-500)]" />
          All Checks Passing
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        surfaceCardClass,
        'relative overflow-hidden p-4 sm:p-5',
        'border-l-4 border-l-[color:var(--color-warning-500)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[color:var(--color-text-primary)]">
                Attention Required
              </span>
              <span className="inline-flex items-center rounded-full bg-[color:var(--color-warning-100)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-warning-800)]">
                {totalAlerts} {totalAlerts === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-[color:var(--color-text-secondary)]">
              High-priority operational items awaiting management action.
            </p>
          </div>
        </div>

        {/* Actionable items triage pills */}
        <div className="flex flex-wrap items-center gap-2">
          {pendingVerificationsCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/payments?status=pending_verification')}
              className={clsx(
                'group inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold',
                'border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-800)]',
                'transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-warning-400)] hover:bg-[color:var(--color-warning-100)]',
              )}
            >
              <CreditCard className="h-3.5 w-3.5 text-[color:var(--color-warning-600)]" />
              <span>
                <strong>{pendingVerificationsCount}</strong> Verify UTR
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {agingComplaintsCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/complaints?status=open')}
              className={clsx(
                'group inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold',
                'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-800)]',
                'transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-danger-400)] hover:bg-[color:var(--color-danger-100)]',
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--color-danger-600)]" />
              <span>
                <strong>{agingComplaintsCount}</strong> Overdue Complaints
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {issuesServicesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/services')}
              className={clsx(
                'group inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold',
                'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-800)]',
                'transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-danger-400)] hover:bg-[color:var(--color-danger-100)]',
              )}
            >
              <WifiOff className="h-3.5 w-3.5 text-[color:var(--color-danger-600)]" />
              <span>
                <strong>{issuesServicesCount}</strong> Service Issues
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {newEnquiriesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('/enquiries?status=new')}
              className={clsx(
                'group inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold',
                'border-[color:var(--color-info-300)] bg-[color:var(--color-info-50)] text-[color:var(--color-info-800)]',
                'transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-info-400)] hover:bg-[color:var(--color-info-100)]',
              )}
            >
              <PhoneCall className="h-3.5 w-3.5 text-[color:var(--color-info-600)]" />
              <span>
                <strong>{newEnquiriesCount}</strong> New Leads
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttentionRequiredBanner;
