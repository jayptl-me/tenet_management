'use client';

import { clsx } from 'clsx';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    direction: 'up' | 'down';
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  onClick?: () => void;
}

const variantAccents: Record<string, string> = {
  default: 'border-l-brand-500',
  success: 'border-l-success-500',
  warning: 'border-l-warning-500',
  danger: 'border-l-danger-500',
};

const trendColors: Record<string, Record<string, string>> = {
  up: {
    default: 'text-success-600 bg-success-100 border-success-300',
    success: 'text-success-800 bg-success-200 border-success-400',
    warning: 'text-success-600 bg-success-100 border-success-300',
    danger: 'text-danger-600 bg-danger-100 border-danger-300',
  },
  down: {
    default: 'text-danger-600 bg-danger-100 border-danger-300',
    success: 'text-danger-600 bg-danger-100 border-danger-300',
    warning: 'text-danger-600 bg-danger-100 border-danger-300',
    danger: 'text-danger-800 bg-danger-200 border-danger-400',
  },
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
        variantAccents[variant],
        onClick &&
          'hover:translate-[var(--hover-lift)] cursor-pointer hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-surface-500 text-xs font-semibold uppercase tracking-wider">
            {title}
          </p>
          <p className="font-display text-surface-900 text-3xl font-extrabold tabular-nums">
            {value}
          </p>
        </div>
        {icon && (
          <div className="bg-surface-100 text-surface-600 flex-shrink-0 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-2">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={clsx(
              'font-display inline-flex items-center rounded-full border-[length:var(--bw-default)] px-2 py-0.5 text-xs font-bold',
              trendColors[trend.direction]?.[variant] ?? trendColors[trend.direction]?.default,
            )}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-surface-400 text-xs">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
