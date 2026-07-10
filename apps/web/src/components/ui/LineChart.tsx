'use client';

import { useState } from 'react';
import { chartTokens, chartTooltipClass } from '@/lib/chart-theme';

function formatCurrencyLabel(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

export interface LineChartSeries {
  key: string;
  color: string;
  label: string;
}

export interface LineChartProps {
  data: Array<Record<string, number>>;
  labels: string[];
  lines: LineChartSeries[];
  height?: number;
  showGrid?: boolean;
  isCurrency?: boolean;
  /** When true, draws polyline series; when false, grouped bars (legacy dashboard style). */
  mode?: 'line' | 'bar';
  /** Series legend under the plot (token-colored swatches). */
  showLegend?: boolean;
}

/**
 * Theme-aware chart for revenue / metric series.
 * Default mode is true line chart (SVG). Bar mode preserves prior dashboard look.
 */
export function LineChart({
  data,
  labels,
  lines,
  height = 200,
  showGrid = true,
  isCurrency = false,
  mode = 'line',
  showLegend = true,
}: LineChartProps) {
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const chartAreaH = height;
  const baselineH = 24;
  const yLabelW = 64;
  const padX = 8;

  const legend = showLegend && lines.length > 0 && (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {lines.map((line) => (
        <div key={line.key} className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[var(--chart-cell-radius)]"
            style={{ backgroundColor: line.color || chartTokens.bar }}
            aria-hidden
          />
          <span className="text-[color:var(--color-text-secondary)]">{line.label}</span>
        </div>
      ))}
    </div>
  );

  const allValues = data.flatMap((d) => lines.map((l) => d[l.key] ?? 0));
  const rawMax = Math.max(...allValues, 1);
  const maxVal = rawMax * 1.2;
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const maxVisibleLabels = 7;
  const labelInterval =
    data.length <= maxVisibleLabels ? 1 : Math.ceil(data.length / maxVisibleLabels);

  const gridCount = 4;
  const gridRows = Array.from({ length: gridCount + 1 }, (_, i) => {
    const y = chartAreaH - (i / gridCount) * chartAreaH;
    const rawVal = minVal + range * (i / gridCount);
    return { y, value: rawVal };
  });

  const formatVal = (v: number) => (isCurrency ? formatCurrencyLabel(v) : String(Math.round(v)));

  if (mode === 'bar') {
    const bars = data.map((d) =>
      lines.map((line) => {
        const val = d[line.key] ?? 0;
        const h = range > 0 ? ((val - minVal) / range) * chartAreaH : 0;
        return {
          key: line.key,
          color: line.color,
          height: Math.max(h, val > 0 ? 4 : 0),
          value: val,
        };
      }),
    );

    return (
      <div className="w-full">
        <div className="flex gap-0">
          {showGrid && (
            <div
              className="relative flex-shrink-0 overflow-visible"
              style={{ width: yLabelW, height: chartAreaH }}
            >
              {gridRows.map((gr, i) => (
                <div
                  key={i}
                  className="absolute right-0 text-right"
                  style={{ top: gr.y, transform: 'translateY(-50%)' }}
                >
                  <span className="whitespace-nowrap font-mono text-[10px] font-medium tabular-nums text-[color:var(--chart-axis)]">
                    {formatVal(gr.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="relative flex-1" style={{ height: chartAreaH + baselineH }}>
            {/* Plot track */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 rounded-[var(--radius-sm)] bg-[color:var(--chart-track)] opacity-40"
              style={{ height: chartAreaH }}
              aria-hidden
            />
            {showGrid &&
              gridRows.map((gr, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute left-0 right-0 border-t border-[color:var(--chart-grid)]"
                  style={{
                    top: gr.y,
                    opacity: i === gridCount ? 0.9 : 0.5,
                    borderStyle: i === gridCount ? 'solid' : 'dashed',
                    borderColor: i === gridCount ? 'var(--chart-grid-strong)' : 'var(--chart-grid)',
                  }}
                />
              ))}
            <div
              className="relative flex items-end gap-[6px] sm:gap-2"
              style={{ height: chartAreaH }}
            >
              {bars.map((barGroup, i) => (
                <div
                  key={i}
                  className="relative flex-1 cursor-pointer"
                  style={{ height: chartAreaH, minWidth: 24 }}
                  onMouseEnter={() => setTooltipIdx(i)}
                  onMouseLeave={() => setTooltipIdx(null)}
                >
                  <div className="absolute bottom-0 left-0 right-0 flex flex-row items-end justify-center gap-[2px] px-0.5">
                    {barGroup.map((seg) => (
                      <div
                        key={seg.key}
                        className="flex-1 rounded-t-[var(--chart-bar-radius)] transition-opacity duration-150"
                        style={{
                          height: `${seg.height}px`,
                          backgroundColor: seg.color || chartTokens.bar,
                          opacity: tooltipIdx === null || tooltipIdx === i ? 1 : 0.45,
                        }}
                      />
                    ))}
                  </div>
                  {tooltipIdx === i && (
                    <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">
                      <div className={`${chartTooltipClass} text-center`}>
                        <p className="text-[11px] font-bold">{labels[i]}</p>
                        {barGroup.map((seg) => (
                          <p key={seg.key} className="mt-0.5 text-[10px] font-medium opacity-90">
                            {seg.key}: {formatVal(seg.value)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[6px] sm:gap-2">
              {labels.map((lab, i) => (
                <div key={i} className="flex-1 text-center" style={{ minWidth: 24 }}>
                  {i % labelInterval === 0 && (
                    <span className="text-[10px] font-medium text-[color:var(--chart-axis)]">
                      {lab}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        {legend}
      </div>
    );
  }

  // ── True line chart ──
  const width = 600;
  const innerW = width - padX * 2;
  const pointsFor = (key: string) =>
    data.map((d, i) => {
      const x = data.length <= 1 ? padX + innerW / 2 : padX + (i / (data.length - 1)) * innerW;
      const val = d[key] ?? 0;
      const y = chartAreaH - ((val - minVal) / range) * chartAreaH;
      return { x, y, val };
    });

  return (
    <div className="w-full">
      <div className="flex gap-0">
        {showGrid && (
          <div className="relative flex-shrink-0" style={{ width: yLabelW, height: chartAreaH }}>
            {gridRows.map((gr, i) => (
              <div
                key={i}
                className="absolute right-0 text-right"
                style={{ top: gr.y, transform: 'translateY(-50%)' }}
              >
                <span className="font-mono text-[10px] font-medium tabular-nums text-[color:var(--chart-axis)]">
                  {formatVal(gr.value)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex-1" style={{ height: chartAreaH + baselineH }}>
          <svg
            viewBox={`0 0 ${width} ${chartAreaH}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label="Line chart"
          >
            {showGrid &&
              gridRows.map((gr, i) => (
                <line
                  key={i}
                  x1={0}
                  x2={width}
                  y1={gr.y}
                  y2={gr.y}
                  stroke={i === gridCount ? chartTokens.gridStrong : chartTokens.grid}
                  strokeDasharray={i === gridCount ? undefined : '4 4'}
                  strokeOpacity={i === gridCount ? 0.9 : 0.55}
                />
              ))}
            {lines.map((line) => {
              const pts = pointsFor(line.key);
              const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <g key={line.key}>
                  <path
                    d={path}
                    fill="none"
                    stroke={line.color || chartTokens.bar}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={tooltipIdx === i ? 5 : 3.5}
                      fill={line.color || chartTokens.bar}
                      stroke="var(--color-card-bg)"
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      onMouseEnter={() => setTooltipIdx(i)}
                      onMouseLeave={() => setTooltipIdx(null)}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          {tooltipIdx != null && data[tooltipIdx] && (
            <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2">
              <div className={chartTooltipClass}>
                <p className="text-[11px] font-bold">{labels[tooltipIdx]}</p>
                {lines.map((line) => (
                  <p key={line.key} className="text-[10px] font-medium opacity-90">
                    {line.label}: {formatVal(data[tooltipIdx]![line.key] ?? 0)}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="mt-1 flex justify-between px-1">
            {labels.map((lab, i) =>
              i % labelInterval === 0 ? (
                <span key={i} className="text-[10px] font-medium text-[color:var(--chart-axis)]">
                  {lab}
                </span>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>
      </div>
      {legend}
    </div>
  );
}
