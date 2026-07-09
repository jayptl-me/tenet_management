'use client';

import { clsx } from 'clsx';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
export interface FormActionsProps {
  /** Submitting state for the primary button. */
  loading?: boolean;
  /** Primary action label. */
  submitLabel?: string;
  /** Cancel navigates back by default; pass href to push, or onCancel override. */
  cancelHref?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Hide cancel button. */
  hideCancel?: boolean;
  /** Extra actions rendered left of cancel/submit (e.g. Delete). */
  leading?: React.ReactNode;
  className?: string;
  /** When true, do not render a submit button (caller provides custom). */
  hideSubmit?: boolean;
  submitIcon?: React.ReactNode;
  /**
   * When false, skip top border/padding (use inside FormCard footer which already divides).
   * Default true for standalone use inside a form body.
   */
  divided?: boolean;
}

/**
 * Standard form footer: Cancel + Save with consistent spacing and tokens.
 */
export function FormActions({
  loading = false,
  submitLabel = 'Save Changes',
  cancelHref,
  onCancel,
  cancelLabel = 'Cancel',
  hideCancel = false,
  leading,
  className,
  hideSubmit = false,
  submitIcon,
  divided = true,
}: FormActionsProps) {
  const router = useRouter();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (cancelHref) {
      router.push(cancelHref);
      return;
    }
    router.back();
  };

  return (
    <div
      className={clsx(
        'flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center',
        divided && 'border-t border-[color:var(--border-color)] pt-5',
        className,
      )}
    >
      {leading && <div className="mr-auto flex items-center gap-2">{leading}</div>}
      {!hideCancel && (
        <Button variant="outline" type="button" onClick={handleCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      )}
      {!hideSubmit && (
        <Button type="submit" loading={loading}>
          {submitIcon ?? <Save className="h-4 w-4" />}
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
