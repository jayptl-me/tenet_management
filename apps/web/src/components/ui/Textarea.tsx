'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  hint?: string;
}

// ── Component ──────────────────────────────────────────

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, hint, className, id, rows = 3, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {/* Label + hint */}
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={textareaId}
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

        {/* Textarea */}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={clsx(
            'w-full resize-y rounded-lg border bg-[color:var(--color-surface-50)] px-3.5 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)]',
            'transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
            'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-0 focus:border-[color:var(--color-brand-500)]',
            'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] disabled:bg-[color:var(--disabled-bg)]',
            error
              ? 'border-[color:var(--color-danger-400)] focus:ring-[color:var(--color-danger-400)]'
              : 'border-[color:var(--border-color)] hover:border-[color:var(--color-surface-300)]',
            className,
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
