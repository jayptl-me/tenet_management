'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  chartTokens,
  chartTooltipClass,
  heatmapLevel,
  heatmapRamp,
  type HeatmapScale,
} from '@/lib/chart-theme';

/**
 * HeatmapCalendar — month contribution grid.
 * Color intensity uses solid token ramps (brand / success / danger) for light + dark.
 * Empty cells use --chart-heatmap-0 with a visible border (not washed transparent overlays).
 */
export function HeatmapCalendar({
  data,
  year,
  month,
  colorScale = 'brand',
  customColors,
  maxValue,
  size = 16,
  onDayClick,
  className,
}: {
  data: Record<string, number>;
  year: number;
  month: number;
  colorScale?: HeatmapScale;
  customColors?: string[];
  maxValue?: number;
  size?: number;
  onDayClick?: (date: string, count: number) => void;
  className?: string;
}) {
  const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', ''];
  const [tip, setTip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: Array<{
      date: string;
      day: number;
      count: number;
      inMonth: boolean;
    }> = [];

    for (let i = 0; i < startDow; i++) {
      cells.push({ date: '', day: -1, count: 0, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        date: dateStr,
        day: d,
        count: data[dateStr] ?? 0,
        inMonth: true,
      });
    }

    const chunked: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunked.push(cells.slice(i, i + 7));
    }
    const last = chunked[chunked.length - 1];
    if (last && last.length < 7) {
      while (last.length < 7) {
        last.push({ date: '', day: -1, count: 0, inMonth: false });
      }
    }
    return chunked;
  }, [data, year, month]);

  const computedMax = maxValue ?? Math.max(1, ...weeks.flat().map((c) => c.count));

  const colors = useMemo(() => heatmapRamp(colorScale, customColors), [colorScale, customColors]);

  const cellSize = size;
  const cellGap = 3;
  const labelW = 28;
  const weekCount = weeks.length;
  const totalW = labelW + weekCount * (cellSize + cellGap);
  const totalH = 7 * (cellSize + cellGap) + 28;
  const clickable = !!onDayClick;
  const cellRx = 3;

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  const totalActivity = weeks
    .flat()
    .filter((c) => c.inMonth)
    .reduce((s, c) => s + c.count, 0);

  return (
    <div className={clsx('relative', className)}>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="mx-auto w-full max-w-md overflow-visible"
        style={{ height: Math.max(totalH, 128) }}
        role="img"
        aria-label={`Activity heatmap for ${monthLabel}. ${totalActivity} total.`}
      >
        {dayNames.map((name, i) =>
          name ? (
            <text
              key={`day-${i}`}
              x={0}
              y={i * (cellSize + cellGap) + cellSize / 2 + 1}
              textAnchor="start"
              dominantBaseline="middle"
              fill={chartTokens.axis}
              fontSize={9}
              fontFamily={chartTokens.fontBody}
              fontWeight={600}
            >
              {name}
            </text>
          ) : null,
        )}

        {weeks.map((week, weekIdx) =>
          week.map((cell, dayIdx) => {
            const x = labelW + weekIdx * (cellSize + cellGap);
            const y = dayIdx * (cellSize + cellGap);

            if (!cell.inMonth) {
              return (
                <rect
                  key={`empty-${weekIdx}-${dayIdx}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={cellRx}
                  fill={chartTokens.track}
                  opacity={0.35}
                />
              );
            }

            const level = heatmapLevel(cell.count, computedMax);
            const fill = colors[level] ?? colors[0];
            const isEmpty = level === 0;

            return (
              <g key={cell.date}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={cellRx}
                  fill={fill}
                  stroke={isEmpty ? chartTokens.cellBorder : 'transparent'}
                  strokeWidth={isEmpty ? 1 : 0}
                  className={clsx(
                    'transition-opacity duration-150 motion-reduce:transition-none',
                    clickable && 'cursor-pointer hover:opacity-85 focus:outline-none',
                  )}
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? 'button' : undefined}
                  aria-label={`${cell.date}: ${cell.count}${cell.count === 1 ? ' event' : ' events'}`}
                  onClick={clickable ? () => onDayClick?.(cell.date, cell.count) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onDayClick?.(cell.date, cell.count);
                          }
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    const svg = e.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    setTip({
                      date: cell.date,
                      count: cell.count,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => {
                    const svg = e.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    const bbox = e.currentTarget.getBoundingClientRect();
                    const rect = svg.getBoundingClientRect();
                    setTip({
                      date: cell.date,
                      count: cell.count,
                      x: bbox.left - rect.left + bbox.width / 2,
                      y: bbox.top - rect.top,
                    });
                  }}
                  onBlur={() => setTip(null)}
                >
                  <title>{`${cell.date}: ${cell.count}`}</title>
                </rect>
              </g>
            );
          }),
        )}

        <text
          x={labelW}
          y={totalH - 6}
          textAnchor="start"
          fill={chartTokens.axis}
          fontSize={11}
          fontFamily={chartTokens.fontBody}
          fontWeight={700}
        >
          {monthLabel}
        </text>
        <text
          x={totalW}
          y={totalH - 6}
          textAnchor="end"
          fill={chartTokens.axis}
          fontSize={10}
          fontFamily={chartTokens.fontMono}
          fontWeight={600}
        >
          {totalActivity} total
        </text>
      </svg>

      {tip && (
        <div
          className={clsx(chartTooltipClass, 'absolute text-[11px]')}
          style={{
            left: tip.x,
            top: tip.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
          role="tooltip"
        >
          <p className="font-bold tabular-nums">{tip.date}</p>
          <p className="mt-0.5 opacity-90">
            {tip.count} {tip.count === 1 ? 'event' : 'events'}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] font-medium">
        <span className="mr-0.5 text-[color:var(--color-text-muted)]">Less</span>
        {colors.map((c, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-[var(--chart-cell-radius)] border border-[color:var(--chart-cell-border)]"
            style={{ backgroundColor: c }}
            aria-hidden
            title={`Level ${i}`}
          />
        ))}
        <span className="ml-0.5 text-[color:var(--color-text-muted)]">More</span>
      </div>
    </div>
  );
}

export default HeatmapCalendar;
