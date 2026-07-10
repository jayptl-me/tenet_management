'use client';

import { useId, useMemo } from 'react';
import { clsx } from 'clsx';
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
  /** Format tick / value labels (default: integer). */
  formatValue?: (n: number) => string;
}

// ── Bar Chart ─────────────────────────────────────────

/**
 * Vertical bar chart driven entirely by CSS design tokens.
 * Theme switches (light/dark / brand) update without re-reading getComputedStyle.
 * Bars grow from the baseline; reduced-motion disables height animation.
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
  formatValue = (n) => String(Math.round(n)),
}: BarChartProps) {
  const uid = useId().replace(/:/g, '');
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)), 1);

  const padTop = showValues || primaryLabel ? 28 : 16;
  const padBottom = 40;
  const padLeft = showGrid ? 36 : 12;
  const padRight = 12;
  const chartW = 360;
  const chartH = height - padTop - padBottom;
  const plotW = chartW - padLeft - padRight;
  const barCount = Math.max(data.length, 1);
  const slotW = plotW / barCount;
  const corner = 4;

  const gridLines = useMemo(() => {
    const lines: Array<{ y: number; value: number }> = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartH / steps) * i;
      lines.push({ y, value: maxVal - (maxVal / steps) * i });
    }
    return lines;
  }, [maxVal, chartH, padTop]);

  if (data.length === 0) {
    return (
      <div
        className={clsx(
          'bg-[color:var(--chart-track)]/50 flex items-center justify-center rounded-[var(--radius-md)]',
          className,
        )}
        style={{ height }}
        role="img"
        aria-label="No bar chart data"
      >
        <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
          No data to display
        </p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${chartW} ${height}`}
      className={clsx('w-full max-w-full', className)}
      style={{ height, maxHeight: height }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        primaryLabel ? `${primaryLabel} bar chart` : `Bar chart with ${data.length} categories`
      }
    >
      <defs>
        <clipPath id={`bar-clip-${uid}`}>
          <rect x={padLeft} y={padTop} width={plotW} height={chartH} rx={2} />
        </clipPath>
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .bar-grow-${uid} { animation: none !important; transform: none !important; }
          }
          @keyframes bar-grow-${uid} {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }
          .bar-grow-${uid} {
            transform-origin: bottom;
            transform-box: fill-box;
            animation: bar-grow-${uid} 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        `}</style>
      </defs>

      {/* Plot track */}
      <rect
        x={padLeft}
        y={padTop}
        width={plotW}
        height={chartH}
        fill={chartTokens.track}
        rx={6}
        opacity={0.55}
      />

      {showGrid &&
        gridLines.map((gl, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={padLeft}
              y1={gl.y}
              x2={padLeft + plotW}
              y2={gl.y}
              stroke={i === gridLines.length - 1 ? chartTokens.gridStrong : chartTokens.grid}
              strokeWidth={i === gridLines.length - 1 ? 1 : 0.75}
              strokeDasharray={i === gridLines.length - 1 ? undefined : '3 3'}
            />
            <text
              x={padLeft - 8}
              y={gl.y + 3}
              textAnchor="end"
              fill={chartTokens.axis}
              fontSize={10}
              fontFamily={chartTokens.fontMono}
              fontWeight={500}
            >
              {formatValue(gl.value)}
            </text>
          </g>
        ))}

      <g clipPath={`url(#bar-clip-${uid})`}>
        {data.map((point, i) => {
          const slotX = padLeft + i * slotW;
          const hasSecondary = point.secondaryValue !== undefined;
          const primaryFill = point.color ?? chartTokens.bar;
          const secondaryFill = chartTokens.barSecondary;

          const primaryH = (point.value / maxVal) * chartH;
          const secH = hasSecondary ? ((point.secondaryValue ?? 0) / maxVal) * chartH : 0;

          let primaryX: number;
          let primaryW: number;
          let secX: number;
          let secW: number;
          let primaryY: number;
          let secY: number;

          if (variant === 'grouped' && hasSecondary) {
            primaryW = slotW * 0.32;
            secW = slotW * 0.32;
            const gap = slotW * 0.08;
            secX = slotX + slotW * 0.14;
            primaryX = secX + secW + gap;
            primaryY = padTop + chartH - primaryH;
            secY = padTop + chartH - secH;
          } else if (variant === 'stacked' && hasSecondary) {
            primaryW = slotW * 0.62;
            primaryX = slotX + (slotW - primaryW) / 2;
            secW = primaryW;
            secX = primaryX;
            primaryY = padTop + chartH - primaryH;
            secY = primaryY - secH;
          } else {
            primaryW = slotW * 0.58;
            primaryX = slotX + (slotW - primaryW) / 2;
            secW = 0;
            secX = 0;
            primaryY = padTop + chartH - primaryH;
            secY = 0;
          }

          const animClass = animated ? `bar-grow-${uid}` : undefined;
          const delay = `${Math.min(i * 0.04, 0.4)}s`;

          return (
            <g key={`${point.label}-${i}`}>
              {hasSecondary && secH > 0 && (
                <rect
                  className={animClass}
                  style={animated ? { animationDelay: delay } : undefined}
                  x={secX}
                  y={secY}
                  width={secW}
                  height={Math.max(secH, 0)}
                  fill={secondaryFill}
                  rx={corner}
                  ry={corner}
                  opacity={variant === 'stacked' ? 0.9 : 1}
                >
                  <title>
                    {secondaryLabel
                      ? `${secondaryLabel}: ${formatValue(point.secondaryValue ?? 0)}`
                      : formatValue(point.secondaryValue ?? 0)}
                  </title>
                </rect>
              )}

              <rect
                className={animClass}
                style={animated ? { animationDelay: delay } : undefined}
                x={primaryX}
                y={primaryY}
                width={primaryW}
                height={Math.max(primaryH, point.value > 0 ? 2 : 0)}
                fill={primaryFill}
                rx={corner}
                ry={corner}
              >
                <title>
                  {primaryLabel
                    ? `${point.label} · ${primaryLabel}: ${formatValue(point.value)}`
                    : `${point.label}: ${formatValue(point.value)}`}
                </title>
              </rect>

              {showValues && point.value > 0 && (
                <text
                  x={primaryX + primaryW / 2}
                  y={Math.min(primaryY, secY || primaryY) - 6}
                  textAnchor="middle"
                  fill={chartTokens.label}
                  fontSize={10}
                  fontFamily={chartTokens.fontMono}
                  fontWeight={600}
                >
                  {formatValue(point.value)}
                </text>
              )}

              <text
                x={slotX + slotW / 2}
                y={height - 14}
                textAnchor="middle"
                fill={chartTokens.axis}
                fontSize={11}
                fontFamily={chartTokens.fontBody}
                fontWeight={500}
              >
                {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
              </text>
            </g>
          );
        })}
      </g>

      {(primaryLabel || secondaryLabel) && (
        <g transform={`translate(${padLeft}, 10)`}>
          {primaryLabel && (
            <>
              <rect x={0} y={0} width={8} height={8} fill={chartTokens.bar} rx={2} />
              <text
                x={12}
                y={7}
                fill={chartTokens.label}
                fontSize={11}
                fontFamily={chartTokens.fontBody}
                fontWeight={600}
              >
                {primaryLabel}
              </text>
            </>
          )}
          {secondaryLabel && (
            <>
              <rect
                x={(primaryLabel?.length ?? 0) * 6.5 + 28}
                y={0}
                width={8}
                height={8}
                fill={chartTokens.barSecondary}
                rx={2}
              />
              <text
                x={(primaryLabel?.length ?? 0) * 6.5 + 40}
                y={7}
                fill={chartTokens.label}
                fontSize={11}
                fontFamily={chartTokens.fontBody}
                fontWeight={600}
              >
                {secondaryLabel}
              </text>
            </>
          )}
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
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Sparkline"
    >
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
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${value} of ${max}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor ?? chartTokens.track}
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
