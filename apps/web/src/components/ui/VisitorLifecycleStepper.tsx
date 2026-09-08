'use client';

import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export type VisitorLifecycleStatus = 'expected' | 'arrived' | 'departed' | 'cancelled';

export interface VisitorLifecycleStepperProps {
  status: string;
  compact?: boolean;
  className?: string;
}

interface StepDef {
  key: 'expected' | 'arrived' | 'departed';
  label: string;
}

const LINEAR_STEPS: StepDef[] = [
  { key: 'expected', label: 'Expected' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'departed', label: 'Departed' },
];

const STATUS_LABEL: Record<string, string> = {
  expected: 'Expected',
  arrived: 'Arrived',
  departed: 'Departed',
  cancelled: 'Cancelled',
};

/**
 * Visual lifecycle stepper for a visitor pass.
 *
 * Linear path: Expected -> Arrived -> Departed.
 * Cancelled renders as a branch off Expected (only reachable from expected).
 * Pure CSS + lucide check marks; theme tokens only.
 */
export function VisitorLifecycleStepper({
  status,
  compact = false,
  className,
}: VisitorLifecycleStepperProps) {
  const normalized = status.toLowerCase();
  const isCancelled = normalized === 'cancelled';
  const activeIndex = Math.max(
    0,
    LINEAR_STEPS.findIndex((s) => s.key === normalized),
  );
  const terminalIndex = isCancelled ? 0 : activeIndex;

  return (
    <div className={className}>
      <ol
        aria-label={`Visitor lifecycle: ${STATUS_LABEL[normalized] ?? status}`}
        className="flex items-start"
      >
        {LINEAR_STEPS.map((step, index) => {
          const reached = isCancelled ? index === 0 : index <= terminalIndex;
          const isCurrent = isCancelled ? index === 0 : index === terminalIndex;
          const isLast = index === LINEAR_STEPS.length - 1;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={clsx('flex-1', !isLast && 'pr-1')}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-default)] text-[11px] font-bold',
                    reached
                      ? 'border-[color:var(--color-success-500)] bg-[color:var(--color-success-500)] text-white'
                      : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]',
                  )}
                >
                  {reached && index < terminalIndex ? (
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
                      (isCancelled ? index < 0 : index < terminalIndex)
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
                    ? 'text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-muted)]',
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
      {isCancelled && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-3 py-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--color-danger-500)]"
          />
          <p className="text-xs font-bold text-[color:var(--color-danger-700)]">
            Cancelled while expected — an admin can re-approve this pass back to Expected.
          </p>
        </div>
      )}
    </div>
  );
}
