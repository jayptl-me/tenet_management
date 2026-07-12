'use client';

import { useState } from 'react';
import { KeyRound, Copy, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalContent } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────

interface TempCredentialsDialogProps {
  open: boolean;
  temporaryPassword: string | null;
  onClose: () => void;
  entityLabel?: string;
}

// ── Component ──────────────────────────────────────────

export function TempCredentialsDialog({
  open,
  temporaryPassword,
  onClose,
  entityLabel = 'Tenant',
}: TempCredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts
    }
  };

  return (
    <AnimatePresence>
      {open && temporaryPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-600)]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[color:var(--color-text-primary)]">
                    {entityLabel} created
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-secondary)]">
                    A login account was created for this {entityLabel.toLowerCase()}.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-secondary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Warning + password display */}
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-4">
              <p className="text-[13px] font-semibold text-[color:var(--color-warning-800)]">
                Share this temporary password once. It will not be shown again.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-[var(--radius-md)] border border-[color:var(--color-warning-200)] bg-[color:var(--color-card-bg)] px-3 py-2.5 font-mono text-base font-bold tracking-wide text-[color:var(--color-text-primary)]">
                  {temporaryPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  animate={false}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
