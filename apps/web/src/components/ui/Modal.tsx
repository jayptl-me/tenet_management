'use client';

import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { modalContent } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Max width class, e.g. 'max-w-md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Disable close affordances while a submit is in flight. */
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

// ── Component ──────────────────────────────────────────

/** Shared themed modal shell: overlay, panel, header, footer slot. */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  loading = false,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`relative z-10 max-h-[90vh] w-full ${SIZE[size]} overflow-y-auto rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-modal)]`}
          >
            {(title || !loading) && (
              <div className="flex items-start justify-between gap-3 px-6 pt-5">
                <div>
                  {title && (
                    <h3
                      id="modal-title"
                      className="font-display text-[15px] font-bold tracking-tight text-[color:var(--color-text-primary)]"
                    >
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="mt-0.5 text-xs font-medium text-[color:var(--color-text-muted)]">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-color)] px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
