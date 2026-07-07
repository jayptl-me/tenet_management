'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="space-y-6">
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Electricity bill not found'}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const tenantName = bill.tenant?.user?.name ?? 'N/A';
  const roomNumber = bill.tenant?.room?.roomNumber ?? 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              Electricity Bill
            </h2>
            <p className="text-surface-500 mt-0.5 text-sm">{bill.billingMonth}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(bill.status)}
          label={bill.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Main detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bill details */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Bill Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Billing Month
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">{bill.billingMonth}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Units Consumed
              </p>
              <p className="text-surface-900 mt-1 text-base font-bold">
                {bill.unitsConsumed}{' '}
                <span className="text-surface-500 text-sm font-normal">kWh</span>
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Rate Per Unit
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">
                ₹{bill.ratePerUnit.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Total Amount
              </p>
              <p className="text-surface-900 mt-1 text-base font-extrabold">
                ₹{bill.totalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Status
              </p>
              <p className="mt-1">
                <StatusBadge
                  variant={statusToVariant(bill.status)}
                  label={bill.status.replace(/_/g, ' ')}
                />
              </p>
            </div>
            {bill.dueDate && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Due Date
                </p>
                <p className="text-surface-900 mt-1 text-sm font-semibold">
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
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Paid Date
                </p>
                <p className="text-success-700 mt-1 text-sm font-semibold">
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
            <div className="border-[color:var(--color-surface-200)] mt-6 border-t-2 pt-4">
              <p className="text-surface-500 mb-2 text-xs font-semibold uppercase tracking-wider">
                Meter Readings
              </p>
              <div className="flex gap-8">
                {bill.meterReading.previous !== undefined && (
                  <div>
                    <span className="text-surface-500 text-sm">Previous:</span>{' '}
                    <span className="text-surface-900 font-semibold">
                      {bill.meterReading.previous} kWh
                    </span>
                  </div>
                )}
                {bill.meterReading.current !== undefined && (
                  <div>
                    <span className="text-surface-500 text-sm">Current:</span>{' '}
                    <span className="text-surface-900 font-semibold">
                      {bill.meterReading.current} kWh
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Usage summary card */}
        <div className="bg-warning-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="text-warning-600 h-5 w-5" />
            <h3 className="font-display text-surface-900 text-lg font-extrabold">Usage Summary</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Units
              </p>
              <p className="text-surface-900 mt-1 text-3xl font-extrabold">{bill.unitsConsumed}</p>
              <p className="text-surface-500 text-sm">kilowatt-hours</p>
            </div>
            <div className="border-warning-200 border-t-2 pt-3">
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Total Bill
              </p>
              <p className="text-surface-900 mt-1 text-2xl font-extrabold">
                ₹{bill.totalAmount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant info card */}
      {bill.tenant && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Tenant Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Name
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold">{tenantName}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Room
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold">{roomNumber}</p>
            </div>
            {bill.tenant.user?.email && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Email
                </p>
                <p className="text-surface-700 mt-1 text-sm">{bill.tenant.user.email}</p>
              </div>
            )}
            {bill.tenant.user?.phone && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Phone
                </p>
                <p className="text-surface-700 mt-1 text-sm">{bill.tenant.user.phone}</p>
              </div>
            )}
            {bill.tenant.room?.floor?.name && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Floor
                </p>
                <p className="text-surface-700 mt-1 text-sm">{bill.tenant.room.floor.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {bill.notes && (
        <div className="bg-surface-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-2 text-lg font-extrabold">Notes</h3>
          <p className="text-surface-700 text-sm">{bill.notes}</p>
        </div>
      )}

      {/* Meta */}
      {bill.updatedAt && (
        <p className="text-surface-400 text-right text-xs">
          Last updated: {new Date(bill.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
