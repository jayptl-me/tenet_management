'use client';

import { useEffect, useState } from 'react';
import { Star, MessageSquare, Sun, Sunset, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { surfaceCardClass } from '@/lib/field-styles';
import { StarRating } from '@/components/ui/StarRating';

interface SummaryEntry {
  date: string;
  mealType: string;
  avgRating: number;
  count: number;
}

interface MealTypeAgg {
  sum: number;
  count: number;
}

const MEAL_TYPE_META: Record<
  string,
  { label: string; icon: React.ReactNode; variant: 'default' | 'brand' | 'warning' }
> = {
  breakfast: { label: 'Breakfast', icon: <Sun className="h-4 w-4" />, variant: 'warning' },
  lunch: { label: 'Lunch', icon: <Sunset className="h-4 w-4" />, variant: 'brand' },
  dinner: { label: 'Dinner', icon: <Moon className="h-4 w-4" />, variant: 'default' },
};

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner'];

/**
 * Fetches GET /meals/feedback/summary and renders KPI cards in a horizontal strip.
 * The summary endpoint groups by { date, mealType } returning avgRating + count per group.
 * We aggregate those groups into: overall average, total count, and per-meal-type averages.
 * On error the strip is silently omitted (returns null).
 */
export function FeedbackSummaryStrip() {
  const [summary, setSummary] = useState<SummaryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('meals/feedback/summary')
      .json<{ success: boolean; data: SummaryEntry[] }>()
      .then((res) => {
        if (!cancelled) setSummary(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent on error — do not render the strip.
  if (failed) return null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={clsx(surfaceCardClass, 'h-[88px] animate-pulse px-5 py-4')}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  const entries = summary ?? [];

  // Aggregate across all groups (weighted by count).
  let totalCount = 0;
  let weightedSum = 0;
  const byMealType: Record<string, MealTypeAgg> = {};

  for (const entry of entries) {
    totalCount += entry.count;
    weightedSum += entry.avgRating * entry.count;
    const existing = byMealType[entry.mealType] ?? { sum: 0, count: 0 };
    byMealType[entry.mealType] = {
      sum: existing.sum + entry.avgRating * entry.count,
      count: existing.count + entry.count,
    };
  }

  const overallAvg = totalCount > 0 ? Math.round((weightedSum / totalCount) * 100) / 100 : 0;

  const round = (n: number) => Math.round(n * 100) / 100;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        title="Average Rating"
        value={overallAvg > 0 ? overallAvg.toFixed(2) : '—'}
        icon={<Star className="h-4 w-4" />}
        variant="warning"
        animate={false}
      >
        {overallAvg > 0 && (
          <div className="mt-2">
            <StarRating value={overallAvg} readonly size="sm" />
          </div>
        )}
      </StatCard>

      <StatCard
        title="Total Feedback"
        value={totalCount}
        icon={<MessageSquare className="h-4 w-4" />}
        variant="brand"
        animate={false}
      />

      {MEAL_TYPE_ORDER.map((mealType) => {
        const meta = MEAL_TYPE_META[mealType];
        const agg = byMealType[mealType];
        const avg = agg && agg.count > 0 ? round(agg.sum / agg.count) : 0;
        return (
          <StatCard
            key={mealType}
            title={meta.label}
            value={avg > 0 ? avg.toFixed(2) : '—'}
            icon={meta.icon}
            variant={meta.variant}
            animate={false}
          >
            {agg && (
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                {agg.count} {agg.count === 1 ? 'entry' : 'entries'}
              </p>
            )}
          </StatCard>
        );
      })}
    </div>
  );
}
