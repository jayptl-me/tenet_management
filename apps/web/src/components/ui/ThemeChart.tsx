'use client';

import { useMemo } from 'react';

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
}

// ── Helper: get computed theme colors ─────────────────

function getThemeColors() {
  if (typeof document === 'undefined') {
    return {
      brand: '#6366f1',
      surface: '#a1a1aa',
      surfaceDark: '#27272a',
      grid: '#e4e4e7',
      text: '#18181b',
      muted: '#a1a1aa',
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
      bg: '#fafafa',
      cardBg: '#f4f4f5',
    };
  }
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    brand: style.getPropertyValue('--color-brand-500').trim() || '#6366f1',
    surface: style.getPropertyValue('--color-surface-400').trim() || '#a1a1aa',
    surfaceDark: style.getPropertyValue('--color-surface-700').trim() || '#27272a',
    grid: style.getPropertyValue('--color-surface-200').trim() || '#e4e4e7',
    text: style.getPropertyValue('--color-surface-900').trim() || '#18181b',
    muted: style.getPropertyValue('--color-surface-400').trim() || '#a1a1aa',
    danger: style.getPropertyValue('--color-danger-500').trim() || '#ef4444',
    success: style.getPropertyValue('--color-success-500').trim() || '#22c55e',
    warning: style.getPropertyValue('--color-warning-500').trim() || '#f59e0b',
    bg: style.getPropertyValue('--color-surface-50').trim() || '#fafafa',
    cardBg: style.getPropertyValue('--color-surface-100').trim() || '#f4f4f5',
  };
}

// ── Bar Chart ─────────────────────────────────────────

export function BarChart({
  data,
  height = 240,
  showGrid = true,
  showValues = false,
  animated = true,
  variant = 'single',
  secondaryLabel,
  primaryLabel,
}: BarChartProps) {
  const colors = getThemeColors();
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)), 1);
  const padTop = 20;
  const padBottom = 30;
  const padLeft = 8;
  const padRight = 8;
  const chartW = 100;
  const chartH = height - padTop - padBottom;
  const barGap = 2;
  const barCount = data.length;
  const barTotalWidth = (chartW - barGap * (barCount - 1)) / barCount;

  const gridLines = useMemo(() => {
    const lines = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartH / steps) * i;
      lines.push({ y, value: maxVal - (maxVal / steps) * i });
    }
    return lines;
  }, [maxVal, chartH]);

  return (
    <svg
      viewBox={`0 0 ${chartW + padLeft + padRight} ${height}`}
      className="w-full"
      style={{ height, maxHeight: height }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {showGrid &&
        gridLines.map((gl, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={chartW + padLeft}
              y2={gl.y}
              stroke={colors.grid}
              strokeWidth={0.5}
              strokeDasharray={i === 0 ? '' : '3,3'}
            />
            {showValues && (
              <text
                x={padLeft - 4}
                y={gl.y + 3}
                textAnchor="end"
                fill={colors.muted}
                fontSize="6"
                fontFamily="var(--font-mono, monospace)"
              >
                {Math.round(gl.value)}
              </text>
            )}
          </g>
        ))}

      {/* Bars */}
      {data.map((point, i) => {
        const x = padLeft + i * (barTotalWidth + barGap);
        const barH = (point.value / maxVal) * chartH;
        const barY = padTop + chartH - barH;

        // Secondary bar (for stacked/grouped)
        const secH = point.secondaryValue
          ? (point.secondaryValue / maxVal) * chartH
          : 0;
        const secY = variant === 'stacked' ? barY - secH : padTop + chartH - secH;

        return (
          <g key={i}>
            {/* Secondary bar */}
            {point.secondaryValue !== undefined && (
              <rect
                x={variant === 'grouped' ? x + barTotalWidth * 0.15 : x}
                y={secY}
                width={variant === 'grouped' ? barTotalWidth * 0.4 : barTotalWidth}
                height={secH}
                fill={point.color ?? colors.surface}
                rx={1}
                opacity={0.6}
                className={animated ? 'animate-fade-in-up' : ''}
              >
                {animated && (
                  <animate
                    attributeName="height"
                    from="0"
                    to={secH}
                    dur="0.4s"
                    begin={`${i * 0.05}s`}
                    fill="freeze"
                  />
                )}
              </rect>
            )}

            {/* Primary bar */}
            <rect
              x={variant === 'grouped' && point.secondaryValue !== undefined
                ? x + barTotalWidth * 0.55
                : x + barTotalWidth * 0.1}
              y={barY}
              width={variant === 'grouped' ? barTotalWidth * 0.4 : barTotalWidth * 0.8}
              height={barH}
              fill={point.color ?? colors.brand}
              rx={1.5}
              className={animated ? 'animate-fade-in-up' : ''}
            >
              {animated && (
                <animate
                  attributeName="height"
                  from="0"
                  to={barH}
                  dur="0.4s"
                  begin={`${i * 0.05}s`}
                  fill="freeze"
                />
              )}
            </rect>

            {/* Value label on bar */}
            {showValues && (
              <text
                x={x + barTotalWidth / 2}
                y={barY - 4}
                textAnchor="middle"
                fill={colors.text}
                fontSize="5"
                fontFamily="var(--font-body, sans-serif)"
                fontWeight="600"
              >
                {point.value}
              </text>
            )}

            {/* X-axis label */}
            <text
              x={x + barTotalWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fill={colors.muted}
              fontSize="5.5"
              fontFamily="var(--font-body, sans-serif)"
            >
              {point.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {primaryLabel && secondaryLabel && (
        <g transform={`translate(${chartW - 60}, 4)`}>
          <rect x={0} y={0} width={6} height={6} fill={colors.brand} rx={1} />
          <text x={8} y={5} fill={colors.text} fontSize="5.5" fontFamily="var(--font-body, sans-serif)">
            {primaryLabel}
          </text>
          <rect x={0} y={10} width={6} height={6} fill={colors.surface} rx={1} opacity={0.6} />
          <text x={8} y={15} fill={colors.text} fontSize="5.5" fontFamily="var(--font-body, sans-serif)">
            {secondaryLabel}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Mini Sparkline ────────────────────────────────────

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
  const colors = getThemeColors();
  const lineColor = color ?? colors.brand;

  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[color:var(--color-text-muted)] text-[10px]"
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

  const polyline = points.join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-fade-in-up"
      />
      {showDot && (
        <circle
          cx={Number(points[points.length - 1].split(',')[0])}
          cy={Number(points[points.length - 1].split(',')[1])}
          r={3}
          fill={lineColor}
          stroke="var(--color-surface-50, white)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

// ── Donut / Ring Chart ────────────────────────────────

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
  const colors = getThemeColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor ?? colors.grid}
          strokeWidth={strokeWidth}
        />
        {/* Value circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color ?? colors.brand}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-fade-in-up"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={circumference}
            to={offset}
            dur="0.6s"
            fill="freeze"
          />
        </circle>
      </svg>
      {label && (
        <span className="text-surface-900 font-display text-sm font-bold">{label}</span>
      )}
      {sublabel && (
        <span className="text-surface-400 font-body text-xs">{sublabel}</span>
      )}
    </div>
  );
}
