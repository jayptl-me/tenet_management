'use client';

import { useId, useMemo } from 'react';
import { chartTokens } from '@/lib/chart-theme';

// ── Types ──────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  height?: number;
  showGrid?: boolean;
  showValues?: boolean;
  animated?: boolean;
  variant?: 'stacked' | 'grouped' | 'single';
  secondaryLabel?: string;
  primaryLabel?: string;
  className?: string;
}

// ── Bar Chart ─────────────────────────────────────────

/**
 * Vertical bar chart driven entirely by CSS design tokens.
 * Theme switches (light/dark / brand) update without re-reading getComputedStyle.
 */
export function BarChart({
  data,
  height = 240,
  showGrid = true,
  showValues = false,
  animated = true,
  variant = 'single',
  secondaryLabel,
  primaryLabel,
  className,
}: BarChartProps) {
  const uid = useId().replace(/:/g, '');
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)), 1);

  const padTop = 24;
  const padBottom = 36;
  const padLeft = 8;
  const padRight = 8;
  const chartW = 100;
  const chartH = height - padTop - padBottom;
  const barGap = 2.5;
  const barCount = Math.max(data.length, 1);
  const barTotalWidth = (chartW - barGap * (barCount - 1)) / barCount;

  const gridLines = useMemo(() => {
    const lines: Array<{ y: number; value: number }> = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartH / steps) * i;
      lines.push({ y, value: maxVal - (maxVal / steps) * i });
    }
    return lines;
  }, [maxVal, chartH]);

  // CSS handles reduced motion via motion-reduce utilities where available;
  // keep SVG SMIL optional for progressive enhancement only.
  const doAnimate = animated;

  return (
    <svg
      viewBox={`0 0 ${chartW + padLeft + padRight} ${height}`}
      className={className ?? 'w-full'}
      style={{ height, maxHeight: height }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        primaryLabel
          ? `${primaryLabel} bar chart`
          : `Bar chart with ${data.length} categories`
      }
    >
      <defs>
        <clipPath id={`bar-clip-${uid}`}>
          <rect x={padLeft} y={padTop} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {/* Track background */}
      <rect
        x={padLeft}
        y={padTop}
        width={chartW}
        height={chartH}
        fill={chartTokens.track}
        rx={2}
        opacity={0.45}
      />

      {showGrid &&
        gridLines.map((gl, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={chartW + padLeft}
              y2={gl.y}
              stroke={i === gridLines.length - 1 ? chartTokens.gridStrong : chartTokens.grid}
              strokeWidth={0.35}
              strokeDasharray={i === gridLines.length - 1 ? undefined : '2 2'}
            />
            {showValues && (
              <text
                x={padLeft - 1.5}
                y={gl.y + 1.5}
                textAnchor="end"
                fill={chartTokens.axis}
                fontSize="5"
                fontFamily={chartTokens.fontMono}
              >
                {Math.round(gl.value)}
              </text>
            )}
          </g>
        ))}

      <g clipPath={`url(#bar-clip-${uid})`}>
        {data.map((point, i) => {
          const x = padLeft + i * (barTotalWidth + barGap);
          const barH = (point.value / maxVal) * chartH;
          const barY = padTop + chartH - barH;
          const secH = point.secondaryValue
            ? (point.secondaryValue / maxVal) * chartH
            : 0;
          const secY =
            variant === 'stacked' ? barY - secH : padTop + chartH - secH;
          const primaryFill = point.color ?? chartTokens.bar;
          const secondaryFill = chartTokens.barSecondary;
          const primaryX =
            variant === 'grouped' && point.secondaryValue !== undefined
              ? x + barTotalWidth * 0.52
              : x + barTotalWidth * 0.12;
          const primaryW =
            variant === 'grouped' && point.secondaryValue !== undefined
              ? barTotalWidth * 0.36
              : barTotalWidth * 0.76;

          return (
            <g key={`${point.label}-${i}`}>
              {point.secondaryValue !== undefined && (
                <rect
                  x={variant === 'grouped' ? x + barTotalWidth * 0.12 : x + barTotalWidth * 0.12}
                  y={secY}
                  width={
                    variant === 'grouped' ? barTotalWidth * 0.36 : barTotalWidth * 0.76
                  }
                  height={Math.max(secH, 0)}
                  fill={secondaryFill}
                  rx={1.5}
                  ry={1.5}
                  opacity={variant === 'stacked' ? 0.85 : 1}
                >
                  {doAnimate && (
                    <animate
                      attributeName="height"
                      from="0"
                      to={String(Math.max(secH, 0))}
                      dur="0.45s"
                      begin={`${i * 0.04}s`}
                      fill="freeze"
                      calcMode="spline"
                      keySplines="0.16 1 0.3 1"
                      keyTimes="0;1"
                    />
                  )}
                </rect>
              )}

              <rect
                x={primaryX}
                y={barY}
                width={primaryW}
                height={Math.max(barH, point.value > 0 ? 1 : 0)}
                fill={primaryFill}
                rx={1.5}
                ry={1.5}
              >
                {doAnimate && (
                  <animate
                    attributeName="height"
                    from="0"
                    to={String(Math.max(barH, point.value > 0 ? 1 : 0))}
                    dur="0.45s"
                    begin={`${i * 0.04}s`}
                    fill="freeze"
                    calcMode="spline"
                    keySplines="0.16 1 0.3 1"
                    keyTimes="0;1"
                  />
                )}
              </rect>

              {showValues && point.value > 0 && (
                <text
                  x={x + barTotalWidth / 2}
                  y={barY - 3}
                  textAnchor="middle"
                  fill={chartTokens.label}
                  fontSize="5"
                  fontFamily={chartTokens.fontMono}
                  fontWeight={600}
                >
                  {point.value}
                </text>
              )}

              <text
                x={x + barTotalWidth / 2}
                y={height - 10}
                textAnchor="middle"
                fill={chartTokens.axis}
                fontSize="5.5"
                fontFamily={chartTokens.fontBody}
                fontWeight={500}
              >
                {point.label.length > 8
                  ? `${point.label.slice(0, 7)}…`
                  : point.label}
              </text>
            </g>
          );
        })}
      </g>

      {primaryLabel && secondaryLabel && (
        <g transform={`translate(${padLeft}, 6)`}>
          <rect x={0} y={0} width={5} height={5} fill={chartTokens.bar} rx={1} />
          <text
            x={7}
            y={4}
            fill={chartTokens.label}
            fontSize="5.5"
            fontFamily={chartTokens.fontBody}
            fontWeight={600}
          >
            {primaryLabel}
          </text>
          <rect
            x={primaryLabel.length * 3.2 + 14}
            y={0}
            width={5}
            height={5}
            fill={chartTokens.barSecondary}
            rx={1}
          />
          <text
            x={primaryLabel.length * 3.2 + 21}
            y={4}
            fill={chartTokens.label}
            fontSize="5.5"
            fontFamily={chartTokens.fontBody}
            fontWeight={600}
          >
            {secondaryLabel}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Mini Sparkline (legacy export from ThemeChart) ────

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDot?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 32,
  color,
  strokeWidth = 2,
  showDot = true,
}: SparklineProps) {
  const lineColor = color ?? chartTokens.bar;

  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-[color:var(--color-text-muted)]"
      >
        —
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padV = 4;
  const plotH = height - padV * 2;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = padV + plotH - ((val - min) / range) * plotH;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Sparkline">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={Number(points[points.length - 1].split(',')[0])}
          cy={Number(points[points.length - 1].split(',')[1])}
          r={3}
          fill={lineColor}
          stroke="var(--color-card-bg)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

// ── Donut / Ring Chart (single-value) ─────────────────

export interface DonutChartProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  sublabel?: string;
}

export function DonutChart({
  value,
  max = 100,
  size = 64,
  strokeWidth = 6,
  color,
  bgColor,
  label,
  sublabel,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${value} of ${max}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor ?? chartTokens.grid}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color ?? chartTokens.bar}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>
      {label && (
        <span className="font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="font-[family:var(--font-body)] text-xs text-[color:var(--color-text-muted)]">
          {sublabel}
        </span>
      )}
    </div>
  );
}
