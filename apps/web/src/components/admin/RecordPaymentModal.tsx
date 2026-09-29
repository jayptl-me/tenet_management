'use client';

import { useState, useEffect } from 'react';
import {
  Wallet,
  Smartphone,
  Landmark,
  CircleDollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

export interface RecordPaymentTarget {
  tenantId: string;
  tenantName?: string;
  roomNumber?: string;
  invoiceId: string;
  invoiceNumber?: string;
  month?: string;
  totalAmount?: number;
  balance?: number;
}

export interface RecordPaymentModalProps {
  target: RecordPaymentTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const METHODS = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'other', label: 'Other', icon: CircleDollarSign },
] as const;

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RecordPaymentModal({
  target,
  isOpen,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [paidAt, setPaidAt] = useState(nowLocalDatetime());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const balance = target?.balance ?? 0;

  useEffect(() => {
    if (target) {
      setAmount(target.balance ?? 0);
      setMethod('cash');
      setPaidAt(nowLocalDatetime());
      setNotes('');
      setError('');
    }
  }, [target]);

  const remainingAfter = Math.max(0, balance - amount);
  const isOverpay = amount > balance + 0.001;

  const quickAmounts =
    balance > 0
      ? [
          { label: 'Full balance', value: balance },
          { label: '50%', value: Math.round((balance / 2) * 100) / 100 },
          { label: '₹1,000', value: 1000 },
          { label: '₹5,000', value: 5000 },
        ].filter((q) => q.value > 0 && q.value <= balance)
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const d = new Date(paidAt);
      const paidAtIso = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();

      await api.post('payments/offline', {
        json: {
          tenantId: target.tenantId,
          invoiceId: target.invoiceId,
          amount,
          method,
          paidAt: paidAtIso,
          notes: notes.trim() || undefined,
        },
      }).json();

      toast.success(`Payment of ${fmtMoney(amount)} recorded successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !target) return null;

  return (
    <Modal
      open={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Record Payment"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-3 text-xs font-semibold text-[color:var(--color-danger-800)]">
            {error}
          </div>
        )}

        {/* Invoice context card */}
        <div className={clsx(surfaceNestedClass, 'rounded-[var(--radius-lg)] p-4 space-y-2')}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
                {target.tenantName ?? 'Tenant'}
              </p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                {target.roomNumber ? `Room ${target.roomNumber}` : ''}
                {target.invoiceNumber ? ` · ${target.invoiceNumber}` : ''}
                {target.month ? ` (${target.month})` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                Balance Due
              </p>
              <p className="font-display text-base font-bold text-[color:var(--color-danger-700)] tabular-nums">
                {fmtMoney(balance)}
              </p>
            </div>
          </div>
        </div>

        {/* Payment method selector */}
        <div>
          <label className="block text-xs font-semibold text-[color:var(--color-text-secondary)] mb-1.5">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const isSelected = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border p-2.5 text-center transition-all',
                    isSelected
                      ? 'border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-900)]'
                      : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] hover:bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]',
                  )}
                >
                  <Icon className={clsx('h-4 w-4', isSelected ? 'text-[color:var(--color-brand-600)]' : 'text-[color:var(--color-text-muted)]')} />
                  <span className="text-xs font-semibold">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount input & quick chips */}
        <div>
          <label htmlFor="modal-payment-amount" className="block text-xs font-semibold text-[color:var(--color-text-secondary)] mb-1">
            Amount (₹)
          </label>
          <Input
            id="modal-payment-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount === 0 ? '' : amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            placeholder="0.00"
            required
          />

          {quickAmounts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickAmounts.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setAmount(q.value)}
                  className={clsx(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                    amount === q.value
                      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-900)]'
                      : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-field-bg)]',
                  )}
                >
                  {q.label} ({fmtMoney(q.value)})
                </button>
              ))}
            </div>
          )}

          {isOverpay && (
            <p className="mt-1 text-[11px] text-[color:var(--color-warning-700)]">
              Note: Payment amount exceeds current balance ({fmtMoney(balance)}). Excess will be credited.
            </p>
          )}
        </div>

        {/* Payment date */}
        <div>
          <label htmlFor="modal-payment-date" className="block text-xs font-semibold text-[color:var(--color-text-secondary)] mb-1">
            Payment Date & Time
          </label>
          <Input
            id="modal-payment-date"
            type="datetime-local"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="modal-payment-notes" className="block text-xs font-semibold text-[color:var(--color-text-secondary)] mb-1">
            Notes (optional)
          </label>
          <Textarea
            id="modal-payment-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cheque number, counter remark, or offline receipt reference..."
          />
        </div>

        {/* Live balance reconciliation summary */}
        <div className="flex items-center justify-between border-t border-[color:var(--border-color)] pt-3 text-xs">
          <span className="text-[color:var(--color-text-muted)] font-medium">Remaining balance after:</span>
          <span className={clsx('font-bold tabular-nums', remainingAfter === 0 ? 'text-[color:var(--color-success-600)]' : 'text-[color:var(--color-text-primary)]')}>
            {remainingAfter === 0 ? 'Fully settled (₹0)' : fmtMoney(remainingAfter)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--border-color)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || amount <= 0}>
            {isSubmitting ? 'Recording...' : `Record ${fmtMoney(amount)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
