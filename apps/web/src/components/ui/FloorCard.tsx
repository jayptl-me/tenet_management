'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import {
  DoorOpen,
  BedDouble,
  Users,
  AlertTriangle,
  Wrench,
  IndianRupee,
  ChevronRight,
} from 'lucide-react';
import { fadeScaleIn } from '@/lib/animations';
import { TableActions } from '@/components/ui/TableActions';
import { BedMiniGrid, type BedMini } from '@/components/ui/BedMiniGrid';

// ── Types ──────────────────────────────────────────────

export interface FloorCardServiceSummary {
  operational: number;
  degraded: number;
  down: number;
  openComplaints: number;
}

export interface FloorCardProps {
  label: string;
  floorNumber: number;
  totalRooms: number;
  activeRooms: number;
  beds: BedMini[];
  potentialRent: number;
  services: FloorCardServiceSummary;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function FloorCard({
  label,
  floorNumber,
  totalRooms,
  activeRooms,
  beds,
  potentialRent,
  services,
  onView,
  onEdit,
  onDelete,
  className,
}: FloorCardProps) {
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.isOccupied).length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const occupancyFill =
    occupancyPct >= 100
      ? 'bg-[color:var(--color-danger-500)]'
      : occupancyPct >= 90
        ? 'bg-[color:var(--color-warning-500)]'
        : 'bg-[color:var(--color-success-500)]';
  const hasServiceIssues = services.degraded + services.down > 0;

  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)]',
        'border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)]',
        'transition-[border-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
        'hover:border-[color:var(--color-field-border-hover)] hover:shadow-[var(--shadow-card-hover)]',
        onView && 'cursor-pointer',
        className,
      )}
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-1.5 text-xs font-bold tabular-nums text-[color:var(--color-text-secondary)]">
              F{floorNumber}
            </span>
            <h3 className="truncate text-[15px] font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {label}
            </h3>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
            <DoorOpen className="h-3 w-3" />
            {activeRooms}
            {activeRooms !== totalRooms ? ` of ${totalRooms} rooms active` : ' rooms'}
            {hasServiceIssues && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--color-danger-700)]">
                <AlertTriangle className="h-2.5 w-2.5" />
                {services.down + services.degraded} service issue
                {services.down + services.degraded !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div
          className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <TableActions onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Occupancy */}
      <div className="space-y-2 px-5 pb-3">
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3 w-3 text-[color:var(--color-text-muted)]" />
            {occupiedBeds}/{totalBeds} beds
          </span>
          <span className="tabular-nums">{occupancyPct}% occupied</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', occupancyFill)}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <BedMiniGrid beds={beds} maxVisible={14} />
      </div>

      {/* Footer stats */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-5 py-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-[color:var(--color-text-secondary)]">
          <IndianRupee className="h-3 w-3 text-[color:var(--color-success-600)]" />
          {formatCurrency(potentialRent)}
          <span className="font-medium text-[color:var(--color-text-muted)]">/mo potential</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--color-text-secondary)]">
          <Users className="h-3 w-3 text-[color:var(--color-text-muted)]" />
          {occupiedBeds} tenants
          <Wrench className="ml-1.5 h-3 w-3 text-[color:var(--color-text-muted)]" />
          {services.operational}/{services.operational + services.degraded + services.down}
          {onView && (
            <ChevronRight className="ml-0.5 h-3 w-3 text-[color:var(--color-text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[color:var(--color-text-primary)]" />
          )}
        </span>
      </div>
    </motion.div>
  );
}

// ── Helpers ────────────────────────────────────────────

function formatCurrency(amount: number): string {
  try {
    return `\u20B9${amount.toLocaleString('en-IN')}`;
  } catch {
    return `\u20B9${amount}`;
  }
}
