'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-surface-800 font-display text-sm font-semibold">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'text-surface-900 placeholder:text-surface-400 font-body w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base transition-shadow',
            'focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] focus:ring-offset-2',
            'disabled:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-60',
            error && 'border-danger-500 focus:ring-danger-500',
            className,
          )}
          {...props}
        />
        {error && <p className="text-danger-600 text-sm font-medium">{error}</p>}
        {helperText && !error && <p className="text-surface-500 text-sm">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
