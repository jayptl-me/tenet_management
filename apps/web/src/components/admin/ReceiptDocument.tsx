'use client';

import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface ReceiptLine {
  label: string;
  value: string;
  mono?: boolean;
}

export interface ReceiptDocumentProps {
  title: string;
  reference: string;
  statusLabel: string;
  amount: string;
  lines: ReceiptLine[];
  notes?: string;
  footerNote?: string;
  className?: string;
  /** Hides on-screen action buttons (used when embedded elsewhere). */
  showActions?: boolean;
  onPrint?: () => void;
  onClose?: () => void;
}

// ── Component ──────────────────────────────────────────

/**
 * Print-optimized receipt document. `window.print()` prints ONLY this
 * subtree (globals.css hides everything else via .receipt-print-area).
 */
export function ReceiptDocument({
  title,
  reference,
  statusLabel,
  amount,
  lines,
  notes,
  footerNote,
  className,
  showActions = true,
  onPrint,
  onClose,
}: ReceiptDocumentProps) {
  return (
    <div className={clsx('receipt-print-area', className)}>
      <div
        className={clsx(
          surfaceCardClass,
          'overflow-hidden',
        )}
      >
        {/* Receipt head */}
        <div className="border-b border-[color:var(--border-color)] px-6 pt-6 pb-4 text-center">
          <p className="font-display text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {title}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)]">
            {reference}
          </p>
          <p className="font-display mt-4 text-3xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
            {amount}
          </p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-secondary)]">
            {statusLabel}
          </p>
        </div>

        {/* Receipt body */}
        <dl className="divide-y divide-[color:var(--border-color)] px-6">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                {line.label}
              </dt>
              <dd
                className={clsx(
                  'text-right text-[13px] font-semibold text-[color:var(--color-text-primary)]',
                  line.mono && 'font-mono text-xs',
                )}
              >
                {line.value}
              </dd>
            </div>
          ))}
        </dl>

        {notes && (
          <div className="border-t border-[color:var(--border-color)] px-6 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-[color:var(--color-text-muted)] uppercase">
              Notes
            </p>
            <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
              {notes}
            </p>
          </div>
        )}

        {footerNote && (
          <p className="border-t border-[color:var(--border-color)] px-6 py-3 text-center text-[11px] text-[color:var(--color-text-muted)]">
            {footerNote}
          </p>
        )}

        {showActions && (
          <div className="receipt-print-no-print flex justify-end gap-2 border-t border-[color:var(--border-color)] px-6 py-4">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
            {onPrint && (
              <Button variant="primary" onClick={onPrint}>
                Print / Save PDF
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
