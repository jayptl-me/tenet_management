'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  if (!open) return null;

  const variantClasses = {
    danger: 'bg-danger-500 hover:bg-danger-600',
    warning: 'bg-warning-500 hover:bg-warning-600',
    info: 'bg-brand-500 hover:bg-brand-600',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-fade-in-up mx-4 w-full max-w-md rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-100">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <h3 className="font-display text-surface-900 text-lg font-bold">{title}</h3>
              <p className="text-surface-500 mt-1 text-sm">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-surface-400 hover:text-surface-600 -mt-1 -mr-1 rounded-md p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            className={variantClasses[variant]}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
