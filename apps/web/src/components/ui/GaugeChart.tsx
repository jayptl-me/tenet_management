'use client';

export interface GaugeChartProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  sublabel?: string;
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
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size / 2 + strokeW}
        viewBox={`0 0 ${size} ${size / 2 + strokeW}`}
      >
        <path
          d={`M ${strokeW / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeW / 2} ${size / 2}`}
          fill="none"
          stroke="var(--border-color)"
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
          opacity={0.9}
          className="transition-all duration-700 ease-out"
        />
        <text
          x={center}
          y={size / 2 - 4}
          textAnchor="middle"
          fill="var(--color-text-primary)"
          fontSize={size * 0.18}
          fontFamily="var(--font-display)"
          fontWeight={700}
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && (
        <span className="font-display text-xs font-bold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
          {sublabel}
        </span>
      )}
    </div>
  );
}
