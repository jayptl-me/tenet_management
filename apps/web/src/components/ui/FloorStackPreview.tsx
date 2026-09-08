'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { Building2, AlertTriangle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

export interface FloorStackFloor {
  _id?: string;
  id?: string;
  floorNumber: number;
  label: string;
  totalRooms?: number;
}

export interface FloorStackPreviewProps {
  /** All existing floors (any order). */
  floors: FloorStackFloor[];
  /** Floor being created or edited. */
  current: {
    floorNumber: number;
    label: string;
    totalRooms?: number;
  };
  /** Excluded from conflict highlighting (edit mode: the floor itself). */
  currentId?: string;
  /** Whether "current" is a new floor or an existing one. */
  mode: 'new' | 'edit';
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function FloorStackPreview({
  floors,
  current,
  currentId,
  mode,
  className,
}: FloorStackPreviewProps) {
  const conflict = floors.some(
    (f) => f.floorNumber === current.floorNumber && String(f.id ?? '') !== String(currentId ?? ''),
  );

  const stack: Array<{
    key: string;
    floorNumber: number;
    label: string;
    totalRooms?: number;
    state: 'existing' | 'current' | 'conflict' | 'new';
  }> = floors
    .filter((f) => String(f.id ?? '') !== String(currentId ?? '') || mode === 'new')
    .map((f) => ({
      key: `existing-${f.floorNumber}`,
      floorNumber: f.floorNumber,
      label: f.label,
      totalRooms: f.totalRooms,
      state: f.floorNumber === current.floorNumber ? 'conflict' : 'existing',
    }));

  if (mode === 'edit') {
    const idx = stack.findIndex((s) => s.state === 'conflict');
    const entry = {
      key: 'current',
      floorNumber: current.floorNumber,
      label: current.label || 'This floor',
      totalRooms: current.totalRooms,
      state: (conflict ? 'conflict' : 'current') as 'current' | 'conflict',
    };
    // Replace conflict marker with the current floor itself.
    if (idx >= 0) stack[idx] = { ...entry, key: 'current' };
    else stack.push(entry);
  } else {
    stack.push({
      key: 'new',
      floorNumber: current.floorNumber,
      label: current.label || 'New floor',
      totalRooms: current.totalRooms,
      state: conflict ? 'conflict' : 'new',
    });
  }

  // Highest floor renders on top, like looking at a building elevation.
  stack.sort((a, b) => b.floorNumber - a.floorNumber);

  const rowStyles: Record<string, string> = {
    existing:
      'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]',
    current:
      'border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] ring-1 ring-[color:var(--color-brand-300)]',
    new: 'border-[color:var(--color-success-300)] border-dashed bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)]',
    conflict:
      'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)]',
  };

  const badgeStyles: Record<string, string> = {
    existing: 'bg-[color:var(--color-surface-200)] text-[color:var(--color-text-secondary)]',
    current: 'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)]',
    new: 'bg-[color:var(--color-success-500)] text-[color:var(--color-text-inverted)]',
    conflict: 'bg-[color:var(--color-danger-500)] text-[color:var(--color-text-inverted)]',
  };

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Building preview
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {mode === 'new' ? 'New floor' : 'This floor'} highlighted
        </span>
      </div>

      <div className="flex flex-col-reverse gap-1 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-2">
        {stack.map((row) => (
          <motion.div
            key={row.key}
            layout
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={clsx(
              'flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-1.5 transition-colors duration-200',
              rowStyles[row.state],
            )}
          >
            <span
              className={clsx(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-xs)] px-1 text-[10px] font-bold tabular-nums',
                badgeStyles[row.state],
              )}
            >
              {row.floorNumber}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.label}</span>
            {typeof row.totalRooms === 'number' && (
              <span className="text-[10px] font-medium opacity-75">{row.totalRooms} rooms</span>
            )}
            {row.state === 'conflict' && (
              <AlertTriangle className="h-3 w-3 shrink-0" aria-label="Floor number conflict" />
            )}
          </motion.div>
        ))}
      </div>

      {conflict && (
        <p className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--color-danger-700)]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Floor number {current.floorNumber} already exists. Pick a different number.
        </p>
      )}
      {!conflict && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-[color:var(--color-text-muted)]">
          <Building2 className="h-3 w-3" />
          Positioned at floor number {current.floorNumber}.
        </p>
      )}
    </div>
  );
}