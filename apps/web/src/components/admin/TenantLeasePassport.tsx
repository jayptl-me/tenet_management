'use client';

import { clsx } from 'clsx';
import { BedDouble, Building, KeyRound, Users, Sparkles } from 'lucide-react';
import { surfaceNestedClass } from '@/lib/field-styles';

export interface RoomOptionPassport {
  _id: string;
  roomNumber: string;
  floor?: { label: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantName?: string }>;
}

export interface TenantLeasePassportProps {
  room: RoomOptionPassport | null;
  selectedBedId?: string;
  moveInDate?: string;
  monthlyRent?: number;
  depositPaid?: number;
  tenantName?: string;
  tenantPhone?: string;
  className?: string;
}

export function TenantLeasePassport({
  room,
  selectedBedId,
  moveInDate,
  monthlyRent = 0,
  depositPaid = 0,
  tenantName,
  tenantPhone,
  className,
}: TenantLeasePassportProps) {
  const rent = monthlyRent || room?.monthlyRent || 0;
  const deposit = Number(depositPaid) || 0;
  const totalMoveIn = rent + deposit;

  const beds = room?.beds ?? [];
  const floorLabel = room?.floor?.label ?? 'Floor not specified';

  return (
    <div
      className={clsx(
        'sticky top-6 flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {/* ── Card Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-color)]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-600)]">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[color:var(--color-text-primary)]">
              Lease & Unit Passport
            </h3>
            <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              Real-time lease & roommate preview
            </p>
          </div>
        </div>

        {room && (
          <span className="rounded-full border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] px-2.5 py-0.5 text-[10px] font-bold text-[color:var(--color-success-700)]">
            Unit Selected
          </span>
        )}
      </div>

      {!room ? (
        /* ── Empty State ───────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]">
            <BedDouble className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            No Room Selected
          </p>
          <p className="mt-1 max-w-[220px] text-xs font-medium text-[color:var(--color-text-muted)]">
            Select a room from the form or bed matrix to view unit terms and roommate layout.
          </p>
        </div>
      ) : (
        /* ── Active Room Preview ────────────────────────────── */
        <div className="space-y-4">
          {/* Unit Specs Tile */}
          <div className={clsx(surfaceNestedClass, 'p-3.5')}>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                  Selected Room
                </span>
                <p className="font-mono text-xl font-bold text-[color:var(--color-text-primary)]">
                  Room {room.roomNumber}
                </p>
              </div>

              {selectedBedId && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
                    Assigned Bed
                  </span>
                  <span className="rounded-full bg-[color:var(--color-brand-500)] px-2.5 py-0.5 font-mono text-xs font-bold text-white shadow-sm">
                    Bed {selectedBedId}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[color:var(--border-color)]/60 pt-2 text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-text-secondary)]">
                <Building className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {floorLabel}
              </span>
              <span className="text-[color:var(--border-color)]">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-text-secondary)]">
                <Users className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {room.sharingType} Sharing
              </span>
            </div>
          </div>

          {/* Roommates & Bed Layout Matrix */}
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Room Bed Slots & Roommates
            </p>
            <div className="grid grid-cols-2 gap-2">
              {beds.map((bed) => {
                const isThisSlot = selectedBedId === bed.bedId;

                return (
                  <div
                    key={bed.bedId}
                    className={clsx(
                      'flex flex-col justify-between rounded-[var(--radius-md)] border p-2 text-left transition-all',
                      isThisSlot
                        ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)]/60 ring-1 ring-[color:var(--color-brand-500)]'
                        : bed.isOccupied
                          ? 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]'
                          : 'border-dashed border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)]/30',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)]">
                        Bed {bed.bedId}
                      </span>
                      <span
                        className={clsx(
                          'h-2 w-2 rounded-full',
                          isThisSlot
                            ? 'bg-[color:var(--color-brand-500)]'
                            : bed.isOccupied
                              ? 'bg-[color:var(--color-warning-500)]'
                              : 'bg-[color:var(--color-success-500)]',
                        )}
                      />
                    </div>

                    <div className="mt-1.5 truncate text-[11px]">
                      {isThisSlot ? (
                        <span className="font-bold text-[color:var(--color-brand-700)]">
                          {tenantName?.trim() ? tenantName : 'New Tenant'}
                        </span>
                      ) : bed.isOccupied ? (
                        <span className="font-medium text-[color:var(--color-text-secondary)]">
                          {bed.tenantName || 'Occupied'}
                        </span>
                      ) : (
                        <span className="font-medium text-[color:var(--color-success-700)]">
                          Vacant
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Financial Move-In Calculator */}
          <div className="border-t border-[color:var(--border-color)]/60 pt-3">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Move-In Financial Summary
            </p>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[color:var(--color-text-secondary)]">
                <span>Monthly Rent</span>
                <span className="font-mono font-semibold text-[color:var(--color-text-primary)]">
                  ₹{rent.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-[color:var(--color-text-secondary)]">
                <span>Security Deposit</span>
                <span className="font-mono font-semibold text-[color:var(--color-text-primary)]">
                  ₹{deposit.toLocaleString()}
                </span>
              </div>

              {moveInDate && (
                <div className="flex items-center justify-between text-[color:var(--color-text-secondary)]">
                  <span>Move-In Date</span>
                  <span className="font-mono font-medium text-[color:var(--color-text-primary)]">
                    {moveInDate}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[color:var(--border-color)]/60 pt-2 font-bold text-[color:var(--color-text-primary)]">
                <span className="text-xs">Total Due at Move-In</span>
                <span className="font-mono text-sm text-[color:var(--color-brand-600)]">
                  ₹{totalMoveIn.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Portal Credentials Notice */}
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/40 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-brand-600)]" />
              <div className="text-[11px]">
                <p className="font-semibold text-[color:var(--color-brand-800)]">
                  Instant Portal Provisioning
                </p>
                <p className="mt-0.5 text-[color:var(--color-brand-700)]">
                  Resident account will be provisioned with login identifier{' '}
                  <span className="font-mono font-semibold">
                    {tenantPhone?.trim() ? tenantPhone : 'tenant mobile'}
                  </span>
                  . Temporary password will be displayed upon save.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
