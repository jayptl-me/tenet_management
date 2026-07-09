'use client';

import { useMemo } from 'react';
import { chartTokens, heatmapLevel, heatmapRamp, type HeatmapScale } from '@/lib/chart-theme';

/**
 * HeatmapCalendar — month contribution grid.
 * Color intensity uses solid token ramps (brand / success / danger) for light + dark.
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

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: Array<{ date: string; day: number; count: number; inMonth: boolean }> = [];

    for (let i = 0; i < startDow; i++) {
      cells.push({ date: '', day: -1, count: 0, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: dateStr, day: d, count: data[dateStr] ?? 0, inMonth: true });
    }

    const chunked: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunked.push(cells.slice(i, i + 7));
    }
    // Pad final week
    const last = chunked[chunked.length - 1];
    if (last && last.length < 7) {
      while (last.length < 7) {
        last.push({ date: '', day: -1, count: 0, inMonth: false });
      }
    }
    return chunked;
  }, [data, year, month]);

  const computedMax =
    maxValue ?? Math.max(1, ...weeks.flat().map((c) => c.count));

  const colors = useMemo(
    () => heatmapRamp(colorScale, customColors),
    [colorScale, customColors],
  );

  const cellSize = size;
  const cellGap = 4;
  const labelW = 30;
  const weekCount = weeks.length;
  const totalW = labelW + weekCount * (cellSize + cellGap);
  const totalH = 7 * (cellSize + cellGap) + 22;
  const clickable = !!onDayClick;

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="mx-auto w-full max-w-md overflow-visible"
        style={{ height: Math.max(totalH, 120) }}
        role="img"
        aria-label={`Activity heatmap for ${monthLabel}`}
      >
        {dayNames.map((name, i) =>
          name ? (
            <text
              key={`day-${i}`}
              x={2}
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
                  rx={3}
                  fill="transparent"
                  stroke={chartTokens.cellBorder}
                  strokeWidth={0.5}
                  opacity={0.35}
                />
              );
            }

            const level = heatmapLevel(cell.count, computedMax);
            const fill = colors[level] ?? colors[0];

            return (
              <g key={cell.date}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={3}
                  fill={fill}
                  stroke={level === 0 ? chartTokens.cellBorder : 'transparent'}
                  strokeWidth={level === 0 ? 1 : 0}
                  className={
                    clickable
                      ? 'cursor-pointer transition-opacity duration-150 hover:opacity-80 focus:outline-none'
                      : 'transition-opacity duration-150'
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? 'button' : undefined}
                  aria-label={`${cell.date}: ${cell.count}`}
                  onClick={
                    clickable
                      ? () => onDayClick?.(cell.date, cell.count)
                      : undefined
                  }
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
                >
                  <title>{`${cell.date}: ${cell.count}`}</title>
                </rect>
              </g>
            );
          }),
        )}

        <text
          x={labelW}
          y={totalH - 4}
          textAnchor="start"
          fill={chartTokens.axis}
          fontSize={10}
          fontFamily={chartTokens.fontBody}
          fontWeight={700}
        >
          {monthLabel}
        </text>
      </svg>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] font-medium">
        <span className="text-[color:var(--color-text-muted)]">Less</span>
        {colors.map((c, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-[var(--chart-cell-radius)] border border-[color:var(--chart-cell-border)]"
            style={{ backgroundColor: c }}
            aria-hidden
          />
        ))}
        <span className="text-[color:var(--color-text-muted)]">More</span>
      </div>
    </div>
  );
}

export default HeatmapCalendar;
