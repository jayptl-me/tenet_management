'use client';

import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

export interface BedMini {
  bedId: string;
  isOccupied: boolean;
  tenantName?: string;
}

export interface BedMiniGridProps {
  beds: BedMini[];
  /** Rendered pip size class suffix: 'sm' | 'md'. */
  size?: 'sm' | 'md';
  /** Maximum pips before collapsing with a "+N" chip. */
  maxVisible?: number;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function BedMiniGrid({ beds, size = 'sm', maxVisible = 10, className }: BedMiniGridProps) {
  if (beds.length === 0) {
    return (
      <span className={clsx('text-[11px] font-medium text-[color:var(--color-text-muted)]', className)}>
        No beds
      </span>
    );
  }

  const visible = beds.slice(0, maxVisible);
  const overflow = beds.length - visible.length;
  const pipSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  return (
    <div
      className={clsx('flex flex-wrap items-center gap-1', className)}
      role="img"
      aria-label={`${beds.filter((b) => b.isOccupied).length} of ${beds.length} beds occupied`}
    >
      {visible.map((bed) => (
        <span
          key={bed.bedId}
          title={bed.isOccupied ? `Occupied by ${bed.tenantName ?? 'tenant'}` : 'Vacant'}
          className={clsx(
            'rounded-[3px] border transition-colors duration-[var(--transition-duration)]',
            pipSize,
            bed.isOccupied
              ? 'border-[color:var(--color-text-primary)] bg-[color:var(--color-text-primary)]'
              : 'border-dashed border-[color:var(--color-surface-400)] bg-[color:var(--color-surface-100)]',
          )}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-bold text-[color:var(--color-text-muted)]">+{overflow}</span>
      )}
    </div>
  );
}

/** Compact horizontal occupancy bar (used in table rows). */
export function OccupancyBar({
  occupied,
  total,
  className,
}: {
  occupied: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const fillColor =
    pct >= 100
      ? 'bg-[color:var(--color-danger-500)]'
      : pct >= 90
        ? 'bg-[color:var(--color-warning-500)]'
        : 'bg-[color:var(--color-success-500)]';

  return (
    <div className={clsx('flex min-w-[90px] items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums text-[color:var(--color-text-secondary)]">
        {occupied}/{total}
      </span>
    </div>
  );
}
