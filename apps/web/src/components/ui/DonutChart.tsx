'use client';

/**
 * DonutChart — SVG donut/ring chart with animated segments.
 * Each segment is drawn as an arc with stroke-dashoffset animation.
 */
export function DonutChart({
  segments,
  centerLabel,
  sublabel,
  size = 160,
  thickness = 28,
  gap = 2,
  className,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  centerLabel?: string;
  sublabel?: string;
  size?: number;
  thickness?: number;
  gap?: number;
  className?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const fullCircumference = 2 * Math.PI * radius;
  const gapRad = (gap * Math.PI) / 180;

  type SegArc = {
    value: number;
    color: string;
    label: string;
    i: number;
    startAngle: number;
    endAngle: number;
    arcLength: number;
    offset: number;
  };

  // Pre-compute all segment arcs
  let current = -Math.PI / 2;
  const arcs: SegArc[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.value <= 0) continue;
    const sliceAngle = (seg.value / total) * 2 * Math.PI;
    const startAngle = current;
    const endAngle = startAngle + sliceAngle - gapRad;
    // Arc length for this slice: fraction of full circumference
    const arcLength = fullCircumference * (sliceAngle / (2 * Math.PI));
    arcs.push({
      ...seg,
      i: arcs.length,
      startAngle,
      endAngle,
      arcLength,
      offset: fullCircumference - arcLength,
    });
    current += sliceAngle;
  }

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {/* Background track — one full circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--chart-track)"
          strokeWidth={thickness}
        />

        {/* Segment arcs — drawn on top, animated via dashoffset */}
        {arcs.map((seg) => (
          <circle
            key={seg.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${seg.arcLength} ${fullCircumference - seg.arcLength}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(${(seg.startAngle * 180) / Math.PI + 90}, ${center}, ${center})`}
            className="transition-all duration-700 ease-out"
            style={{ transitionDelay: `${seg.i * 100}ms` }}
          />
        ))}

        {/* Center text */}
        <g transform={`rotate(90, ${center}, ${center})`}>
          {centerLabel && (
            <text
              x={center}
              y={center - 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-text-primary)"
              fontSize={size * 0.16}
              fontFamily="var(--font-display)"
              fontWeight={700}
            >
              {centerLabel}
            </text>
          )}
          {sublabel && (
            <text
              x={center}
              y={center + (centerLabel ? size * 0.12 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-text-muted)"
              fontSize={size * 0.09}
              fontFamily="var(--font-body)"
              fontWeight={500}
            >
              {sublabel}
            </text>
          )}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center gap-1.5 text-[11px] font-semibold"
          >
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-[color:var(--color-text-secondary)]">
              {segment.label}
            </span>
            <span className="font-mono tabular-nums text-[color:var(--color-text-primary)]">
              {segment.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DonutChart;
