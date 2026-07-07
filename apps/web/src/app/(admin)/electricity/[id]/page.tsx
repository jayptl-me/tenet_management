'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface ElectricityBillDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { name: string } };
  };
  unitsConsumed: number;
  ratePerUnit: number;
  totalAmount: number;
  billingMonth: string;
  status: string;
  meterReading?: { previous?: number; current?: number };
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function ElectricityBillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<ElectricityBillDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchBill() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`electricity/${params.id}`)
          .json<{ success: boolean; data: ElectricityBillDetail }>();
        setBill(res.data);
      } catch {
        setError('Failed to load electricity bill details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchBill();
  }, [params.id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !bill) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Electricity bill not found'}</p>
        </div>
      </div>
    );
  }

  const tenantName = bill.tenant?.user?.name ?? 'N/A';
  const roomNumber = bill.tenant?.room?.roomNumber ?? 'N/A';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Electricity Bill
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">{bill.billingMonth}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(bill.status)}
          label={bill.status.replace(/_/g, ' ')}
        />
      </motion.div>

      {/* ── Main detail cards ──────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bill details */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Bill Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Billing Month
              </p>
              <p className="mt-1 text-base font-semibold text-[color:var(--color-text-primary)]">{bill.billingMonth}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Units Consumed
              </p>
              <p className="mt-1 text-base font-bold text-[color:var(--color-text-primary)]">
                {bill.unitsConsumed}{' '}
                <span className="text-sm font-normal text-[color:var(--color-text-muted)]">kWh</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Rate Per Unit
              </p>
              <p className="mt-1 text-base font-semibold text-[color:var(--color-text-primary)]">
                ₹{bill.ratePerUnit.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Total Amount
              </p>
              <p className="mt-1 text-base font-bold text-[color:var(--color-text-primary)]">
                ₹{bill.totalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge
                  variant={statusToVariant(bill.status)}
                  label={bill.status.replace(/_/g, ' ')}
                />
              </div>
            </div>
            {bill.dueDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Due Date
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {new Date(bill.dueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
            {bill.paidDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Paid Date
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--color-success-700)]">
                  {new Date(bill.paidDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Meter readings */}
          {bill.meterReading && (
            <div className="mt-6 border-t border-[color:var(--color-surface-200)] pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Meter Readings
              </p>
              <div className="flex gap-8">
                {bill.meterReading.previous !== undefined && (
                  <div>
                    <span className="text-sm text-[color:var(--color-text-muted)]">Previous:</span>{' '}
                    <span className="font-semibold text-[color:var(--color-text-primary)]">
                      {bill.meterReading.previous} kWh
                    </span>
                  </div>
                )}
                {bill.meterReading.current !== undefined && (
                  <div>
                    <span className="text-sm text-[color:var(--color-text-muted)]">Current:</span>{' '}
                    <span className="font-semibold text-[color:var(--color-text-primary)]">
                      {bill.meterReading.current} kWh
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Usage summary card */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[color:var(--color-warning-500)]" />
            <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">Usage Summary</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Units
              </p>
              <p className="mt-1 text-3xl font-bold text-[color:var(--color-text-primary)]">{bill.unitsConsumed}</p>
              <p className="text-sm text-[color:var(--color-text-muted)]">kilowatt-hours</p>
            </div>
            <div className="border-t border-[color:var(--color-warning-200)] pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Total Bill
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-text-primary)]">
                ₹{bill.totalAmount.toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Tenant info card ────────────────────── */}
      {bill.tenant && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Tenant Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Name
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-primary)]">{tenantName}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Room
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-primary)]">{roomNumber}</p>
            </div>
            {bill.tenant.user?.email && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Email
                </p>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{bill.tenant.user.email}</p>
              </div>
            )}
            {bill.tenant.user?.phone && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Phone
                </p>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{bill.tenant.user.phone}</p>
              </div>
            )}
            {bill.tenant.room?.floor?.name && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Floor
                </p>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{bill.tenant.room.floor.name}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Notes ──────────────────────────────── */}
      {bill.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)]">Notes</h3>
          <p className="text-sm text-[color:var(--color-text-secondary)]">{bill.notes}</p>
        </motion.div>
      )}

      {/* ── Meta ────────────────────────────────── */}
      {bill.updatedAt && (
        <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
          Last updated: {new Date(bill.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </motion.div>
  );
}