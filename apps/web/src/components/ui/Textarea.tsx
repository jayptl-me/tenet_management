'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
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
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={textareaId} className={fieldLabelClass}>
              {label}
            </label>
            {hint && <span className={fieldHintClass}>{hint}</span>}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={clsx(
            fieldControlBase,
            'min-h-[5.5rem] resize-y py-2.5',
            error ? fieldControlBorderError : fieldControlBorderOk,
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
