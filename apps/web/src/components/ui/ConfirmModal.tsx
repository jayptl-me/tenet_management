'use client';

import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalContent } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Style Maps ─────────────────────────────────────────

const iconStyles: Record<string, string> = {
  danger: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-600)]',
  warning: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-600)]',
  info: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-600)]',
};

const confirmVariant: Record<string, 'danger' | 'primary'> = {
  danger: 'danger',
  warning: 'danger',
  info: 'primary',
};

// ── Component ──────────────────────────────────────────

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay — fades in from transparent */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Panel */}
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative z-10 mx-4 w-full max-w-md rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconStyles[variant]}`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[color:var(--color-text-primary)]">
                    {title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-secondary)]">
                    {message}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="flex-shrink-0 rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-secondary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button variant={confirmVariant[variant]} onClick={onConfirm} loading={loading}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
