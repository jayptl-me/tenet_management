'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import { chartTokens, chartTooltipClass } from '@/lib/chart-theme';

/**
 * StackedBarChart — horizontal stacked bars using design tokens.
 * Segment colors should be CSS vars (e.g. var(--color-success-500)).
 * Outer corners are rounded via clipPath so middle segments stay flush.
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
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<{
    bar: string;
    seg: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const safeBars = bars.length > 0 ? bars : [];
  const maxTotal = Math.max(
    ...safeBars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0)),
    1,
  );
  const totalHeight = Math.max(safeBars.length * (barHeight + barGap) - barGap, barHeight);
  const padLeft = 112;
  const padRight = 48;
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
      <div className={className} role="img" aria-label="No stacked bar data">
        <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
          No data to display
        </p>
      </div>
    );
  }

  return (
    <div className={clsx('relative', className)}>
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
          const clipId = `stack-clip-${uid}-${i}`;

          return (
            <g key={`${bar.label}-${i}`}>
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={padLeft}
                    y={y}
                    width={Math.max(totalW, 0)}
                    height={barHeight}
                    rx={corner}
                    ry={corner}
                  />
                </clipPath>
              </defs>

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

              <text
                x={padLeft - 12}
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

              <g clipPath={`url(#${clipId})`}>
                {activeSegs.map((seg, j) => {
                  const segW = total > 0 ? (seg.value / total) * totalW : 0;
                  if (segW <= 0) return null;
                  const x = currentX;
                  currentX += segW;

                  return (
                    <rect
                      key={`${seg.label}-${j}`}
                      x={x}
                      y={y}
                      width={Math.max(segW, 0)}
                      height={barHeight}
                      fill={seg.color}
                      className="cursor-default transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none"
                      onMouseEnter={(e) => {
                        const rect = (
                          e.currentTarget.ownerSVGElement as SVGSVGElement
                        ).getBoundingClientRect();
                        const svg = e.currentTarget.ownerSVGElement!;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        // Approximate tooltip under cursor within component
                        setHover({
                          bar: bar.label,
                          seg: seg.label,
                          value: seg.value,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>{`${seg.label}: ${seg.value}`}</title>
                    </rect>
                  );
                })}
              </g>

              {/* Value labels on wide segments (above clip so text not clipped wrongly) */}
              {(() => {
                let lx = padLeft;
                return activeSegs.map((seg, j) => {
                  const segW = total > 0 ? (seg.value / total) * totalW : 0;
                  const cx = lx + segW / 2;
                  lx += segW;
                  if (segW <= 36) return null;
                  return (
                    <text
                      key={`lbl-${seg.label}-${j}`}
                      x={cx}
                      y={y + barHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={chartTokens.onFill}
                      fontSize={10}
                      fontFamily={chartTokens.fontMono}
                      fontWeight={700}
                      style={{ pointerEvents: 'none' }}
                    >
                      {seg.value}
                    </text>
                  );
                });
              })()}

              <text
                x={padLeft + Math.max(totalW, 4) + 10}
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

      {hover && (
        <div
          className={clsx(chartTooltipClass, 'absolute text-[11px]')}
          style={{
            left: hover.x,
            top: hover.y,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
          role="tooltip"
        >
          <p className="font-bold">{hover.bar}</p>
          <p className="mt-0.5 opacity-90">
            {hover.seg}: {hover.value}
          </p>
        </div>
      )}

      {showLegend && legendItems.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[11px] font-semibold">
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
