'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger' | 'brand';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  delta?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  progress?: {
    value: number;
    max?: number;
    color?: string;
    label?: string;
  };
  variant?: StatCardTone;
  tone?: StatCardTone;
  /** Selected state (e.g. active filter card): tone-matched ring. */
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  children?: React.ReactNode;
}

// ── Accent Tile Styles ─────────────────────────────────

const iconTileStyles: Record<StatCardTone, string> = {
  brand:
    'bg-[color:var(--badge-info-bg)] text-[color:var(--badge-info-text)] border-[color:var(--badge-info-border)]',
  success:
    'bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)] border-[color:var(--badge-success-border)]',
  warning:
    'bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-text)] border-[color:var(--badge-warning-border)]',
  danger:
    'bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)] border-[color:var(--badge-danger-border)]',
  default:
    'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] border-[color:var(--border-color)]',
};

// ── Selected Ring Styles ───────────────────────────────

const selectedRingStyles: Record<StatCardTone, string> = {
  brand: 'ring-2 ring-[color:var(--color-brand-500)]',
  success: 'ring-2 ring-[color:var(--color-success-500)]',
  warning: 'ring-2 ring-[color:var(--color-warning-500)]',
  danger: 'ring-2 ring-[color:var(--color-danger-500)]',
  default: 'ring-2 ring-[color:var(--color-text-primary)]',
};

// ── Helpers ────────────────────────────────────────────

function renderDeltaPill(
  item: { value: string; direction: 'up' | 'down' | 'neutral'; label?: string },
  key: string,
) {
  const isUp = item.direction === 'up';
  const isDown = item.direction === 'down';

  return (
    <span key={key} className="inline-flex items-center gap-1.5">
      <span
        className={clsx(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-tight',
          isUp &&
            'border-[color:var(--badge-success-border)] bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)]',
          isDown &&
            'border-[color:var(--badge-danger-border)] bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)]',
          !isUp &&
            !isDown &&
            'border-[color:var(--badge-neutral-border)] bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-text)]',
        )}
      >
        {isUp && <ArrowUpRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
        {isDown && <ArrowDownRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
        {!isUp && !isDown && <Minus className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
        <span>{item.value}</span>
      </span>
      {item.label && (
        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
          {item.label}
        </span>
      )}
    </span>
  );
}

// ── Component ──────────────────────────────────────────

/**
 * Enterprise Metric Card — Stripe & Mercury Executive Standard.
 * High-contrast surface featuring structured tone-aware accent icon tiles,
 * bold tabular figures, tinted micro-delta comparison pills,
 * and razor-thin progress indicators with theme-driven hover highlights.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  delta,
  progress,
  variant,
  tone,
  selected = false,
  className,
  onClick,
  animate = true,
  children,
}: StatCardProps) {
  const isInteractive = Boolean(onClick);
  const resolvedTone: StatCardTone = tone ?? variant ?? 'default';

  const sharedClasses = clsx(
    surfaceCardClass,
    '@container group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] p-5 text-left',
    'transition-[border-color,box-shadow,transform] duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
    'hover:border-[color:var(--border-color-hover)] hover:shadow-[var(--shadow-card-hover)]',
    isInteractive && 'cursor-pointer',
    selected && selectedRingStyles[resolvedTone],
    className,
  );

  const content = (
    <>
      {/* Top Row: Metric Label + Tone-Aware Accent Icon Tile */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold tracking-wide text-[color:var(--color-text-secondary)] uppercase">
            {title}
          </p>
          {icon && (
            <div
              className={clsx(
                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] border shadow-[var(--shadow-xs)] transition-transform duration-200 group-hover:scale-105 [&_svg]:h-4 [&_svg]:w-4',
                iconTileStyles[resolvedTone],
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
        </div>

        {/* Primary Metric Value */}
        <div className="mt-2 flex items-baseline gap-2">
          <p className="font-display text-[28px] sm:text-[32px] font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums leading-none">
            {value}
          </p>
        </div>

        {/* Contextual Subtitle */}
        {subtitle && (
          <p className="mt-1.5 truncate text-[11px] font-medium text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Middle Slot: Sleek Micro Progress Bar */}
      {progress && (
        <div className="my-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--chart-track)]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(Math.max((progress.value / (progress.max ?? 100)) * 100, 0), 100)}%`,
                backgroundColor: progress.color || 'var(--color-brand-500)',
              }}
            />
          </div>
          {progress.label && (
            <div className="flex items-center justify-between text-[10px] font-medium text-[color:var(--color-text-muted)]">
              <span>{progress.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Embedded Children (e.g. Sparkline) */}
      {children && <div className="mt-1.5 w-full">{children}</div>}

      {/* Bottom Row: Tinted Delta Pills & Navigation Affordance */}
      {(trend || delta || isInteractive) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--border-color)]/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {trend && renderDeltaPill(trend, 'trend')}
            {trend && delta && (
              <span className="text-[color:var(--border-color)]" aria-hidden="true">
                ·
              </span>
            )}
            {delta && renderDeltaPill(delta, 'delta')}
          </div>

          {isInteractive && (
            <span
              className="text-[color:var(--color-text-muted)] opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[color:var(--color-brand-600)]"
              aria-hidden="true"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      )}
    </>
  );

  if (animate && isInteractive) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={sharedClasses}
      >
        {content}
      </motion.div>
    );
  }

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          sharedClasses,
          'w-full focus:ring-2 focus:ring-[color:var(--focus-ring-color)] focus:ring-offset-2 focus:outline-none',
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={sharedClasses}>{content}</div>;
}

export default StatCard;
