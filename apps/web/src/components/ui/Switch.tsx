'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

/**
 * Theme-aware toggle switch.
 * Uses CSS variable surfaces for consistent light/dark rendering.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className, id, ...props }, ref) => {
    const switchId = id ?? `switch-${label?.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <label
        htmlFor={switchId}
        className={clsx(
          'group -m-2 inline-flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-2',
          'transition-colors hover:bg-[color:var(--color-field-bg)]',
          className,
        )}
      >
        <div className="relative mt-0.5 inline-flex h-6 w-11 shrink-0">
          <input ref={ref} id={switchId} type="checkbox" className="peer sr-only" {...props} />
          <span
            className={clsx(
              'absolute inset-0 rounded-full border border-[color:var(--border-color)] transition-all duration-200 ease-out',
              'bg-[color:var(--color-surface-200)]',
              'peer-checked:border-[color:var(--color-brand-600)] peer-checked:bg-[color:var(--color-brand-500)]',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-[var(--disabled-opacity)]',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--focus-ring-color)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[color:var(--focus-ring-offset-bg)]',
            )}
          />
          <span
            className={clsx(
              'absolute top-[1px] left-[1px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all duration-200 ease-out',
              'peer-checked:translate-x-5 peer-checked:bg-white',
            )}
          />
        </div>
        {(label || description) && (
          <span className="min-w-0 flex-1">
            {label && (
              <span className="block text-sm font-semibold text-[color:var(--color-text-primary)]">
                {label}
              </span>
            )}
            {description && (
              <span className="mt-0.5 block text-xs text-[color:var(--color-text-secondary)]">
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    );
  },
);

Switch.displayName = 'Switch';
