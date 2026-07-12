'use client';

import { useState } from 'react';
import { CheckCircle, LogIn, LogOut, Ban } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface VisitorLifecycleActionsProps {
  visitorId: string;
  status: string;
  onAction: (action: string) => Promise<void>;
  size?: 'sm' | 'md';
}

type VisitorAction = 'arrive' | 'depart' | 'cancel' | 'approve';

/**
 * Context-appropriate lifecycle action buttons for a visitor.
 *
 * Status -> visible actions:
 *   expected  -> Mark Arrived, Cancel
 *   arrived   -> Mark Departed
 *   departed  -> (none)
 *   cancelled -> Re-approve
 *
 * The component manages per-button loading/disabled state internally.
 * The parent supplies `onAction`, which performs the API call and
 * refreshes visitor data.
 */
export function VisitorLifecycleActions({
  status,
  onAction,
  size = 'md',
}: VisitorLifecycleActionsProps) {
  const [loadingAction, setLoadingAction] = useState<VisitorAction | null>(null);

  const handleAction = async (action: VisitorAction) => {
    setLoadingAction(action);
    try {
      await onAction(action);
    } finally {
      setLoadingAction(null);
    }
  };

  const isBusy = loadingAction !== null;

  const showApprove = status === 'cancelled';
  const showArrive = status === 'expected';
  const showCancel = status === 'expected';
  const showDepart = status === 'arrived';
  const hasActions = showApprove || showArrive || showCancel || showDepart;

  if (!hasActions) {
    return (
      <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
        No further lifecycle actions for status &ldquo;{status.replace(/_/g, ' ')}&rdquo;.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {showApprove && (
        <Button
          variant="primary"
          size={size}
          loading={loadingAction === 'approve'}
          disabled={isBusy}
          onClick={() => void handleAction('approve')}
        >
          <CheckCircle className="h-4 w-4" />
          Re-approve
        </Button>
      )}
      {showArrive && (
        <Button
          variant="primary"
          size={size}
          loading={loadingAction === 'arrive'}
          disabled={isBusy}
          onClick={() => void handleAction('arrive')}
        >
          <LogIn className="h-4 w-4" />
          Mark Arrived
        </Button>
      )}
      {showDepart && (
        <Button
          variant="outline"
          size={size}
          loading={loadingAction === 'depart'}
          disabled={isBusy}
          onClick={() => void handleAction('depart')}
        >
          <LogOut className="h-4 w-4" />
          Mark Departed
        </Button>
      )}
      {showCancel && (
        <Button
          variant="danger"
          size={size}
          loading={loadingAction === 'cancel'}
          disabled={isBusy}
          onClick={() => void handleAction('cancel')}
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );
}
