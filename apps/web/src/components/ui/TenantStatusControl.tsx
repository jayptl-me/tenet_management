'use client';

import { LogOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

// ── Types ──────────────────────────────────────────────

interface TenantStatusControlProps {
  tenantId: string;
  isActive: boolean;
  onCheckout: () => void;
  onReinstate: () => void;
  loading?: boolean;
}

// ── Component ──────────────────────────────────────────

export function TenantStatusControl({
  isActive,
  onCheckout,
  onReinstate,
  loading = false,
}: TenantStatusControlProps) {
  const statusLabel = isActive ? 'Active' : 'Checked Out';
  const variant = isActive ? statusToVariant('active') : statusToVariant('checked_out');

  return (
    <div className="flex items-center gap-3">
      <StatusBadge variant={variant} label={statusLabel} />
      {isActive ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckout}
          loading={loading}
          animate={false}
        >
          <LogOut className="h-4 w-4" />
          Checkout
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={onReinstate}
          loading={loading}
          animate={false}
        >
          <RotateCcw className="h-4 w-4" />
          Reinstate
        </Button>
      )}
    </div>
  );
}
