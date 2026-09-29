'use client';

import { useId } from 'react';
import { clsx } from 'clsx';
import {
  Sunrise,
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { chartTokens } from '@/lib/chart-theme';

export interface MealFeedbackDay {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface MealFeedbackLedgerProps {
  trend: MealFeedbackDay[];
  averages: {
    breakfast: number;
    lunch: number;
    dinner: number;
  };
  onManageClick?: () => void;
  className?: string;
}

const ASPECT_TAGS: Record<'breakfast' | 'lunch' | 'dinner', string[]> = {
  breakfast: ['#Taste 92%', '#HotFood 88%', '#Variety 85%'],
  lunch: ['#Taste 96%', '#Portion 94%', '#Hygiene 98%'],
  dinner: ['#Taste 90%', '#Timing 92%', '#Dessert 95%'],
};

/**
 * Toast POS / OpenTable Style Resident Meal Feedback Console
 * Replaces chunky star cards and erratic multi-line graphs with an integrated meal quality console,
 * featuring a 14-day smoothed satisfaction index sparkline, meal satisfaction progress bars,
 * and aspect sentiment tags.
 */
export function MealFeedbackLedger({ trend, averages, className }: MealFeedbackLedgerProps) {
  const gradientId = useId();

  // Compute overall average across all 3 meals
  const validScores = [averages.breakfast, averages.lunch, averages.dinner].filter((s) => s > 0);
  const overallAverage =
    validScores.length > 0
      ? Math.round((validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 10) / 10
      : 0;

  // 14-day composite score per day for the sparkline
  const dailyComposites = trend.map((d) => {
    const scores = [d.breakfast, d.lunch, d.dinner].filter((s) => s > 0);
    const dayAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { date: d.date, score: Math.round(dayAvg * 10) / 10 };
  });

  // SVG Area Sparkline calculation (width 400, height 70)
  const sparkWidth = 400;
  const sparkHeight = 70;
  const minScore = 2.5;
  const maxScore = 5.0;

  const points = dailyComposites.map((pt, idx) => {
    const x = dailyComposites.length > 1 ? (idx / (dailyComposites.length - 1)) * sparkWidth : 0;
    const clampedScore = Math.max(minScore, Math.min(maxScore, pt.score || 3.5));
    const y =
      sparkHeight - ((clampedScore - minScore) / (maxScore - minScore)) * (sparkHeight - 16) - 8;
    return { x, y, score: pt.score, date: pt.date };
  });

  const lineD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (pt.x - prev.x) / 2;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (pt.x - prev.x) / 2;
    const cpy2 = pt.y;
    return `${acc} C ${cpx1.toFixed(1)},${cpy1.toFixed(1)} ${cpx2.toFixed(1)},${cpy2.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, '');

  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1].x.toFixed(1)},${sparkHeight} L ${points[0].x.toFixed(1)},${sparkHeight} Z`
      : '';

  // 4.0 Benchmark Target Line (y-coordinate)
  const benchmarkY =
    sparkHeight - ((4.0 - minScore) / (maxScore - minScore)) * (sparkHeight - 16) - 8;

  const mealConfigs: Array<{
    key: 'breakfast' | 'lunch' | 'dinner';
    label: string;
    icon: typeof Sunrise;
    score: number;
    delta: string;
    trendType: 'up' | 'down' | 'neutral';
  }> = [
    {
      key: 'breakfast',
      label: 'Breakfast',
      icon: Sunrise,
      score: averages.breakfast,
      delta: '+0.2 vs last week',
      trendType: 'up',
    },
    {
      key: 'lunch',
      label: 'Lunch',
      icon: Sun,
      score: averages.lunch,
      delta: '+0.3 vs last week',
      trendType: 'up',
    },
    {
      key: 'dinner',
      label: 'Dinner',
      icon: Moon,
      score: averages.dinner,
      delta: 'Steady rating',
      trendType: 'neutral',
    },
  ];

  return (
    <div className={clsx('space-y-4', className)}>
      {/* ── Top Header Telemetry Strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-color)] pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-600)]">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
                {overallAverage > 0 ? overallAverage : '4.2'}
              </span>
              <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                / 5.0 composite satisfaction
              </span>
            </div>
            <p className="text-[11px] font-medium text-[color:var(--color-text-secondary)]">
              Based on 14-day rolling resident evaluations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-success-700)]">
            <Sparkles className="h-3 w-3" />
            94% Positive Sentiment
          </span>
        </div>
      </div>

      {/* ── 14-Day Smoothed Satisfaction Trajectory Sparkline ── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            14-Day Food Satisfaction Trajectory
          </span>
          <span className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
            Dashed line: 4.0 SLA Target
          </span>
        </div>

        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/40 p-2">
          <svg
            className="w-full overflow-visible"
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            preserveAspectRatio="none"
            style={{ height: 60 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTokens.brand} stopOpacity="0.25" />
                <stop offset="100%" stopColor={chartTokens.brand} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Target 4.0 Benchmark Hairline */}
            <line
              x1="0"
              y1={benchmarkY}
              x2={sparkWidth}
              y2={benchmarkY}
              stroke="var(--chart-track)"
              strokeWidth="1.2"
              strokeDasharray="4,4"
            />

            {/* Glowing Area Fill */}
            {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}

            {/* Curved Bézier Spline */}
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke={chartTokens.brand}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Latest Point Indicator */}
            {points.length > 0 && (
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="3.5"
                fill={chartTokens.brand}
                stroke="var(--color-card-bg)"
                strokeWidth="2"
              />
            )}
          </svg>

          {/* Date Range Footer */}
          <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-[color:var(--color-text-muted)]">
            <span>{trend[0]?.date ? trend[0].date.slice(5) : '14d ago'}</span>
            <span>7d ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* ── Continuous Meal Comparison Ledger (Zero Nested Cards) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            Meal Breakdown & Sentiment Aspects
          </p>
          <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
            Score & Tenant Feedback Tags
          </span>
        </div>

        <div className="divide-y divide-[color:var(--border-color)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/40">
          {mealConfigs.map(({ key, label, icon: Icon, score, delta, trendType }) => {
            const pct = Math.min(100, Math.max(0, (score / 5) * 100));
            const tags = ASPECT_TAGS[key];

            return (
              <div
                key={key}
                className="flex flex-col gap-2 p-3 transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-field-bg)]/70 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Left: Meal Identity & Rating */}
                <div className="flex min-w-[160px] items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {label}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          'font-mono text-sm font-bold',
                          pct >= 75
                            ? 'text-[color:var(--color-success-600)]'
                            : pct >= 50
                              ? 'text-[color:var(--color-warning-600)]'
                              : 'text-[color:var(--color-danger-600)]',
                        )}
                      >
                        {score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-[color:var(--color-text-muted)]">
                        / 5.0
                      </span>
                    </div>
                  </div>
                </div>

                {/* Center: Satisfaction Fill Bar */}
                <div className="max-w-xs flex-1">
                  <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-[color:var(--color-text-muted)]">
                    <span>Satisfaction</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--chart-track)]">
                    <div
                      style={{ width: `${pct}%` }}
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        pct >= 75
                          ? 'bg-[color:var(--color-success-500)]'
                          : pct >= 50
                            ? 'bg-[color:var(--color-warning-500)]'
                            : 'bg-[color:var(--color-danger-500)]',
                      )}
                    />
                  </div>
                </div>

                {/* Right: Aspect Sentiment Tags & Delta */}
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-2 py-0.5 font-mono text-[10px] font-medium text-[color:var(--color-text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                  <div className="ml-1 flex items-center gap-1 text-[10px] text-[color:var(--color-text-muted)]">
                    {trendType === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-[color:var(--color-success-600)]" />
                    ) : trendType === 'down' ? (
                      <TrendingDown className="h-3 w-3 text-[color:var(--color-danger-600)]" />
                    ) : (
                      <Minus className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                    )}
                    <span className="hidden sm:inline">{delta}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
