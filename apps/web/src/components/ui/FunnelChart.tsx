'use client';

import { chartTokens } from '@/lib/chart-theme';

/**
 * FunnelChart — horizontal stage bars for pipelines (payments, conversion).
 * Labels sit in a fixed left column so they never clip outside the viewBox.
 * Fully token-driven for light/dark SaaS.
 */
export function FunnelChart({
  stages,
  barHeight = 32,
  barGap = 8,
  className,
}: {
  stages: Array<{ label: string; value: number; color: string }>;
  /** @deprecated Ignored — layout uses a fixed plot width with label column. */
  maxWidth?: number;
  barHeight?: number;
  barGap?: number;
  className?: string;
}) {
  if (stages.length === 0) {
    return (
      <div className={className} role="img" aria-label="No funnel data">
        <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
          No data to display
        </p>
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const padLeft = 108;
  const padRight = 52;
  const chartW = 420;
  const usableW = chartW - padLeft - padRight;
  const totalHeight = stages.length * (barHeight + barGap) - barGap;
  const corner = Math.min(barHeight / 2, 8);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${chartW} ${totalHeight}`}
        className="w-full overflow-visible"
        style={{ height: totalHeight, maxHeight: totalHeight + 4 }}
        role="img"
        aria-label={stages.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {stages.map((stage, i) => {
          const y = i * (barHeight + barGap);
          const width = Math.max((stage.value / maxValue) * usableW, stage.value > 0 ? 8 : 0);
          const x = padLeft;

          return (
            <g key={stage.label}>
              {/* Track */}
              <rect
                x={padLeft}
                y={y}
                width={usableW}
                height={barHeight}
                rx={corner}
                fill={chartTokens.track}
                opacity={0.85}
              />
              {/* Fill */}
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx={corner}
                fill={stage.color}
                className="transition-[width] duration-500 ease-out motion-reduce:transition-none"
              >
                <title>{`${stage.label}: ${stage.value}`}</title>
              </rect>
              {/* Stage label */}
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
                {stage.label.length > 12 ? `${stage.label.slice(0, 11)}…` : stage.label}
              </text>
              {/* Value */}
              <text
                x={width > 44 ? x + width - 10 : padLeft + Math.max(width, 4) + 8}
                y={y + barHeight / 2}
                textAnchor={width > 44 ? 'end' : 'start'}
                dominantBaseline="middle"
                fill={width > 44 ? chartTokens.onFill : chartTokens.axis}
                fontSize={11}
                fontFamily={chartTokens.fontMono}
                fontWeight={700}
              >
                {stage.value}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[var(--chart-cell-radius)]"
              style={{ backgroundColor: stage.color }}
              aria-hidden
            />
            <span className="text-[color:var(--color-text-secondary)]">{stage.label}</span>
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
