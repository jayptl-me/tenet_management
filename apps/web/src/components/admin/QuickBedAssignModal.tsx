'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bed, X, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { modalContent } from '@/lib/animations';
import { Button } from '@/components/ui/Button';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';

export interface BedAssignTarget {
  roomId: string;
  roomNumber: string;
  bedId: string;
}

interface TenantItem extends Record<string, unknown> {
  _id: string;
  user?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  name?: string;
  bedId?: string;
  room?: {
    _id?: string;
    roomNumber?: string;
  };
  isActive?: boolean;
}

export interface QuickBedAssignModalProps {
  target: BedAssignTarget | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickBedAssignModal({ target, onClose, onSuccess }: QuickBedAssignModalProps) {
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [prevTarget, setPrevTarget] = useState(target);

  // Reset the form when a new bed is targeted (render-time adjustment instead
  // of an effect so the first interaction never sees stale values).
  if (prevTarget !== target) {
    setPrevTarget(target);
    if (target) {
      setSelectedTenantId('');
      setError('');
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !selectedTenantId) return;

    setIsSubmitting(true);
    setError('');

    try {
      await api
        .put(`tenants/${selectedTenantId}`, {
          json: {
            roomId: target.roomId,
            bedId: target.bedId,
          },
        })
        .json();

      onSuccess();
      onClose();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || 'Failed to assign tenant to bed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bed-assign-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-color)] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-brand-600)]">
                  <Bed className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="bed-assign-modal-title"
                    className="font-display text-lg font-bold text-[color:var(--color-text-primary)]"
                  >
                    Assign Bed Allocation
                  </h2>
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                    Allocate an existing tenant to Room {target.roomNumber} · Bed {target.bedId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-3 text-xs font-semibold text-[color:var(--color-danger-700)]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Target summary banner */}
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">
                    Target Location
                  </span>
                  <span className="font-mono font-bold text-[color:var(--color-brand-600)]">
                    Room {target.roomNumber} &middot; Bed {target.bedId}
                  </span>
                </div>
              </div>

              {/* Tenant Search Selector */}
              <div>
                <ResourceSelect<TenantItem>
                  label="Select Tenant to Assign"
                  endpoint="tenants"
                  value={selectedTenantId}
                  onChange={(val) => setSelectedTenantId(val)}
                  placeholder="Search active or unallocated tenants..."
                  valueKey="_id"
                  labelKey={(item) =>
                    item.user?.name
                      ? `${item.user.name}${item.user.phone ? ` (${item.user.phone})` : ''}`
                      : item.name || 'Tenant'
                  }
                  sublabelFn={(item) =>
                    item.room?.roomNumber
                      ? `Currently: Room ${item.room.roomNumber} · Bed ${item.bedId ?? '--'}`
                      : 'Unassigned / Needs Bed'
                  }
                  helperText="Assigning will transfer this resident and update room occupancy atomically."
                />
              </div>

              <div className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3 text-xs text-[color:var(--color-text-secondary)]">
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-brand-600)]" />
                  <span>
                    The tenant will immediately see this room, bed layout, roommate list, and room
                    appliances on their mobile resident app.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-color)] pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={!selectedTenantId || isSubmitting}
                >
                  <UserCheck className="mr-1.5 h-4 w-4" />
                  Confirm Bed Assignment
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
