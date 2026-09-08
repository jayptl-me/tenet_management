import { clsx } from 'clsx';
import {
  Armchair,
  Refrigerator,
  Plug,
  SprayCan,
  Package,
  Check,
  Circle,
  AlertTriangle,
} from 'lucide-react';

// ── Category icon map ────────────────────────────────────

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  furniture: 'Furniture',
  appliance: 'Appliance',
  electronics: 'Electronics',
  cleaning: 'Cleaning',
  other: 'Other',
};

const categoryIcons: Record<string, typeof Package> = {
  furniture: Armchair,
  appliance: Refrigerator,
  electronics: Plug,
  cleaning: SprayCan,
  other: Package,
};

export function assetCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Unknown';
  return ASSET_CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export function AssetCategoryIcon({
  category,
  className,
}: {
  category: string | null | undefined;
  className?: string;
}) {
  const Icon = (category && categoryIcons[category]) || Package;
  return <Icon className={className} aria-hidden />;
}

// ── Stock meter ──────────────────────────────────────────

export function isLowStock(quantity: number | null | undefined, threshold: number | null | undefined): boolean {
  return (threshold ?? 0) > 0 && (quantity ?? 0) <= (threshold ?? 0);
}

export function AssetStockMeter({
  quantity,
  threshold,
  className,
}: {
  quantity: number | null | undefined;
  threshold: number | null | undefined;
  className?: string;
}) {
  const qty = quantity ?? 0;
  const th = threshold ?? 0;
  if (th <= 0) {
    return (
      <div className={clsx('min-w-0', className)}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-200)]">
          <div className="h-full w-full rounded-full bg-[color:var(--color-surface-300)]" />
        </div>
        <p className="mt-1 text-[11px] font-medium text-[color:var(--color-text-muted)]">
          Qty {qty} · no threshold set
        </p>
      </div>
    );
  }
  const low = qty <= th;
  const fill = Math.max(4, Math.min(100, Math.round((qty / Math.max(th * 2, 1)) * 100)));
  return (
    <div className={clsx('min-w-0', className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-200)]"
        role="progressbar"
        aria-valuenow={qty}
        aria-valuemin={0}
        aria-valuemax={Math.max(th * 2, 1)}
        aria-label={`Stock ${qty} of threshold ${th}`}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-[var(--transition-duration-slow)]',
            low ? 'bg-[color:var(--color-warning-500)]' : 'bg-[color:var(--color-success-500)]',
          )}
          style={{ width: `${fill}%` }}
        />
      </div>
      <p
        className={clsx(
          'mt-1 text-[11px] font-semibold',
          low ? 'text-[color:var(--color-warning-700)]' : 'text-[color:var(--color-text-muted)]',
        )}
      >
        Qty {qty} / threshold {th}
        {low ? ' · Low stock' : ''}
      </p>
    </div>
  );
}

// ── Service timeline ─────────────────────────────────────

interface TimelineNode {
  key: string;
  label: string;
  date?: string | null;
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function AssetServiceTimeline({
  purchasedDate,
  lastServicedDate,
  nextServiceDate,
  status,
  className,
}: {
  purchasedDate?: string | null;
  lastServicedDate?: string | null;
  nextServiceDate?: string | null;
  status?: string;
  className?: string;
}) {
  const retired = status === 'retired';
  const overdue = !!nextServiceDate && !retired && new Date(nextServiceDate).getTime() < Date.now();
  const nodes: TimelineNode[] = [
    { key: 'purchased', label: 'Purchased', date: purchasedDate },
    { key: 'last', label: 'Last serviced', date: lastServicedDate },
    { key: 'next', label: 'Next service', date: nextServiceDate },
  ];
  return (
    <div className={className}>
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {nodes.map((node, i) => {
          const done = !!node.date && (node.key !== 'next' || !overdue);
          const isOverdueNode = node.key === 'next' && overdue;
          const isLast = i === nodes.length - 1;
          return (
            <li key={node.key} className={clsx('relative flex-1', !isLast && 'pb-5 sm:pb-0')}>
              {!isLast && (
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-5 bottom-0 left-[15px] w-0.5 sm:top-[15px] sm:right-0 sm:bottom-auto sm:left-[32px] sm:h-0.5 sm:w-auto',
                    done
                      ? 'bg-[color:var(--color-success-400)]'
                      : 'bg-[color:var(--border-color)]',
                  )}
                />
              )}
              <div className="flex items-start gap-3 sm:flex-col sm:gap-2">
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-strong)]',
                    isOverdueNode
                      ? 'border-[color:var(--color-danger-400)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]'
                      : done
                        ? 'border-[color:var(--color-success-400)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]'
                        : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-muted)]',
                  )}
                >
                  {isOverdueNode ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[color:var(--color-text-primary)]">
                    {node.label}
                  </p>
                  <p
                    className={clsx(
                      'text-xs font-medium',
                      isOverdueNode
                        ? 'text-[color:var(--color-danger-700)]'
                        : 'text-[color:var(--color-text-muted)]',
                    )}
                  >
                    {formatShortDate(node.date)}
                    {isOverdueNode ? ' · Overdue' : ''}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {retired && (
        <p className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]">
          Retired — service schedule is closed for this asset.
        </p>
      )}
    </div>
  );
}
