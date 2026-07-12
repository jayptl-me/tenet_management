'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface LowStockItem {
  _id: string;
  name: string;
  category: string;
  location?: string;
  quantity: number;
  lowStockThreshold: number;
  status: string;
}

interface LowStockBannerProps {
  /** Optional callback when the banner is clicked (e.g. filter the assets list). */
  onFilterLowStock?: () => void;
}

export function LowStockBanner({ onFilterLowStock }: LowStockBannerProps) {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('assets/low-stock')
      .json<{ success: boolean; data: LowStockItem[] }>()
      .then((res) => {
        if (!cancelled) {
          setItems(res.data ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing while loading or when there are no low-stock items.
  if (!loaded || items.length === 0) return null;

  const itemNames = items.slice(0, 5).map((i) => i.name).join(', ');
  const remaining = items.length - 5;

  const Wrapper = onFilterLowStock ? 'button' : 'div';

  return (
    <Wrapper
      {...(onFilterLowStock ? { onClick: onFilterLowStock, type: 'button' as const } : {})}
      className={`flex items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-4 shadow-[var(--shadow-xs)] ${
        onFilterLowStock
          ? 'w-full cursor-pointer text-left transition-shadow duration-[var(--transition-duration)] hover:shadow-[var(--shadow-card-hover)]'
          : ''
      }`}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-[length:var(--bw-default)] border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[color:var(--color-warning-800)]">
          {items.length} {items.length === 1 ? 'item is' : 'items are'} running low on stock
        </p>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-warning-800)] opacity-80">
          {itemNames}
          {remaining > 0 && ` and ${remaining} more`}
          {onFilterLowStock && ' — click to filter'}
        </p>
      </div>
    </Wrapper>
  );
}
