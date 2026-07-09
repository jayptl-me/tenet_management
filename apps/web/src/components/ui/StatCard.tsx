'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { cardHover } from '@/lib/animations';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface StatCardProps {
  title: string;
  value: string | number;
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
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  children?: React.ReactNode;
}

// ── Style Maps ─────────────────────────────────────────

/** Top accent bar (avoids side-stripe anti-pattern). */
const accentBars: Record<string, string> = {
  default: 'bg-[color:var(--color-surface-300)]',
  success: 'bg-[color:var(--color-success-500)]',
  warning: 'bg-[color:var(--color-warning-500)]',
  danger: 'bg-[color:var(--color-danger-500)]',
  brand: 'bg-[color:var(--color-brand-500)]',
};

const trendStyles: Record<string, Record<string, string>> = {
  up: {
    base: 'text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] border-[color:var(--color-success-200)]',
  },
  down: {
    base: 'text-[color:var(--color-danger-700)] bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-200)]',
  },
  neutral: {
    base: 'text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-100)] border-[color:var(--color-surface-200)]',
  },
};

const iconBgColors: Record<string, string> = {
  default: 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-secondary)]',
  success: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-600)]',
  warning: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-600)]',
  danger: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-600)]',
  brand: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-600)]',
};

// ── Component ──────────────────────────────────────────

export function StatCard({
  title,
  value,
  icon,
  trend,
  delta,
  variant = 'default',
  className,
  onClick,
  animate = true,
  children,
}: StatCardProps) {
  const isInteractive = !!onClick;

  const cardContent = (
    <div
      className={clsx(
        surfaceCardClass,
        'relative overflow-hidden px-5 py-4',
        'transition-shadow duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
        'hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-card-hover)]',
        isInteractive && 'cursor-pointer',
        className,
      )}
    >
      <div
        className={clsx(
          'absolute inset-x-0 top-0 h-0.5',
          accentBars[variant],
        )}
        aria-hidden
      />
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-tight text-[color:var(--color-text-secondary)]">
            {title}
          </p>
          <p className="mt-1 font-[family:var(--font-display)] text-2xl font-bold tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={clsx(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-color)] shadow-[var(--shadow-xs)]',
              iconBgColors[variant],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold',
              trendStyles[trend.direction]?.base,
            )}
          >
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'neutral' && '→'}
            {trend.value}
          </span>
          {trend.label && (
            <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              {trend.label}
            </span>
          )}
        </div>
      )}

      {/* Month-over-month delta (separate from trend) */}
      {delta && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
              trendStyles[delta.direction]?.base,
            )}
          >
            {delta.direction === 'up' && '↑'}
            {delta.direction === 'down' && '↓'}
            {delta.value}
          </span>
          {delta.label && (
            <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
              {delta.label}
            </span>
          )}
        </div>
      )}

      {/* Children slot (e.g., Sparkline, mini chart) */}
      {children}
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
      >
        {cardContent}
      </motion.div>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {cardContent}
      </button>
    );
  }

  return cardContent;
}
