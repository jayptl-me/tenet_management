'use client';

import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

// ── Base skeleton shimmer block ────────────────────────

export function ShimmerBlock({ className, style }: SkeletonProps) {
  return (
    <div
      className={clsx('animate-pulse rounded-md bg-[color:var(--shimmer-base)]', className)}
      style={style}
    />
  );
}

// ── Text Skeleton ──────────────────────────────────────

interface TextSkeletonProps extends SkeletonProps {
  lines?: number;
  lastLineShort?: boolean;
}

export function TextSkeleton({ lines = 3, lastLineShort = true, className }: TextSkeletonProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock
          key={i}
          className={clsx('h-3.5', i === lines - 1 && lastLineShort ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

// ── Heading Skeleton ───────────────────────────────────

export function HeadingSkeleton({ className }: SkeletonProps) {
  return <ShimmerBlock className={clsx('h-7 w-1/3', className)} />;
}

// ── Stat Card Skeleton ─────────────────────────────────

interface StatCardSkeletonProps extends SkeletonProps {
  /** Show an icon placeholder block */
  withIcon?: boolean;
}

export function StatCardSkeleton({ className, withIcon = true }: StatCardSkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-8 w-28" />
        </div>
        {withIcon && <ShimmerBlock className="h-9 w-9 rounded-lg" />}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <ShimmerBlock className="h-5 w-16 rounded-full" />
        <ShimmerBlock className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Card Skeleton ──────────────────────────────────────

interface CardSkeletonProps extends SkeletonProps {
  /** Number of content lines inside the card */
  lines?: number;
}

export function CardSkeleton({ className, lines = 4 }: CardSkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <ShimmerBlock className="mb-4 h-6 w-1/2" />
      <TextSkeleton lines={lines} />
    </div>
  );
}

// ── Table Skeleton ─────────────────────────────────────

interface TableSkeletonProps extends SkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ className, rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]',
        className,
      )}
    >
      {/* Table header */}
      <div className="flex gap-4 border-b border-b-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <ShimmerBlock key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={clsx(
            'flex gap-4 px-4 py-3',
            rowIdx < rows - 1 && 'border-b border-b-[color:var(--color-surface-200)]',
          )}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <ShimmerBlock
              key={`cell-${rowIdx}-${colIdx}`}
              className={clsx('h-3.5 flex-1', colIdx === 0 && 'w-2/3')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Chart Skeleton ─────────────────────────────────────

interface ChartSkeletonProps extends SkeletonProps {
  height?: number;
}

export function ChartSkeleton({ className, height = 240 }: ChartSkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <ShimmerBlock className="mb-4 h-6 w-1/3" />
      <ShimmerBlock className="w-full rounded-lg" style={{ height }} />
    </div>
  );
}

// ── Dashboard Grid Skeleton ────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <HeadingSkeleton />
        <ShimmerBlock className="h-4 w-48" />
      </div>

      {/* Stat cards — match live KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" height={260} />
        <ChartSkeleton height={260} />
      </div>

      {/* Activity section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}

// ── Inline / Avatar Skeleton ───────────────────────────

export function CircleSkeleton({ className, size = 10 }: SkeletonProps & { size?: number }) {
  return (
    <ShimmerBlock
      className={clsx('flex-shrink-0 rounded-full', className)}
      style={{ width: size * 4, height: size * 4 }}
    />
  );
}

export function BadgeSkeleton({ className }: SkeletonProps) {
  return <ShimmerBlock className={clsx('inline-block h-5 w-16 rounded-full', className)} />;
}

// ── Form Field Skeleton ────────────────────────────────

export function FormFieldSkeleton({ className }: SkeletonProps) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <ShimmerBlock className="h-3.5 w-20" />
      <ShimmerBlock className="h-9 w-full rounded-lg" />
    </div>
  );
}
