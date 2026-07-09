/**
 * Shared chart theming helpers.
 * Prefer CSS custom properties so charts re-theme on light/dark without JS.
 */

export const chartTokens = {
  grid: 'var(--chart-grid)',
  gridStrong: 'var(--chart-grid-strong)',
  axis: 'var(--chart-axis)',
  label: 'var(--chart-label)',
  bar: 'var(--chart-bar)',
  barSecondary: 'var(--chart-bar-secondary)',
  barRadius: 'var(--chart-bar-radius)',
  track: 'var(--chart-track)',
  onFill: 'var(--chart-on-fill)',
  tooltipBg: 'var(--chart-tooltip-bg)',
  tooltipText: 'var(--chart-tooltip-text)',
  tooltipShadow: 'var(--chart-tooltip-shadow)',
  cellBorder: 'var(--chart-cell-border)',
  cellRadius: 'var(--chart-cell-radius)',
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  brand: 'var(--color-brand-500)',
  success: 'var(--color-success-500)',
  warning: 'var(--color-warning-500)',
  danger: 'var(--color-danger-500)',
  fontBody: 'var(--font-body)',
  fontMono: 'var(--font-mono)',
  fontDisplay: 'var(--font-display)',
} as const;

export type HeatmapScale = 'brand' | 'success' | 'danger' | 'custom';

/** Solid 5-step heatmap ramp (empty → max). Uses design tokens, not transparent overlays. */
export function heatmapRamp(scale: HeatmapScale, custom?: string[]): string[] {
  if (scale === 'custom' && custom && custom.length >= 5) {
    return custom;
  }
  if (scale === 'danger') {
    return [
      'var(--chart-heatmap-0)',
      'var(--chart-heatmap-danger-1)',
      'var(--chart-heatmap-danger-2)',
      'var(--chart-heatmap-danger-3)',
      'var(--chart-heatmap-danger-4)',
    ];
  }
  if (scale === 'success') {
    return [
      'var(--chart-heatmap-0)',
      'var(--chart-heatmap-success-1)',
      'var(--chart-heatmap-success-2)',
      'var(--chart-heatmap-success-3)',
      'var(--chart-heatmap-success-4)',
    ];
  }
  return [
    'var(--chart-heatmap-0)',
    'var(--chart-heatmap-1)',
    'var(--chart-heatmap-2)',
    'var(--chart-heatmap-3)',
    'var(--chart-heatmap-4)',
  ];
}

export function heatmapLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const pct = count / max;
  if (pct <= 0.25) return 1;
  if (pct <= 0.5) return 2;
  if (pct <= 0.75) return 3;
  return 4;
}

/** Shared tooltip chrome classes for HTML chart tooltips. */
export const chartTooltipClass =
  'pointer-events-none z-10 whitespace-nowrap rounded-[var(--radius-md)] border border-[color:var(--chart-cell-border)] px-3 py-2 text-[12px] font-medium shadow-[var(--chart-tooltip-shadow)] bg-[color:var(--chart-tooltip-bg)] text-[color:var(--chart-tooltip-text)]';

/** Series color helpers — prefer tokens so charts retheme with light/dark. */
export const chartSeries = {
  brand: 'var(--color-brand-500)',
  brandMuted: 'var(--color-brand-300)',
  success: 'var(--color-success-500)',
  warning: 'var(--color-warning-500)',
  danger: 'var(--color-danger-500)',
  info: 'var(--color-info-500)',
  accent: 'var(--color-accent-500)',
  neutral: 'var(--color-surface-400)',
} as const;
