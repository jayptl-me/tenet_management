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

  // ── Leave Status (pending/cancelled share payment map keys above) ──
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

  // ── Electricity Bill Status ──
  finalized: 'info',
  distributed: 'success',

  // ── Meal feedback status ──
  submitted: 'warning',
  acknowledged: 'info',
  actioned: 'success',

  // ── Menu calendar ──
  past: 'neutral',
  scheduled: 'info',
};

export const DEFAULT_BRAND_TOKENS: IBrandTokens = {
  // Indigo — aligns with SaaS theme CSS defaults in globals.css
  brandColorScale: {
    '50': '#eef2ff',
    '100': '#e0e7ff',
    '200': '#c7d2fe',
    '300': '#a5b4fc',
    '400': '#818cf8',
    '500': '#6366f1',
    '600': '#4f46e5',
    '700': '#4338ca',
    '800': '#3730a3',
    '900': '#312e81',
    '950': '#1e1b4b',
  },
  surfaceColorScale: {
    '50': '#fafafa',
    '100': '#f4f4f5',
    '200': '#e4e4e7',
    '300': '#d4d4d8',
    '400': '#a1a1aa',
    '500': '#71717a',
    '600': '#52525b',
    '700': '#3f3f46',
    '800': '#27272a',
    '900': '#18181b',
    '950': '#09090b',
  },
  surfaceColorScaleDark: {
    '50': '#09090b',
    '100': '#18181b',
    '200': '#27272a',
    '300': '#3f3f46',
    '400': '#52525b',
    '500': '#71717a',
    '600': '#a1a1aa',
    '700': '#d4d4d8',
    '800': '#e4e4e7',
    '900': '#f4f4f5',
    '950': '#fafafa',
  },
  fontDisplay: 'Inter',
  fontBody: 'Inter',
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
