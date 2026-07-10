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
        <div className="relative mt-0.5 inline-flex h-5 w-9 shrink-0">
          <input ref={ref} id={switchId} type="checkbox" className="peer sr-only" {...props} />
          <span
            className={clsx(
              'absolute inset-0 rounded-full transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
              'bg-[color:var(--color-surface-300)]',
              'peer-checked:bg-[color:var(--color-brand-500)]',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-[var(--disabled-opacity)]',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--focus-ring-color)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[color:var(--focus-ring-offset-bg)]',
            )}
          />
          <span
            className={clsx(
              'absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
              'peer-checked:translate-x-4 peer-checked:bg-white',
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
