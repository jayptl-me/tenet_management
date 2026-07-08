'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

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
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

// ── Component ──────────────────────────────────────────

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, hint, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {/* Label + hint */}
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={selectId}
              className="text-[13px] font-semibold text-[color:var(--color-text-primary)]"
            >
              {label}
            </label>
            {hint && (
              <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                {hint}
              </span>
            )}
          </div>
        )}

        {/* Select wrapper */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
            'w-full appearance-none rounded-lg border bg-[color:var(--color-surface-50)] py-2 pl-3.5 pr-9 text-sm font-medium text-[color:var(--color-text-primary)]',
            'transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
            'hover:bg-[color:var(--color-surface-100)]',
            'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-0 focus:bg-[color:var(--color-surface-50)] focus:border-[color:var(--color-brand-500)]',
            'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] disabled:bg-[color:var(--disabled-bg)]',
              error
                ? 'border-[color:var(--color-danger-400)] focus:ring-[color:var(--color-danger-400)]'
                : 'border-[color:var(--border-color)] hover:border-[color:var(--color-surface-300)]',
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

          {/* Chevron */}
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--color-text-muted)]" />
        </div>

        {/* Error / helper */}
        {error && (
          <p className="text-[12px] font-medium text-[color:var(--color-danger-600)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
