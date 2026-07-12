'use client';

import { clsx } from 'clsx';
import { fieldLabelClass, fieldErrorClass } from '@/lib/field-styles';

export interface CategoryChipSelectProps {
  value: string[];
  onChange: (categories: string[]) => void;
  error?: string;
  label?: string;
  className?: string;
}

const CATEGORIES = ['taste', 'variety', 'quantity', 'cleanliness', 'service'] as const;

/**
 * Chip-based multi-select for meal feedback categories.
 * Toggles membership in the value array on click.
 * Uses SaaS tokens: selected = brand, unselected = neutral field.
 */
export function CategoryChipSelect({
  value,
  onChange,
  error,
  label,
  className,
}: CategoryChipSelectProps) {
  const toggle = (cat: string) => {
    if (value.includes(cat)) {
      onChange(value.filter((c) => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  };

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && <label className={fieldLabelClass}>{label}</label>}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const selected = value.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              aria-pressed={selected}
              className={clsx(
                'rounded-[var(--radius-full)] border px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                selected
                  ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]'
                  : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-brand-200)]',
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>
      {error && (
        <p className={fieldErrorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
