'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, ImageOff, ShieldCheck, X } from 'lucide-react';
import { modalContent } from '@/lib/animations';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

// ── Types ──────────────────────────────────────────────

export interface VerifyPaymentTarget {
  _id: string;
  tenantName?: string;
  roomNumber?: string;
  amount: number;
  utrNumber?: string;
  screenshotUrl?: string;
  paidAt?: string;
  createdAt?: string;
  status: string;
  invoiceNumber?: string;
  month?: string;
}

export interface VerifyPaymentModalProps {
  target: VerifyPaymentTarget | null;
  loading: boolean;
  onDecide: (approved: boolean, notes: string) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDateTime(s?: string): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Shared UTR verification modal: evidence block, screenshot preview, notes. */
export function VerifyPaymentModal({
  target,
  loading,
  onDecide,
  onClose,
}: VerifyPaymentModalProps) {
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (target) {
      setNotes('');
      setCopied(false);
      setImgFailed(false);
      setZoom(false);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && !zoom) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, loading, zoom, onClose]);

  const copyUtr = async () => {
    if (!target?.utrNumber) return;
    try {
      await navigator.clipboard.writeText(target.utrNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — user can select manually
    }
  };

  return (
    <AnimatePresence>
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={loading || zoom ? undefined : onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-modal-title"
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="verify-modal-title"
                    className="font-display text-[15px] font-bold tracking-tight text-[color:var(--color-text-primary)]"
                  >
                    Verify UPI payment
                  </h3>
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                    {target.tenantName ?? 'Tenant'}
                    {target.roomNumber ? ` · Room ${target.roomNumber}` : ''}
                    {target.invoiceNumber ? ` · ${target.invoiceNumber}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-primary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Evidence block */}
            <dl className="mt-4 space-y-2 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[color:var(--color-text-muted)]">Amount</dt>
                <dd className="font-display text-base font-bold text-[color:var(--color-text-primary)] tabular-nums">
                  {fmtMoney(target.amount)}
                </dd>
              </div>
              {target.utrNumber && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium text-[color:var(--color-text-muted)]">UTR</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold tracking-wide text-[color:var(--color-brand-700)]">
                      {target.utrNumber}
                    </span>
                    <button
                      type="button"
                      onClick={copyUtr}
                      className="rounded p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-primary)]"
                      aria-label="Copy UTR"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[color:var(--color-success-600)]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[color:var(--color-text-muted)]">Submitted</dt>
                <dd className="text-xs font-semibold text-[color:var(--color-text-primary)]">
                  {fmtDateTime(target.paidAt || target.createdAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[color:var(--color-text-muted)]">Status</dt>
                <dd>
                  <StatusBadge
                    variant={statusToVariant(target.status)}
                    label={target.status.replace(/_/g, ' ')}
                  />
                </dd>
              </div>
            </dl>

            {/* Screenshot preview */}
            {target.screenshotUrl && !imgFailed && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.01em] text-[color:var(--color-text-secondary)]">
                  Payment screenshot
                </p>
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="block w-full overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] transition-opacity hover:opacity-90"
                  aria-label="Open screenshot full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={target.screenshotUrl}
                    alt="Payment screenshot"
                    className="max-h-48 w-full object-cover"
                    onError={() => setImgFailed(true)}
                  />
                </button>
              </div>
            )}
            {target.screenshotUrl && imgFailed && (
              <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3 text-xs font-medium text-[color:var(--color-text-muted)]">
                <ImageOff className="h-4 w-4" />
                Screenshot unavailable — verify against your bank statement UTR.
              </div>
            )}
            {!target.screenshotUrl && (
              <p className="mt-3 text-xs font-medium text-[color:var(--color-text-muted)]">
                No screenshot attached. Cross-check the UTR against your bank statement before
                approving.
              </p>
            )}

            {/* Notes */}
            <div className="mt-4">
              <label
                htmlFor="verify-notes"
                className="mb-1 block text-[13px] font-semibold text-[color:var(--color-text-primary)]"
              >
                Verification note <span className="font-normal text-[color:var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                id="verify-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bank statement matched"
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-field-border)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm font-medium text-[color:var(--color-text-primary)] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--border-color-focus)] focus:bg-[color:var(--color-card-bg)] focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" disabled={loading} onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={loading}
                onClick={() => onDecide(false, notes.trim())}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="primary"
                disabled={loading}
                loading={loading}
                onClick={() => onDecide(true, notes.trim())}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </div>
          </motion.div>

          {/* Full-size screenshot */}
          <AnimatePresence>
            {zoom && target.screenshotUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
                onClick={() => setZoom(false)}
                role="dialog"
                aria-label="Payment screenshot full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={target.screenshotUrl}
                  alt="Payment screenshot full size"
                  className="max-h-full max-w-full rounded-[var(--radius-lg)] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setZoom(false)}
                  className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  aria-label="Close screenshot"
                >
                  <X className="h-5 w-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
