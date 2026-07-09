'use client';

/**
 * FunnelChart — SVG horizontal funnel chart.
 * Shows stages as nested horizontal bars, each narrower than the last.
 * Perfect for visualizing payment collection pipeline, conversion funnels, etc.
 */
export function FunnelChart({
  stages,
  maxWidth = 100,
  barHeight = 32,
  barGap = 6,
  className,
}: {
  stages: Array<{ label: string; value: number; color: string }>;
  maxWidth?: number;
  barHeight?: number;
  barGap?: number;
  className?: string;
}) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const totalHeight = stages.length * (barHeight + barGap) - barGap;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${maxWidth} ${totalHeight}`}
        className="w-full overflow-visible"
        style={{ height: totalHeight, maxHeight: totalHeight }}
        role="img"
        aria-label={stages.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {stages.map((stage, i) => {
          const y = i * (barHeight + barGap);
          const width = (stage.value / maxValue) * maxWidth;
          const x = (maxWidth - width) / 2; // center each bar
          const rx = barHeight / 2;

          return (
            <g key={stage.label}>
              {/* Bar background */}
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx={rx}
                ry={rx}
                fill={stage.color}
                opacity={0.15}
              />
              {/* Bar fill with animated width */}
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx={rx}
                ry={rx}
                fill={stage.color}
                className="transition-all duration-700 ease-out"
                style={{ transitionDelay: `${i * 100}ms` }}
              />
              {/* Value label inside bar */}
              <text
                x={x + width - 12}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--chart-on-fill)"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fontWeight={700}
              >
                {stage.value}
              </text>
              {/* Stage label to the left (or below if narrow) */}
              <text
                x={x - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--color-text-secondary)"
                fontSize={11}
                fontFamily="var(--font-body)"
                fontWeight={600}
              >
                {stage.label}
              </text>
              {/* Trend arrow between stages */}
              {i < stages.length - 1 && (
                <text
                  x={maxWidth / 2}
                  y={y + barHeight + barGap / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--color-text-muted)"
                  fontSize={8}
                >
                  ▼
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className="flex items-center gap-1.5 text-[11px] font-semibold"
          >
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-[color:var(--color-text-secondary)]">
              {stage.label}
            </span>
            <span className="font-mono tabular-nums text-[color:var(--color-text-primary)]">
              {stage.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FunnelChart;
