'use client';

import { useState, useId, useMemo } from 'react';
import { chartTokens, chartTooltipClass } from '@/lib/chart-theme';
import { clsx } from 'clsx';

function formatCurrencyLabel(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

/** Compute smooth cubic Bézier spline curve through points */
function getSmoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const cp1x = p0.x + dx * 0.45;
    const cp1y = p0.y;
    const cp2x = p1.x - dx * 0.45;
    const cp2y = p1.y;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
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
  /** Show subtle area gradient fill underneath curves */
  showAreaFill?: boolean;
}

/**
 * Modern Tremor & Linear style theme-aware curved area chart.
 * Features smooth cubic Bézier splines, gradient glow area fills,
 * interactive cursor-tracking crosshair, and rich dynamic tooltips.
 */
export function LineChart({
  data,
  labels,
  lines,
  height = 220,
  showGrid = true,
  isCurrency = false,
  mode = 'line',
  showLegend = true,
  showAreaFill = true,
}: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartAreaH = height;
  const baselineH = 26;
  const yLabelW = 58;
  const padX = 14;
  const width = 600;
  const innerW = width - padX * 2;

  const allValues = useMemo(
    () => data.flatMap((d) => lines.map((l) => d[l.key] ?? 0)),
    [data, lines],
  );

  const rawMax = Math.max(...allValues, 1);
  const maxVal = rawMax * 1.18;
  const minVal = 0;
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

  // Legend swatches
  const legend = showLegend && lines.length > 0 && (
    <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {lines.map((line) => (
        <div key={line.key} className="flex items-center gap-2 text-[11px] font-semibold">
          <span
            className="h-2 w-2 shrink-0 rounded-full shadow-[var(--shadow-xs)]"
            style={{ backgroundColor: line.color || chartTokens.brand }}
            aria-hidden="true"
          />
          <span className="text-[color:var(--color-text-secondary)]">{line.label}</span>
        </div>
      ))}
    </div>
  );

  // ── Legacy Bar Mode Support ────────────────────────────
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
      <div
        className="w-full"
        role="region"
        aria-label={lines.map((l) => `${l.label} chart`).join(', ') || 'Bar chart'}
      >
        <div className="flex gap-0">
          {showGrid && (
            <div
              className="relative flex-shrink-0 overflow-visible"
              style={{ width: yLabelW, height: chartAreaH }}
            >
              {gridRows.map((gr, i) => (
                <div
                  key={i}
                  className="absolute right-2 text-right"
                  style={{ top: gr.y, transform: 'translateY(-50%)' }}
                >
                  <span className="font-mono text-[10px] font-medium whitespace-nowrap text-[color:var(--chart-axis)] tabular-nums">
                    {formatVal(gr.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="relative flex-1" style={{ height: chartAreaH + baselineH }}>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 rounded-[var(--radius-sm)] bg-[color:var(--chart-track)] opacity-30"
              style={{ height: chartAreaH }}
              aria-hidden="true"
            />
            {showGrid &&
              gridRows.map((gr, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute right-0 left-0 border-t border-[color:var(--chart-grid)]"
                  style={{
                    top: gr.y,
                    opacity: i === gridCount ? 0.9 : 0.45,
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
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <div className="absolute right-0 bottom-0 left-0 flex flex-row items-end justify-center gap-[2px] px-0.5">
                    {barGroup.map((seg) => (
                      <div
                        key={seg.key}
                        className="flex-1 rounded-t-[var(--chart-bar-radius)] transition-opacity duration-150"
                        style={{
                          height: `${seg.height}px`,
                          backgroundColor: seg.color || chartTokens.bar,
                          opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.45,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Tooltip */}
            {hoverIdx !== null && data[hoverIdx] && (
              <div
                className="pointer-events-none absolute top-2 z-20 transition-all duration-100"
                style={{
                  left: `${((hoverIdx + 0.5) / data.length) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className={clsx(chartTooltipClass, 'shadow-[var(--shadow-md)]')}>
                  <p className="mb-1 border-b border-[color:var(--border-color)]/50 pb-1 text-[11px] font-bold">
                    {labels[hoverIdx]}
                  </p>
                  {lines.map((line) => (
                    <p key={line.key} className="text-[10px] font-medium opacity-90">
                      {line.label}: {formatVal(data[hoverIdx]![line.key] ?? 0)}
                    </p>
                  ))}
                </div>
              </div>
            )}
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

  // ── Modern Smooth Area/Line Mode ───────────────────────
  const pointsFor = (key: string) =>
    data.map((d, i) => {
      const x = data.length <= 1 ? padX + innerW / 2 : padX + (i / (data.length - 1)) * innerW;
      const val = d[key] ?? 0;
      const y = chartAreaH - ((val - minVal) / range) * chartAreaH;
      return { x, y, val };
    });

  const seriesData = lines.map((line) => {
    const pts = pointsFor(line.key);
    const curveD = getSmoothCurvePath(pts);
    const areaD =
      pts.length > 1
        ? `${curveD} L ${pts[pts.length - 1].x} ${chartAreaH} L ${pts[0].x} ${chartAreaH} Z`
        : '';
    return { ...line, pts, curveD, areaD };
  });

  const activeX =
    hoverIdx !== null && data.length > 1 ? padX + (hoverIdx / (data.length - 1)) * innerW : null;

  return (
    <div className="w-full" role="region" aria-label="Curved Area Trend Chart">
      <div className="flex gap-0">
        {/* Y-Axis Labels */}
        {showGrid && (
          <div
            className="relative flex-shrink-0 overflow-visible"
            style={{ width: yLabelW, height: chartAreaH }}
          >
            {gridRows.map((gr, i) => (
              <div
                key={i}
                className="absolute right-2 text-right"
                style={{ top: gr.y, transform: 'translateY(-50%)' }}
              >
                <span className="font-mono text-[10px] font-medium text-[color:var(--chart-axis)] tabular-nums">
                  {formatVal(gr.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chart Surface */}
        <div
          className="relative flex-1"
          style={{ height: chartAreaH + baselineH }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${chartAreaH}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
          >
            <defs>
              {lines.map((line) => (
                <linearGradient
                  key={line.key}
                  id={`area-grad-${line.key}-${uid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={line.color || chartTokens.brand}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="60%"
                    stopColor={line.color || chartTokens.brand}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={line.color || chartTokens.brand}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              ))}
            </defs>

            {/* Grid Lines */}
            {showGrid &&
              gridRows.map((gr, i) => (
                <line
                  key={i}
                  x1={0}
                  x2={width}
                  y1={gr.y}
                  y2={gr.y}
                  stroke={i === gridCount ? 'var(--chart-grid-strong)' : 'var(--chart-grid)'}
                  strokeDasharray={i === gridCount ? undefined : '3 3'}
                  strokeOpacity={i === gridCount ? 0.9 : 0.45}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

            {/* Area Fills */}
            {showAreaFill &&
              seriesData.map((s) => (
                <path
                  key={`area-${s.key}`}
                  d={s.areaD}
                  fill={`url(#area-grad-${s.key}-${uid})`}
                  className="transition-opacity duration-300"
                />
              ))}

            {/* Smooth Curves */}
            {seriesData.map((s) => (
              <path
                key={`curve-${s.key}`}
                d={s.curveD}
                fill="none"
                stroke={s.color || chartTokens.brand}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Vertical Tracking Crosshair Line */}
            {activeX !== null && (
              <line
                x1={activeX}
                x2={activeX}
                y1={0}
                y2={chartAreaH}
                stroke="var(--color-text-secondary)"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Active Data Point Halo Circles */}
            {hoverIdx !== null &&
              seriesData.map((s) => {
                const pt = s.pts[hoverIdx];
                if (!pt) return null;
                return (
                  <g key={`point-${s.key}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={7}
                      fill={s.color || chartTokens.brand}
                      fillOpacity={0.25}
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={4}
                      fill={s.color || chartTokens.brand}
                      stroke="var(--color-card-bg)"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
          </svg>

          {/* Invisible Interactive Column Scrubbers for Snappy Hover */}
          <div className="absolute inset-0 flex" style={{ height: chartAreaH }}>
            {data.map((_, i) => (
              <div
                key={i}
                className="h-full flex-1 cursor-crosshair"
                onMouseEnter={() => setHoverIdx(i)}
              />
            ))}
          </div>

          {/* Floating Context-Aware Tooltip */}
          {hoverIdx !== null && data[hoverIdx] && (
            <div
              className="pointer-events-none absolute z-20 transition-all duration-75"
              style={{
                left: `${((hoverIdx + 0.5) / data.length) * 100}%`,
                top: '0px',
                transform: `translate(${hoverIdx === 0 ? '0%' : hoverIdx === data.length - 1 ? '-100%' : '-50%'}, -110%)`,
              }}
            >
              <div className={clsx(chartTooltipClass, 'min-w-[130px] shadow-[var(--shadow-md)]')}>
                <p className="mb-1.5 border-b border-[color:var(--border-color)]/60 pb-1 text-[11px] font-bold text-[color:var(--color-text-primary)]">
                  {labels[hoverIdx]}
                </p>
                <div className="space-y-1">
                  {lines.map((line) => {
                    const val = data[hoverIdx]![line.key] ?? 0;
                    return (
                      <div
                        key={line.key}
                        className="flex items-center justify-between gap-3 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: line.color || chartTokens.brand }}
                          />
                          {line.label}
                        </span>
                        <span className="font-mono font-bold text-[color:var(--color-text-primary)] tabular-nums">
                          {formatVal(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* X-Axis Labels */}
          <div className="mt-1 flex justify-between px-2">
            {labels.map((lab, i) =>
              i % labelInterval === 0 ? (
                <span
                  key={i}
                  className={clsx(
                    'text-[10px] font-medium text-[color:var(--chart-axis)] transition-colors',
                    hoverIdx === i && 'font-bold text-[color:var(--color-text-primary)]',
                  )}
                >
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

export default LineChart;
