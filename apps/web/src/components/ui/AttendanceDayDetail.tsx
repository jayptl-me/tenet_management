'use client';

import { clsx } from 'clsx';
import { Clock, UserRound } from 'lucide-react';
import { StatusBadge, statusToVariant } from './StatusBadge';
import { TableActions } from './TableActions';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';

export interface AttendanceDayRecord {
  _id: string;
  date: string;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string;
  tenant?: {
    _id?: string;
    user?: { name?: string } | null;
    room?: { roomNumber?: string } | null;
  } | null;
  tenantId?: unknown;
}

interface AttendanceDayDetailProps {
  date: string | null;
  records?: AttendanceDayRecord[];
  isLoading?: boolean;
  onViewRecord?: (id: string) => void;
  onEditRecord?: (id: string) => void;
  className?: string;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '--:--';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

export function AttendanceDayDetail({
  date,
  records = [],
  isLoading = false,
  onViewRecord,
  onEditRecord,
  className,
}: AttendanceDayDetailProps) {
  if (!date) return null;

  const title = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={clsx(
        'rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4',
        className,
      )}
      role="region"
      aria-label={`Attendance details for ${date}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
          {title}
        </p>
        <span className="text-xs font-semibold text-[color:var(--color-text-muted)]">
          {isLoading ? 'Loading...' : `${records.length} record${records.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]"
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          No attendance records on this day.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {records.map((r) => {
            const tenantName = tenantDisplayName(
              (r.tenant ?? r.tenantId) as unknown as Parameters<typeof tenantDisplayName>[0],
            );
            const roomNumber = tenantRoomNumber(
              (r.tenant ?? r.tenantId) as unknown as Parameters<typeof tenantRoomNumber>[0],
            );
            const inTime = formatTime(r.checkInTime ?? r.checkIn ?? null);
            const outTime = formatTime(r.checkOutTime ?? r.checkOut ?? null);
            return (
              <li
                key={r._id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--color-text-primary)]">
                    <UserRound className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    <span className="truncate">{tenantName}</span>
                    <span className="font-semibold text-[color:var(--color-text-muted)]">
                      Room {roomNumber}
                    </span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    In {inTime} - Out {outTime}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant={statusToVariant(r.status)}
                    label={r.status ? r.status.replace(/_/g, ' ') : 'Unknown'}
                  />
                  <TableActions
                    showView={!!onViewRecord}
                    onView={onViewRecord ? () => onViewRecord(r._id) : undefined}
                    showEdit={!!onEditRecord}
                    onEdit={onEditRecord ? () => onEditRecord(r._id) : undefined}
                    showDelete={false}
                    size="sm"
                    compact={false}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AttendanceDayDetail;
