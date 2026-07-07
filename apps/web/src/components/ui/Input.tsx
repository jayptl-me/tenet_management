'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  hint?: string;
}

// ── Component ──────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, hint, className, id, type, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1.5">
        {/* Label + hint */}
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={inputId}
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

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={clsx(
              'w-full rounded-lg border bg-[color:var(--color-surface-50)] py-2 px-3.5 text-sm font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)]',
              'transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
              'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-0 focus:border-[color:var(--color-brand-500)]',
              'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] disabled:bg-[color:var(--disabled-bg)]',
              error
                ? 'border-[color:var(--color-danger-400)] focus:ring-[color:var(--color-danger-400)]'
                : 'border-[color:var(--border-color)] hover:border-[color:var(--color-surface-300)]',
              leftIcon && 'pl-9',
              (rightIcon || isPassword) && 'pr-9',
              className,
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}

          {/* Right icon (non-password) */}
          {rightIcon && !isPassword && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]">
              {rightIcon}
            </span>
          )}
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

Input.displayName = 'Input';
