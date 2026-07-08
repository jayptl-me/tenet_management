export interface IBrandTokens {
  brandColorScale: Record<string, string>;
  surfaceColorScale: Record<string, string>;
  surfaceColorScaleDark: Record<string, string>;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  fontWeightHeading: number;
  fontWeightBody: number;
  spacingBase: number;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
  easeOutExpo: string;
  easeInOutCubic: string;
}

// ── Status variant types ─────────────────────────────────

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Centralized system-wide status → variant mapping.
 * Every status from every domain maps to exactly one semantic variant.
 * Used by StatusBadge and all status indicators across the admin panel.
 */
export const STATUS_COLOR_MAP: Record<string, StatusVariant> = {
  // ── Tenant Status ──
  active: 'success',
  checked_out: 'neutral',
  inactive: 'neutral',

  // ── Payment Status ──
  paid: 'success',
  pending: 'warning',
  pending_verification: 'info',
  overdue: 'danger',
  partial: 'warning',
  cancelled: 'neutral',

  // ── Invoice Status ──
  sent: 'info',
  draft: 'neutral',

  // ── Complaint Status ──
  open: 'danger',
  in_progress: 'warning',
  resolved: 'success',
  dismissed: 'neutral',

  // ── Complaint Severity ──
  urgent: 'danger',
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',

  // ── Service Status ──
  operational: 'success',
  degraded: 'warning',
  down: 'danger',

  // ── Enquiry Status ──
  new: 'warning',
  contacted: 'info',
  converted: 'success',
  closed: 'neutral',

  // ── Leave Status ──
  approved: 'success',
  rejected: 'danger',

  // ── Attendance Status ──
  present: 'success',
  absent: 'danger',
  on_leave: 'info',
  not_returned: 'warning',

  // ── Visitor Status ──
  expected: 'info',
  arrived: 'success',
  departed: 'neutral',

  // ── Asset Status ──
  available: 'success',
  in_use: 'info',
  under_maintenance: 'warning',
  damaged: 'danger',
  retired: 'neutral',

  // ── Laundry Slot Status ──
  booked: 'info',
  maintenance: 'warning',
};

export const DEFAULT_BRAND_TOKENS: IBrandTokens = {
  brandColorScale: {
    '50': '#FFFBEB',
    '100': '#FEF3C7',
    '200': '#FDE68A',
    '300': '#FCD34D',
    '400': '#FBBF24',
    '500': '#F59E0B',
    '600': '#D97706',
    '700': '#B45309',
    '800': '#92400E',
    '900': '#78350F',
    '950': '#451A03',
  },
  surfaceColorScale: {
    '50': '#FAFAF9',
    '100': '#F5F5F4',
    '200': '#E7E5E4',
    '300': '#D6D3D1',
    '400': '#A8A29E',
    '500': '#78716C',
    '600': '#57534E',
    '700': '#44403C',
    '800': '#292524',
    '900': '#1C1917',
    '950': '#0C0A09',
  },
  surfaceColorScaleDark: {
    '50': '#0C0A09',
    '100': '#1C1917',
    '200': '#292524',
    '300': '#44403C',
    '400': '#57534E',
    '500': '#78716C',
    '600': '#A8A29E',
    '700': '#D6D3D1',
    '800': '#E7E5E4',
    '900': '#F5F5F4',
    '950': '#FAFAF9',
  },
  fontDisplay: 'Syne',
  fontBody: 'DM Sans',
  fontMono: 'JetBrains Mono',
  fontWeightHeading: 700,
  fontWeightBody: 400,
  spacingBase: 4,
  radiusSm: '0.25rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusXl: '1rem',
  radiusFull: '9999px',
  durationFast: '150ms',
  durationNormal: '250ms',
  durationSlow: '400ms',
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
};
