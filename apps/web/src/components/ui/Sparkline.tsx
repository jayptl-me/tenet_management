'use client';

import { useId } from 'react';

/**
 * Sparkline — lightweight SVG mini line chart with no axes.
 * Designed to be embedded inside StatCards, table cells, or badges.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'var(--color-brand-500)',
  strokeWidth = 1.5,
  showFill = true,
  fillOpacity = 0.15,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showFill?: boolean;
  fillOpacity?: number;
  className?: string;
}) {
  const reactId = useId();
  const gradientId = `sparkline-grad-${reactId.replace(/:/g, '-')}`;

  if (data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--chart-grid)"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padX = 1;
  const usableW = width - padX * 2;
  const usableH = height - 4;
  const stepX = usableW / (data.length - 1);

  const getX = (i: number) => padX + i * stepX;
  const getY = (val: number) => 2 + usableH - ((val - min) / range) * usableH;

  const linePoints = data.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');

  const lastPoint = data[data.length - 1];
  const firstPoint = data[0];
  const trend = lastPoint >= firstPoint ? color : 'var(--color-danger-500)';
  const lineColor = color === 'var(--color-brand-500)' ? trend : color;
  const fillColor = color === 'var(--color-brand-500)' ? trend : color;

  // Fill area: line from leftmost point through all data points → bottom-right → bottom-left → close
  const fillPathD = [
    `M ${getX(0)},${getY(data[0])}`,
    ...data.slice(1).map((val, i) => `L ${getX(i + 1)},${getY(val)}`),
    `L ${getX(data.length - 1)},${height}`,
    `L ${getX(0)},${height}`,
    'Z',
  ].join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sparkline chart"
    >
      {showFill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={fillPathD} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline
        points={linePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={getX(data.length - 1)}
        cy={getY(lastPoint)}
        r={2}
        fill={lineColor}
      />
    </svg>
  );
}

export default Sparkline;
