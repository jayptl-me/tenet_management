'use client';

import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import {
  lifecycleAnchorIndex,
  lifecycleBranches,
  lifecycleFor,
  lifecycleSpine,
  type LifecycleDomain,
  type LifecycleStep,
} from '@pg/types';

/** The density of the stepper. */
export type StatusStepperSize = 'compact' | 'full';

export interface StatusStepperProps {
  /** The domain whose lifecycle is rendered. */
  domain: LifecycleDomain;
  /** The status of the record. Case insensitive. */
  current: string;
  /** `compact` for a dense row, `full` for a record page. */
  size?: StatusStepperSize;
  className?: string;
}

/** The tooltip of a step: who moves the record there and through which route. */
function stepTitle(step: LifecycleStep): string {
  return `${step.endpoint} (${step.actor})`;
}

/**
 * Renders the lifecycle of a domain from the shared vocabulary.
 *
 * The states, their order and the transitions come from packages/types/src/lifecycle.json, which is
 * the same source the Flutter portal is generated from. This component only draws: it holds no
 * status list of its own, so a new state cannot appear in the admin panel and be missing from the
 * portal.
 *
 * A ladder draws its linear path. A step that was reached is done, the current step is marked, and
 * a state that is not on the path (a terminal branch such as `cancelled` or `rejected`) is drawn
 * as a branch off the last step the record could have reached.
 *
 * A grid has no path between its states, so it draws them as a set.
 */
export function StatusStepper({ domain, current, size = 'full', className }: StatusStepperProps) {
  const spec = lifecycleFor(domain);
  const key = current.trim().toLowerCase();
  const compact = size === 'compact';

  if (spec.kind === 'grid') {
    return (
      <div className={className}>
        <ul aria-label={`${spec.label} states`} className="flex flex-wrap gap-2">
          {spec.steps.map((step) => {
            const isCurrent = step.key === key;
            return (
              <li key={step.key}>
                <span
                  title={stepTitle(step)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border-[length:var(--bw-default)] px-2.5 py-1 text-xs font-semibold',
                    isCurrent
                      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)] text-[color:var(--color-on-brand)]'
                      : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]',
                  )}
                >
                  {isCurrent && <Check aria-hidden className="h-3 w-3" />}
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const spine = lifecycleSpine(spec);
  const branches = lifecycleBranches(spec);
  const branch = branches.find((step) => step.key === key);
  const spineIndex = spine.findIndex((step) => step.key === key);
  const anchorIndex = branch === undefined ? spineIndex : lifecycleAnchorIndex(spec, branch.key);
  const anchor = spine[anchorIndex];
  const isKnown = branch !== undefined || spineIndex >= 0;

  return (
    <div className={className}>
      <ol aria-label={`${spec.label} lifecycle`} className="flex items-start">
        {spine.map((step, index) => {
          const isLast = index === spine.length - 1;
          const isCurrent = branch === undefined && index === spineIndex;
          const reached = index <= anchorIndex;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={clsx('flex-1', !isLast && 'pr-1')}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  title={stepTitle(step)}
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-default)] text-[11px] font-bold',
                    reached
                      ? 'border-[color:var(--color-success-500)] bg-[color:var(--color-success-500)] text-[color:var(--color-on-success)]'
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
                      index < anchorIndex
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

      {branch !== undefined && anchor !== undefined && (
        <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-3 py-2">
          <span
            aria-hidden
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--color-danger-500)]"
          />
          <div>
            <p className="text-xs font-bold text-[color:var(--color-danger-700)]">
              {branch.label} - the record left the normal path at {anchor.label}.
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--color-danger-700)]">
              {branch.endpoint} ({branch.actor})
            </p>
          </div>
        </div>
      )}

      {!isKnown && (
        <p className="mt-3 text-xs font-semibold text-[color:var(--color-text-muted)]">
          Status not in the {spec.label.toLowerCase()} vocabulary: {current}
        </p>
      )}
    </div>
  );
}
