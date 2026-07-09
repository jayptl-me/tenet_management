'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

/**
 * Token-driven checkbox with label — replaces ad-hoc native checkboxes on edit forms.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className, id, ...props }, ref) => {
    const checkboxId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        <label
          htmlFor={checkboxId}
          className="group -m-1 flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-2 transition-colors hover:bg-[color:var(--color-field-bg)]"
        >
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={clsx(
              'mt-0.5 h-4 w-4 shrink-0 rounded border',
              'border-[color:var(--color-field-border)] bg-[color:var(--color-field-bg)]',
              'text-[color:var(--color-brand-500)]',
              'focus:ring-2 focus:ring-[color:var(--focus-ring-color)] focus:ring-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]',
              'accent-[color:var(--color-brand-500)]',
            )}
            {...props}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[color:var(--color-text-primary)]">
              {label}
            </span>
            {description && (
              <span className="mt-0.5 block text-xs text-[color:var(--color-text-secondary)]">
                {description}
              </span>
            )}
          </span>
        </label>
        {error && (
          <p className="text-[12px] font-medium text-[color:var(--color-danger-600)]">{error}</p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
