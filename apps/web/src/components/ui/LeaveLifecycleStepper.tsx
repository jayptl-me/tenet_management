'use client';

import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface LeaveLifecycleStepperProps {
  status: string;
  compact?: boolean;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/**
 * Visual lifecycle stepper for a leave application.
 *
 * Linear path: Pending -> Approved.
 * Rejected / Cancelled render as terminal branches off Pending
 * (only reachable from pending, matching the API state machine).
 * Pure CSS + lucide check marks; theme tokens only.
 */
export function LeaveLifecycleStepper({
  status,
  compact = false,
  className,
}: LeaveLifecycleStepperProps) {
  const normalized = status.toLowerCase();
  const isTerminalBranch = normalized === 'rejected' || normalized === 'cancelled';
  const approved = normalized === 'approved';

  const steps = [
    { key: 'pending', label: 'Pending' },
    {
      key: isTerminalBranch ? normalized : 'approved',
      label: STATUS_LABEL[isTerminalBranch ? normalized : 'approved'] ?? 'Approved',
    },
  ];

  return (
    <div className={className}>
      <ol
        aria-label={`Leave lifecycle: ${STATUS_LABEL[normalized] ?? status}`}
        className="flex items-start"
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const reached = index === 0 || approved || isTerminalBranch;
          const isCurrent = index === steps.length - 1;
          const branchDanger = isLast && isTerminalBranch;
          return (
            <li key={step.key} aria-current={isCurrent ? 'step' : undefined} className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-default)] text-[11px] font-bold',
                    branchDanger
                      ? 'border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-500)] text-white'
                      : reached
                        ? 'border-[color:var(--color-success-500)] bg-[color:var(--color-success-500)] text-white'
                        : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]',
                  )}
                >
                  {reached && !isCurrent ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden
                    className={clsx(
                      'h-0.5 min-w-4 flex-1 rounded-full',
                      approved && !isTerminalBranch
                        ? 'bg-[color:var(--color-success-500)]'
                        : 'bg-[color:var(--border-color)]',
                    )}
                  />
                )}
              </div>
              <p
                className={clsx(
                  compact ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs',
                  'font-bold',
                  reached
                    ? branchDanger
                      ? 'text-[color:var(--color-danger-700)]'
                      : 'text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-muted)]',
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
      {isTerminalBranch && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-3 py-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--color-danger-500)]"
          />
          <p className="text-xs font-bold text-[color:var(--color-danger-700)]">
            {normalized === 'rejected'
              ? 'Rejected — no attendance rows were marked for this window.'
              : 'Cancelled while pending — no attendance rows were marked for this window.'}
          </p>
        </div>
      )}
      {approved && (
        <p className="mt-3 text-xs font-semibold text-[color:var(--color-text-muted)]">
          Each day of the window is marked <span className="font-bold">on leave</span> on the
          attendance board. Days with a real on-site check-in are preserved.
        </p>
      )}
    </div>
  );
}
