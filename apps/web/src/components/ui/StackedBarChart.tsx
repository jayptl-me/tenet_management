'use client';

import { chartTokens } from '@/lib/chart-theme';

/**
 * StackedBarChart — horizontal stacked bars using design tokens.
 * Segment colors should be CSS vars (e.g. var(--color-success-500)).
 */
export function StackedBarChart({
  bars,
  barHeight = 28,
  barGap = 10,
  showLegend = true,
  className,
}: {
  bars: Array<{
    label: string;
    segments: Array<{ value: number; color: string; label: string }>;
  }>;
  barHeight?: number;
  barGap?: number;
  showLegend?: boolean;
  className?: string;
}) {
  const safeBars = bars.length > 0 ? bars : [];
  const maxTotal = Math.max(
    ...safeBars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0)),
    1,
  );
  const totalHeight = Math.max(safeBars.length * (barHeight + barGap) - barGap, barHeight);
  const padLeft = 108;
  const padRight = 40;
  const chartW = 640;
  const usableW = chartW - padLeft - padRight;
  const corner = Math.min(6, barHeight / 2);

  const legendSeen = new Set<string>();
  const legendItems: Array<{ label: string; color: string }> = [];
  for (const bar of safeBars) {
    for (const seg of bar.segments) {
      if (!legendSeen.has(seg.label)) {
        legendSeen.add(seg.label);
        legendItems.push({ label: seg.label, color: seg.color });
      }
    }
  }

  if (safeBars.length === 0) {
    return (
      <div
        className={className}
        role="img"
        aria-label="No stacked bar data"
      >
        <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
          No data to display
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${chartW} ${totalHeight}`}
        className="w-full overflow-visible"
        style={{ height: totalHeight, maxHeight: totalHeight + 4 }}
        role="img"
        aria-label="Stacked bar chart"
      >
        {safeBars.map((bar, i) => {
          const y = i * (barHeight + barGap);
          const total = bar.segments.reduce((s, seg) => s + seg.value, 0);
          const totalW = (total / maxTotal) * usableW;
          let currentX = padLeft;
          const activeSegs = bar.segments.filter((s) => s.value > 0);

          return (
            <g key={`${bar.label}-${i}`}>
              {/* Track */}
              <rect
                x={padLeft}
                y={y}
                width={usableW}
                height={barHeight}
                rx={corner}
                fill={chartTokens.track}
                opacity={0.7}
              />

              <text
                x={padLeft - 10}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill={chartTokens.label}
                fontSize={11}
                fontFamily={chartTokens.fontBody}
                fontWeight={600}
              >
                {bar.label.length > 14 ? `${bar.label.slice(0, 13)}…` : bar.label}
              </text>

              {activeSegs.map((seg, j) => {
                const segW = total > 0 ? (seg.value / total) * totalW : 0;
                if (segW <= 0) return null;
                const x = currentX;
                currentX += segW;
                const isFirst = j === 0;
                const isLast = j === activeSegs.length - 1;
                // Clip rounded ends only on outer segments
                const rx = isFirst || isLast ? corner : 0;

                return (
                  <g key={`${seg.label}-${j}`}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(segW, 0)}
                      height={barHeight}
                      rx={rx}
                      fill={seg.color}
                      className="transition-opacity duration-200 hover:opacity-90"
                    >
                      <title>{`${seg.label}: ${seg.value}`}</title>
                    </rect>
                    {segW > 36 && (
                      <text
                        x={x + segW / 2}
                        y={y + barHeight / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={chartTokens.onFill}
                        fontSize={10}
                        fontFamily={chartTokens.fontMono}
                        fontWeight={700}
                        style={{ paintOrder: 'stroke', stroke: 'var(--chart-cell-border)', strokeWidth: 0.5 }}
                      >
                        {seg.value}
                      </text>
                    )}
                  </g>
                );
              })}

              <text
                x={padLeft + Math.max(totalW, 4) + 8}
                y={y + barHeight / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fill={chartTokens.axis}
                fontSize={10}
                fontFamily={chartTokens.fontMono}
                fontWeight={600}
              >
                {total}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && legendItems.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 text-[11px] font-semibold"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[var(--chart-cell-radius)]"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-[color:var(--color-text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StackedBarChart;
