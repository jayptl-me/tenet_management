'use client';

import { clsx } from 'clsx';
import { Minus, Plus } from 'lucide-react';
import { fieldLabelClass, fieldErrorClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface AmenityCountStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function AmenityCountStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  icon,
  error,
  disabled = false,
  className,
}: AmenityCountStepperProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const stepBtn =
    'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border-color)] ' +
    'bg-[color:var(--color-card-bg)] text-[color:var(--color-text-secondary)] shadow-[var(--shadow-xs)] ' +
    'transition-colors duration-[var(--transition-duration)] ease-[var(--transition-easing)] ' +
    'hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-primary)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] ' +
    'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]';

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className={clsx(fieldLabelClass, 'inline-flex items-center gap-1.5')}>
          {icon && <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 text-[color:var(--color-text-muted)]">{icon}</span>}
          {label}
        </label>
      </div>

      <div
        className={clsx(
          'flex items-center justify-between gap-2 rounded-[var(--radius-md)] border px-2 py-1.5',
          'bg-[color:var(--color-field-bg)] shadow-[var(--shadow-xs)] transition-colors duration-[var(--transition-duration)]',
          error
            ? 'border-[color:var(--border-color-error)]'
            : 'border-[color:var(--color-field-border)] focus-within:border-[color:var(--border-color-focus)]',
        )}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className={stepBtn}
        >
          <Minus className="h-4 w-4" />
        </button>

        <span
          className={clsx(
            'font-display text-lg font-bold tabular-nums',
            value > 0
              ? 'text-[color:var(--color-text-primary)]'
              : 'text-[color:var(--color-text-muted)]',
          )}
          aria-live="polite"
        >
          {value}
        </span>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className={stepBtn}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className={fieldErrorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
