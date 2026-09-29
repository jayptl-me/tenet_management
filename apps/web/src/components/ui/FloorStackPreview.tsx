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
      'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--border-color-hover)]',
    current:
      'border-[color:var(--badge-info-border)] bg-[color:var(--badge-info-bg)] text-[color:var(--badge-info-text)] ring-1 ring-[color:var(--badge-info-border)] shadow-[var(--shadow-xs)] font-bold',
    new: 'border-[color:var(--badge-success-border)] border-dashed bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)] font-bold',
    conflict:
      'border-[color:var(--badge-danger-border)] bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)] font-bold',
  };

  const badgeStyles: Record<string, string> = {
    existing:
      'border border-[color:var(--badge-neutral-border)] bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-text)]',
    current: 'bg-[color:var(--color-brand-500)] text-[color:var(--color-on-brand)]',
    new: 'bg-[color:var(--color-success-500)] text-[color:var(--color-on-success)]',
    conflict: 'bg-[color:var(--color-danger-500)] text-[color:var(--color-on-danger)]',
  };

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Building preview
        </p>
        <span className="text-[10px] font-semibold tracking-wide text-[color:var(--color-text-muted)] uppercase">
          {mode === 'new' ? 'New floor' : 'This floor'} highlighted
        </span>
      </div>

      <div className="flex flex-col-reverse gap-1.5 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-2.5 shadow-[var(--shadow-xs)]">
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
        <p className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[color:var(--badge-danger-border)] bg-[color:var(--badge-danger-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--badge-danger-text)]">
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
