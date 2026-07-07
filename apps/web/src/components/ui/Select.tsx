'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-surface-800 font-display text-sm font-semibold">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'text-surface-900 font-[family:var(--font-body)] w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base',
            'focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:bg-[color:var(--color-surface-100)] disabled:opacity-60',
            error &&
              'border-[color:var(--color-danger-500)] focus:ring-[color:var(--color-danger-500)]',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-danger-600 text-sm font-medium">{error}</p>}
        {helperText && !error && <p className="text-surface-500 text-sm">{helperText}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
