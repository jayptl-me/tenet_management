'use client';

/**
 * StackedBarChart -- SVG horizontal stacked bar chart.
 * Each bar shows proportional segments left-to-right.
 * Theme-aware via var() tokens. Zero dependencies.
 */
export function StackedBarChart({
  bars,
  barHeight = 32,
  barGap = 8,
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
  const maxTotal = Math.max(...bars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0)), 1);
  const totalHeight = bars.length * (barHeight + barGap) - barGap;
  const padLeft = 100;
  const chartW = 600;
  const usableW = chartW - padLeft - 16;

  // Collect unique segment labels for legend
  const legendSeen = new Set<string>();
  const legendItems: Array<{ label: string; color: string }> = [];
  for (const bar of bars) {
    for (const seg of bar.segments) {
      if (!legendSeen.has(seg.label)) {
        legendSeen.add(seg.label);
        legendItems.push({ label: seg.label, color: seg.color });
      }
    }
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${chartW} ${totalHeight}`}
        className="w-full overflow-visible"
        style={{ height: totalHeight, maxHeight: totalHeight }}
        role="img"
        aria-label="Stacked bar chart"
      >
        {bars.map((bar, i) => {
          const y = i * (barHeight + barGap);
          const total = bar.segments.reduce((s, seg) => s + seg.value, 0);
          const totalW = (total / maxTotal) * usableW;
          let currentX = padLeft;

          return (
            <g key={bar.label}>
              {/* Bar label */}
              <text
                x={padLeft - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--color-text-secondary)"
                fontSize={11}
                fontFamily="var(--font-body)"
                fontWeight={600}
              >
                {bar.label}
              </text>

              {/* Segments */}
              {bar.segments.map((seg, j) => {
                const segW = total > 0 ? (seg.value / total) * totalW : 0;
                if (segW <= 0) return null;
                const x = currentX;
                currentX += segW;
                const rx = j === bar.segments.length - 1 ? barHeight / 2 : 0;
                const lx = j === 0 ? barHeight / 2 : 0;

                return (
                  <g key={seg.label}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(segW, 0)}
                      height={barHeight}
                      rx={lx > 0 ? lx : rx}
                      fill={seg.color}
                      className="transition-all duration-500 ease-out"
                      style={{ transitionDelay: `${j * 80}ms` }}
                    />
                    {segW > 40 && (
                      <text
                        x={x + segW / 2}
                        y={y + barHeight / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--color-surface-950)"
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        fontWeight={700}
                      >
                        {seg.value}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Total on the right */}
              <text
                x={padLeft + totalW + 8}
                y={y + barHeight / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fill="var(--color-text-muted)"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fontWeight={500}
              >
                {total}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && legendItems.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span
                className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
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
