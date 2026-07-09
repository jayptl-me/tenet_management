'use client';

import { chartTokens } from '@/lib/chart-theme';

export interface GaugeChartProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  sublabel?: string;
  /** CSS custom property name, e.g. --color-success-500 */
  colorVar?: string;
}

/** Semi-circular radial gauge for service health / occupancy percentages. */
export function GaugeChart({
  value,
  max = 100,
  size = 120,
  label,
  sublabel,
  colorVar = '--color-success-500',
}: GaugeChartProps) {
  const strokeW = 10;
  const radius = (size - strokeW) / 2;
  const circumference = Math.PI * radius;
  const pct = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size / 2 + strokeW}
        viewBox={`0 0 ${size} ${size / 2 + strokeW}`}
        role="img"
        aria-label={
          label
            ? `${label}: ${Math.round(pct * 100)} percent`
            : `${Math.round(pct * 100)} percent`
        }
      >
        <path
          d={`M ${strokeW / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeW / 2} ${size / 2}`}
          fill="none"
          stroke={chartTokens.track}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeW / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeW / 2} ${size / 2}`}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
        <text
          x={center}
          y={size / 2 - 4}
          textAnchor="middle"
          fill={chartTokens.textPrimary}
          fontSize={size * 0.18}
          fontFamily={chartTokens.fontDisplay}
          fontWeight={700}
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && (
        <span className="font-[family:var(--font-display)] text-xs font-bold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[11px] font-medium text-[color:var(--color-text-secondary)]">
          {sublabel}
        </span>
      )}
    </div>
  );
}
