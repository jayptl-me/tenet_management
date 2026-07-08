'use client';

import { useMemo } from 'react';

/**
 * HeatmapCalendar -- GitHub-style contribution grid.
 * Renders a calendar month as colored cells where intensity maps to value.
 * Theme-aware via var() tokens. Zero dependencies.
 */
export function HeatmapCalendar({
  data,
  year,
  month,
  colorScale = 'brand',
  customColors,
  maxValue,
  size = 14,
  onDayClick,
  className,
}: {
  data: Record<string, number>;
  year: number;
  month: number;
  colorScale?: 'brand' | 'success' | 'danger' | 'custom';
  customColors?: string[];
  maxValue?: number;
  size?: number;
  onDayClick?: (date: string, count: number) => void;
  className?: string;
}) {
  const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  // Build grid of weeks for the given month
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    let startDow = firstDay.getDay();
    // Convert to Monday-based: 0 = Mon, 6 = Sun
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: Array<{ date: string; day: number; count: number; inMonth: boolean }> = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      cells.push({ date: '', day: -1, count: 0, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: dateStr, day: d, count: data[dateStr] ?? 0, inMonth: true });
    }

    // Chunk into weeks (rows of 7)
    const chunked: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunked.push(cells.slice(i, i + 7));
    }
    return chunked;
  }, [data, year, month]);

  const computedMax = maxValue ?? Math.max(1, ...weeks.flat().map((c) => c.count));

  // Build color ramp
  const colors = useMemo(() => {
    if (colorScale === 'custom' && customColors && customColors.length >= 4) {
      return customColors;
    }
    let base: string;
    switch (colorScale) {
      case 'success': base = 'var(--color-success-500)'; break;
      case 'danger': base = 'var(--color-danger-500)'; break;
      default: base = 'var(--color-brand-500)'; break;
    }
    return [
      'var(--color-surface-200)',
      `color-mix(in srgb, ${base} 25%, transparent)`,
      `color-mix(in srgb, ${base} 50%, transparent)`,
      `color-mix(in srgb, ${base} 75%, transparent)`,
      base,
    ];
  }, [colorScale, customColors]);

  const getCellColor = (count: number): string => {
    if (count <= 0) return colors[0];
    const pct = count / computedMax;
    if (pct <= 0.25) return colors[1];
    if (pct <= 0.5) return colors[2];
    if (pct <= 0.75) return colors[3];
    return colors[4];
  };

  const cellSize = size;
  const cellGap = 3;
  const totalW = weeks[0]?.length ? weeks[0].length * (cellSize + cellGap) : 200;
  const totalH = weeks.length * (cellSize + cellGap) + 20;
  const labelW = 28;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${totalW + labelW} ${totalH}`}
        className="w-full overflow-visible"
        style={{ height: totalH, maxHeight: totalH }}
        role="img"
        aria-label="Calendar heatmap"
      >
        {/* Day labels */}
        {dayNames.map((name, i) => (
          name ? (
            <text
              key={i}
              x={4}
              y={i * (cellSize + cellGap) + cellSize / 2 + 4}
              textAnchor="start"
              dominantBaseline="middle"
              fill="var(--color-text-muted)"
              fontSize={9}
              fontFamily="var(--font-body)"
              fontWeight={600}
            >
              {name}
            </text>
          ) : null
        ))}

        {/* Cells */}
        {weeks.map((week, weekIdx) =>
          week.map((cell, dayIdx) => {
            if (!cell.inMonth) return null;
            const x = labelW + weekIdx * (cellSize + cellGap);
            const y = dayIdx * (cellSize + cellGap) + 2;
            const color = getCellColor(cell.count);
            const clickable = !!onDayClick;

            return (
              <g key={cell.date}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={3}
                  fill={color}
                  className="transition-all duration-300"
                  style={clickable ? { cursor: 'pointer' } : undefined}
                  onClick={clickable ? () => onDayClick?.(cell.date, cell.count) : undefined}
                >
                  <title>{`${cell.date}: ${cell.count}`}</title>
                </rect>
              </g>
            );
          })
        )}

        {/* Month label */}
        <text
          x={labelW}
          y={totalH - 4}
          textAnchor="start"
          dominantBaseline="alphabetic"
          fill="var(--color-text-muted)"
          fontSize={10}
          fontFamily="var(--font-body)"
          fontWeight={700}
        >
          {new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px]">
        <span className="text-[color:var(--color-text-muted)]">Less</span>
        {colors.map((c, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="text-[color:var(--color-text-muted)]">More</span>
      </div>
    </div>
  );
}

export default HeatmapCalendar;
