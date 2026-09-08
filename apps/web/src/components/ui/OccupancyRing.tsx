'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';

// ── Types ──────────────────────────────────────────────

export type OccupancyTone = 'auto' | 'success' | 'warning' | 'danger' | 'brand';

export interface OccupancyRingProps {
  /** Occupancy percentage, 0-100. Values are clamped. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  strokeWidth?: number;
  /** Caption under the ring, e.g. "12 / 14 beds". */
  caption?: string;
  tone?: OccupancyTone;
  className?: string;
  animate?: boolean;
}

// ── Tone resolution ────────────────────────────────────

const TONE_COLORS: Record<Exclude<OccupancyTone, 'auto'>, { ring: string; text: string }> = {
  success: {
    ring: 'var(--color-success-500)',
    text: 'text-[color:var(--color-success-600)]',
  },
  warning: {
    ring: 'var(--color-warning-500)',
    text: 'text-[color:var(--color-warning-600)]',
  },
  danger: {
    ring: 'var(--color-danger-500)',
    text: 'text-[color:var(--color-danger-600)]',
  },
  brand: {
    ring: 'var(--color-brand-500)',
    text: 'text-[color:var(--color-brand-600)]',
  },
};

function resolveTone(value: number, tone: OccupancyTone): Exclude<OccupancyTone, 'auto'> {
  if (tone !== 'auto') return tone;
  if (value >= 100) return 'danger';
  if (value >= 90) return 'warning';
  return 'success';
}

// ── Component ──────────────────────────────────────────

export function OccupancyRing({
  value,
  size = 96,
  strokeWidth = 9,
  caption,
  tone = 'auto',
  className,
  animate = true,
}: OccupancyRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolved = resolveTone(clamped, tone);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const trackRadius = radius;
  const colors = TONE_COLORS[resolved];

  return (
    <div className={clsx('flex flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${clamped}% occupied`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={trackRadius}
            fill="none"
            stroke="var(--color-surface-200)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={trackRadius}
            fill="none"
            stroke={colors.ring}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animate ? { strokeDashoffset: circumference } : false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx(
              'font-display font-bold tabular-nums leading-none',
              colors.text,
              size >= 80 ? 'text-xl' : 'text-sm',
            )}
          >
            {clamped}%
          </span>
          {size >= 80 && (
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              occupied
            </span>
          )}
        </div>
      </div>
      {caption && (
        <span className="text-xs font-semibold text-[color:var(--color-text-secondary)]">{caption}</span>
      )}
    </div>
  );
}
