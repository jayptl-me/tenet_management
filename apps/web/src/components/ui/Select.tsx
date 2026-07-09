'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import {
  fieldControlBase,
  fieldControlBorderError,
  fieldControlBorderOk,
  fieldErrorClass,
  fieldHelperClass,
  fieldHintClass,
  fieldLabelClass,
} from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
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
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={selectId} className={fieldLabelClass}>
              {label}
            </label>
            {hint && <span className={fieldHintClass}>{hint}</span>}
          </div>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              fieldControlBase,
              'appearance-none pr-9 cursor-pointer',
              // Native option menus inherit OS chrome; keep field colors for closed state
              '[&>option]:bg-[color:var(--color-card-bg)] [&>option]:text-[color:var(--color-text-primary)]',
              error ? fieldControlBorderError : fieldControlBorderOk,
              className,
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
        </div>

        {error && (
          <p className={fieldErrorClass} role="alert">
            {error}
          </p>
        )}
        {helperText && !error && <p className={fieldHelperClass}>{helperText}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
