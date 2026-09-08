'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { api } from '@/lib/api';

interface ServiceDueItem {
  _id: string;
  name: string;
  category: string;
  location?: string;
  nextServiceDate?: string;
  status: string;
}

interface ServiceDueBannerProps {
  /** Optional callback when the banner is clicked (e.g. filter the assets list). */
  onFilterServiceDue?: () => void;
}

export function ServiceDueBanner({ onFilterServiceDue }: ServiceDueBannerProps) {
  const [items, setItems] = useState<ServiceDueItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('assets/service-due')
      .json<{ success: boolean; data: ServiceDueItem[] }>()
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

  // Render nothing while loading or when there are no service-due items.
  if (!loaded || items.length === 0) return null;

  const itemNames = items
    .slice(0, 5)
    .map((i) => i.name)
    .join(', ');
  const remaining = items.length - 5;

  const Wrapper = onFilterServiceDue ? 'button' : 'div';

  return (
    <Wrapper
      {...(onFilterServiceDue ? { onClick: onFilterServiceDue, type: 'button' as const } : {})}
      className={`flex items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-50)] p-4 shadow-[var(--shadow-xs)] ${
        onFilterServiceDue
          ? 'w-full cursor-pointer text-left transition-shadow duration-[var(--transition-duration)] hover:shadow-[var(--shadow-card-hover)]'
          : ''
      }`}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-[length:var(--bw-default)] border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]">
        <Wrench className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[color:var(--color-brand-800)]">
          {items.length} {items.length === 1 ? 'asset requires' : 'assets require'} service within
          30 days
        </p>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-brand-800)] opacity-80">
          {itemNames}
          {remaining > 0 && ` and ${remaining} more`}
          {onFilterServiceDue && ' — click to filter'}
        </p>
      </div>
    </Wrapper>
  );
}
