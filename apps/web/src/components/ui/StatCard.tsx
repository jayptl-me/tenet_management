'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
} from 'lucide-react';
import { cardHover } from '@/lib/animations';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

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
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  children?: React.ReactNode;
}

// ── Style Maps ─────────────────────────────────────────

const toneAccent: Record<string, string> = {
  default: 'bg-[color:var(--color-surface-300)]',
  brand: 'bg-[color:var(--color-brand-500)]',
  success: 'bg-[color:var(--color-success-500)]',
  warning: 'bg-[color:var(--color-warning-500)]',
  danger: 'bg-[color:var(--color-danger-500)]',
};

const trendStyles: Record<string, { badge: string; iconColor: string }> = {
  up: {
    badge:
      'text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] border-[color:var(--color-success-200)]',
    iconColor: 'text-[color:var(--color-success-600)]',
  },
  down: {
    badge:
      'text-[color:var(--color-danger-700)] bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-200)]',
    iconColor: 'text-[color:var(--color-danger-600)]',
  },
  neutral: {
    badge:
      'text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-100)] border-[color:var(--color-surface-200)]',
    iconColor: 'text-[color:var(--color-text-muted)]',
  },
};

const iconBgColors: Record<string, string> = {
  default: 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)]',
  success: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]',
  warning: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
  danger: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
  brand: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]',
};

// ── Component ──────────────────────────────────────────

/**
 * Enterprise Metric Card — Stripe & Mercury style.
 * Standardized height baseline, hairline tone accent, vector delta pills,
 * optional micro-progress bar, and full-width responsive slots.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  delta,
  progress,
  variant = 'default',
  tone,
  className,
  onClick,
  animate = true,
  children,
}: StatCardProps) {
  const isInteractive = Boolean(onClick);
  const resolvedTone = tone ?? variant;

  const cardInner = (
    <div
      className={clsx(
        surfaceCardClass,
        'group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden p-5',
        'transition-[border-color,box-shadow,transform] duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
        'hover:border-[color:var(--color-brand-300)] hover:shadow-[var(--shadow-card-hover)]',
        isInteractive && 'cursor-pointer',
        className,
      )}
    >
      {/* 2px Tone Hairline */}
      <span
        aria-hidden="true"
        className={clsx(
          'absolute inset-x-0 top-0 h-0.5 transition-colors',
          toneAccent[resolvedTone] ?? toneAccent.default,
        )}
      />

      {/* Top Row: Title + Icon */}
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <p className="text-[12px] font-semibold tracking-tight text-[color:var(--color-text-secondary)]">
            {title}
          </p>
          {icon && (
            <div
              className={clsx(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-transparent transition-colors',
                iconBgColors[resolvedTone] ?? iconBgColors.default,
              )}
            >
              <div className="[&_svg]:h-4 [&_svg]:w-4">{icon}</div>
            </div>
          )}
        </div>

        {/* Primary Metric Value */}
        <p className="font-display mt-2 text-[26px] leading-none font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums sm:text-[28px]">
          {value}
        </p>

        {/* Contextual Subtitle */}
        {subtitle && (
          <p className="mt-1.5 truncate text-[11px] font-medium text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Middle: Micro Progress Bar (Optional) */}
      {progress && (
        <div className="my-2.5 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
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
              <span className="font-mono tabular-nums">
                {Math.round((progress.value / (progress.max ?? 100)) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Embedded Children (e.g. Sparkline) */}
      {children && <div className="mt-2 w-full">{children}</div>}

      {/* Bottom Row: Trend / Delta / Interactive Hint */}
      {(trend || delta || isInteractive) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--border-color)]/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {trend && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-tight',
                  trendStyles[trend.direction]?.badge ?? trendStyles.neutral.badge,
                )}
              >
                {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                {trend.direction === 'neutral' && <Minus className="h-3 w-3" />}
                {trend.value}
                {trend.label && <span className="font-medium opacity-80">{trend.label}</span>}
              </span>
            )}

            {delta && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                  trendStyles[delta.direction]?.badge ?? trendStyles.neutral.badge,
                )}
              >
                {delta.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {delta.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {delta.direction === 'neutral' && <Minus className="h-3 w-3" />}
                {delta.value}
                {delta.label && <span className="font-medium opacity-80">{delta.label}</span>}
              </span>
            )}
          </div>

          {isInteractive && (
            <span className="text-[color:var(--color-text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (animate && isInteractive) {
    return (
      <motion.div
        variants={cardHover}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        className="h-full"
      >
        {cardInner}
      </motion.div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="h-full w-full rounded-[var(--radius-xl)] text-left focus:ring-2 focus:ring-[color:var(--focus-ring-color)] focus:ring-offset-2 focus:outline-none"
      >
        {cardInner}
      </button>
    );
  }

  return cardInner;
}

export default StatCard;
