'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, XCircle, X, Wrench, ShieldAlert } from 'lucide-react';
import { modalContent } from '@/lib/animations';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';

export interface QuickResolveTarget {
  _id: string;
  title: string;
  tenantName?: string;
  roomNumber?: string;
  category: string;
  priority: string;
  status: string;
  adminNotes?: string;
}

export interface QuickResolveModalProps {
  target: QuickResolveTarget | null;
  loading?: boolean;
  onResolve: (
    id: string,
    status: 'resolved' | 'dismissed',
    adminNotes: string,
  ) => Promise<void> | void;
  onClose: () => void;
}

export function QuickResolveModal({
  target,
  loading = false,
  onResolve,
  onClose,
}: QuickResolveModalProps) {
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [adminNotes, setAdminNotes] = useState(() => target?.adminNotes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevTarget, setPrevTarget] = useState(target);

  // Reset the form when a new complaint is targeted (render-time adjustment
  // instead of an effect).
  if (prevTarget !== target) {
    setPrevTarget(target);
    if (target) {
      setResolutionStatus('resolved');
      setAdminNotes(target.adminNotes ?? '');
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, loading, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setIsSubmitting(true);
    try {
      await onResolve(target._id, resolutionStatus, adminNotes.trim());
    } finally {
      setIsSubmitting(false);
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
            onClick={loading || isSubmitting ? undefined : onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-resolve-title"
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="quick-resolve-title"
                    className="font-display text-base font-bold tracking-tight text-[color:var(--color-text-primary)]"
                  >
                    Quick Resolve Complaint
                  </h3>
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Update ticket status and log maintenance resolution notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading || isSubmitting}
                className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-primary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Ticket Context Card */}
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display line-clamp-2 text-sm font-bold text-[color:var(--color-text-primary)]">
                  {target.title}
                </p>
                <StatusBadge
                  variant={statusToVariant(target.priority)}
                  label={target.priority}
                  className="shrink-0 text-[10px]"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--color-text-muted)]">
                <span className="font-semibold text-[color:var(--color-text-primary)]">
                  {target.tenantName ?? 'Resident'}
                </span>
                {target.roomNumber && (
                  <>
                    <span>·</span>
                    <span>Room {target.roomNumber}</span>
                  </>
                )}
                <span>·</span>
                <span className="capitalize">{target.category.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Resolution Action Toggle */}
              <div>
                <label className="mb-2 block text-xs font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                  Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResolutionStatus('resolved')}
                    className={`flex flex-col items-start rounded-[var(--radius-lg)] border p-3 text-left transition-all ${
                      resolutionStatus === 'resolved'
                        ? 'border-[color:var(--color-success-500)] bg-[color:var(--color-success-50)] text-[color:var(--color-success-900)] shadow-sm ring-1 ring-[color:var(--color-success-500)]'
                        : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-field-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          resolutionStatus === 'resolved'
                            ? 'text-[color:var(--color-success-600)]'
                            : 'text-[color:var(--color-text-muted)]'
                        }`}
                      />
                      Mark as Resolved
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
                      Issue fixed and inspected
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionStatus('dismissed')}
                    className={`flex flex-col items-start rounded-[var(--radius-lg)] border p-3 text-left transition-all ${
                      resolutionStatus === 'dismissed'
                        ? 'border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-900)] shadow-sm ring-1 ring-[color:var(--color-danger-500)]'
                        : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-field-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <XCircle
                        className={`h-4 w-4 ${
                          resolutionStatus === 'dismissed'
                            ? 'text-[color:var(--color-danger-600)]'
                            : 'text-[color:var(--color-text-muted)]'
                        }`}
                      />
                      Dismiss / Reject
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
                      Duplicate or invalid request
                    </p>
                  </button>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <Textarea
                  id="adminNotes"
                  label="Resolution & Vendor Notes"
                  rows={3}
                  placeholder={
                    resolutionStatus === 'resolved'
                      ? 'e.g. Electrician replaced MCB, technician verified WiFi AP throughput...'
                      : 'e.g. Duplicate of complaint #24; user advised to reboot device...'
                  }
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  helperText="Logged to complaint history and notified to the resident."
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-color)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={loading || isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant={resolutionStatus === 'resolved' ? 'primary' : 'danger'}
                  loading={loading || isSubmitting}
                  disabled={loading || isSubmitting}
                >
                  {resolutionStatus === 'resolved' ? (
                    <>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Resolve Ticket
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                      Dismiss Ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
