'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbSegment {
  label: string;
  href: string;
  isLast: boolean;
}

/**
 * Maps URL path segments to human-readable labels.
 */
const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  tenants: 'Tenants',
  rooms: 'Rooms',
  floors: 'Floors',
  payments: 'Payments',
  invoices: 'Invoices',
  electricity: 'Electricity',
  laundry: 'Laundry',
  meals: 'Meals',
  menus: 'Menus',
  services: 'Services',
  complaints: 'Complaints',
  enquiries: 'Enquiries',
  notices: 'Notices',
  notifications: 'Notifications',
  visitors: 'Visitors',
  guardians: 'Guardians',
  leaves: 'Leaves',
  attendance: 'Attendance',
  assets: 'Assets',
  export: 'Export',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
};

const MONGO_ID_RE = /^[a-f\d]{24}$/i;

/** Parent resource segment -> short detail label (avoids raw ObjectIds). */
const DETAIL_LABEL: Record<string, string> = {
  tenants: 'Tenant',
  rooms: 'Room',
  floors: 'Floor',
  payments: 'Payment',
  invoices: 'Invoice',
  electricity: 'Bill',
  laundry: 'Slot',
  meals: 'Meal',
  menus: 'Menu',
  services: 'Service',
  complaints: 'Complaint',
  enquiries: 'Enquiry',
  notices: 'Notice',
  notifications: 'Notification',
  visitors: 'Visitor',
  guardians: 'Guardian',
  leaves: 'Leave',
  attendance: 'Record',
  assets: 'Asset',
};

function segmentLabel(segment: string, parentSegment: string | undefined): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  if (MONGO_ID_RE.test(segment)) {
    return (parentSegment && DETAIL_LABEL[parentSegment]) || 'Details';
  }
  // Title-case kebab segments without dumping raw IDs
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === '/dashboard' || pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  const breadcrumbs: BreadcrumbSegment[] = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const parent = index > 0 ? segments[index - 1] : undefined;
    const label = segmentLabel(segment, parent);
    return {
      label,
      href,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 py-1">
      <Link
        href="/dashboard"
        className="rounded-md p-1 text-[color:var(--color-text-muted)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-secondary)]"
        aria-label="Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-[color:var(--color-text-muted)]" />
          {crumb.isLast ? (
            <span className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="rounded-md px-1.5 py-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-secondary)]"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
