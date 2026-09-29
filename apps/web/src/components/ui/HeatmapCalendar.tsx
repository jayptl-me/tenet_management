'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  chartTooltipClass,
  heatmapLevel,
  heatmapRamp,
  type HeatmapScale,
} from '@/lib/chart-theme';

export interface HeatmapCalendarProps {
  data: Record<string, number>;
  year: number;
  month: number;
  colorScale?: HeatmapScale;
  customColors?: string[];
  maxValue?: number;
  size?: number;
  onDayClick?: (date: string, count: number) => void;
  className?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Incident Density Heatmap Calendar (2026 Executive Edition).
 * Replaces stretched, clipping SVGs with an accessible, responsive CSS grid
 * featuring crisp cells, floating tooltips, and interactive day filtering.
 */
export function HeatmapCalendar({
  data,
  year,
  month,
  colorScale = 'danger',
  customColors,
  maxValue,
  onDayClick,
  className,
}: HeatmapCalendarProps) {
  const [activeTooltip, setActiveTooltip] = useState<{
    date: string;
    formattedDate: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const colors = useMemo(() => heatmapRamp(colorScale, customColors), [colorScale, customColors]);

  const { weeks, totalActivity, monthLabel, computedMax } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 0 = Sunday, convert to Monday = 0
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: Array<{
      date: string;
      formattedDate: string;
      day: number;
      count: number;
      inMonth: boolean;
    }> = [];

    // Leading padding days
    for (let i = 0; i < startDow; i++) {
      cells.push({ date: '', formattedDate: '', day: -1, count: 0, inMonth: false });
    }

    // Days in month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      cells.push({
        date: dateStr,
        formattedDate,
        day: d,
        count: data[dateStr] ?? 0,
        inMonth: true,
      });
    }

    // Trailing padding days to fill the final week
    while (cells.length % 7 !== 0) {
      cells.push({ date: '', formattedDate: '', day: -1, count: 0, inMonth: false });
    }

    const chunked: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunked.push(cells.slice(i, i + 7));
    }

    const total = cells.filter((c) => c.inMonth).reduce((s, c) => s + c.count, 0);
    const max = maxValue ?? Math.max(1, ...cells.map((c) => c.count));

    const label = new Date(year, month).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return { weeks: chunked, totalActivity: total, monthLabel: label, computedMax: max };
  }, [data, year, month, maxValue]);

  return (
    <div
      className={clsx('relative w-full max-w-lg select-none space-y-3.5', className)}
      role="region"
      aria-label={`Incident Heatmap for ${monthLabel}. ${totalActivity} total incidents.`}
    >
      {/* ── Top Header Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-color)]/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-display text-[14px] font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {monthLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-100)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
          <span className="tabular-nums font-bold text-[color:var(--color-text-primary)]">
            {totalActivity}
          </span>
          <span className="text-[color:var(--color-text-muted)] font-normal">
            {totalActivity === 1 ? 'incident' : 'incidents'}
          </span>
        </div>
      </div>

      {/* ── Calendar Matrix ──────────────────────────────── */}
      <div className="flex justify-center">
        <div className="flex items-start gap-2.5">
          {/* Day of Week Axis */}
          <div className="flex flex-col gap-1.5 pt-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
            {DAY_LABELS.map((label, idx) => (
              <span
                key={label}
                className={clsx(
                  'h-6 flex items-center justify-end pr-1 text-[10px]',
                  (idx === 1 || idx === 3 || idx === 5) ? 'invisible' : '',
                )}
                aria-hidden="true"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Week Columns */}
          <div className="flex items-center gap-1.5">
            {weeks.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="flex flex-col gap-1.5">
                {week.map((cell, dayIdx) => {
                  if (!cell.inMonth) {
                    return (
                      <div
                        key={`pad-${weekIdx}-${dayIdx}`}
                        className="h-6 w-6 rounded-[4px] bg-transparent opacity-0"
                        aria-hidden="true"
                      />
                    );
                  }

                  const level = heatmapLevel(cell.count, computedMax);
                  const isClickable = Boolean(onDayClick && cell.count > 0);
                  const fillColor = colors[level] ?? colors[0];
                  const isEmpty = cell.count === 0;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => onDayClick?.(cell.date, cell.count)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const containerRect = e.currentTarget
                          .closest('[role="region"]')
                          ?.getBoundingClientRect();
                        if (!containerRect) return;

                        setActiveTooltip({
                          date: cell.date,
                          formattedDate: cell.formattedDate,
                          count: cell.count,
                          x: rect.left - containerRect.left + rect.width / 2,
                          y: rect.top - containerRect.top,
                        });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className={clsx(
                        'relative flex h-6 w-6 items-center justify-center rounded-[4px] text-[10px] font-semibold transition-all duration-150',
                        isEmpty
                          ? 'border border-[color:var(--border-color)]/80 bg-[color:var(--color-surface-100)] text-[color:var(--color-text-muted)] cursor-default'
                          : clsx(
                              colorScale === 'danger'
                                ? 'text-[color:var(--color-on-danger)]'
                                : 'text-[color:var(--color-on-brand)]',
                              'shadow-[var(--shadow-xs)] hover:scale-110 hover:shadow-[var(--shadow-sm)] cursor-pointer focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:outline-none',
                            ),
                      )}
                      style={{ backgroundColor: fillColor }}
                      aria-label={`${cell.formattedDate}: ${cell.count} incidents`}
                    >
                      <span className={clsx('text-[9px] tabular-nums', isEmpty ? 'opacity-40' : 'opacity-90 font-bold')}>
                        {cell.day}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating Tooltip ─────────────────────────────── */}
      {activeTooltip && (
        <div
          className={clsx(
            chartTooltipClass,
            'pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-md)]',
          )}
          style={{
            left: activeTooltip.x,
            top: activeTooltip.y - 8,
          }}
          role="tooltip"
        >
          <p className="font-bold text-[color:var(--color-text-primary)]">
            {activeTooltip.formattedDate}
          </p>
          <p className="text-[color:var(--color-text-secondary)]">
            <span className="font-semibold text-[color:var(--color-danger-600)]">
              {activeTooltip.count}
            </span>{' '}
            {activeTooltip.count === 1 ? 'incident filed' : 'incidents filed'}
          </p>
        </div>
      )}

      {/* ── Bottom Legend ────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-[color:var(--color-text-muted)]">
        <span className="text-[10px]">Click active dates to filter</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px]">0</span>
          {colors.map((c, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[2px] border border-black/10"
              style={{ backgroundColor: c }}
              aria-hidden="true"
            />
          ))}
          <span className="text-[10px]">{computedMax}+</span>
        </div>
      </div>
    </div>
  );
}

export default HeatmapCalendar;
