'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

/**
 * Interactive or readonly 5-star rating display.
 * Uses SaaS tokens for filled (warning) and empty (muted) stars.
 */
export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const isInteractive = !!onChange && !readonly;
  const displayValue = hoverValue || value;
  const starSize = sizeMap[size];

  return (
    <div
      className={clsx('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => {
        if (isInteractive) setHoverValue(0);
      }}
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label={isInteractive ? 'Select rating' : `Rating: ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        const starEl = (
          <Star
            className={clsx(
              starSize,
              filled
                ? 'fill-[color:var(--color-warning-400)] text-[color:var(--color-warning-400)]'
                : 'text-[color:var(--color-text-muted)]',
              isInteractive && 'cursor-pointer transition-colors',
            )}
          />
        );

        if (isInteractive) {
          return (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverValue(star)}
              onClick={() => onChange?.(star)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              aria-checked={value === star}
              role="radio"
              className="border-0 bg-transparent p-0 leading-none"
            >
              {starEl}
            </button>
          );
        }

        return (
          <span key={star} aria-hidden>
            {starEl}
          </span>
        );
      })}
    </div>
  );
}
