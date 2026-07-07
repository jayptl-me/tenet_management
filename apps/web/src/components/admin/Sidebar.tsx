'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  BedDouble,
  CreditCard,
  Receipt,
  Zap,
  MessageSquare,
  PhoneCall,
  Utensils,
  ClipboardList,
  Megaphone,
  DoorOpen,
  ShieldCheck,
  Package,
  CalendarCheck,
  CalendarClock,
  Wifi,
  Bell,
  Menu,
  X,
  LogOut,
  Shirt,
  FileSpreadsheet,
  ScrollText,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  featureFlag?: string; // appConfig feature key — if falsy, always visible
  badge?: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/tenants', label: 'Tenants', icon: <Users className="h-5 w-5" /> },
  { href: '/rooms', label: 'Rooms', icon: <BedDouble className="h-5 w-5" /> },
  { href: '/floors', label: 'Floors', icon: <Building2 className="h-5 w-5" /> },
  { href: '/laundry', label: 'Laundry', icon: <Shirt className="h-5 w-5" />, featureFlag: 'laundryEnabled' },
  { href: '/payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" /> },
  { href: '/invoices', label: 'Invoices', icon: <Receipt className="h-5 w-5" /> },
  { href: '/electricity', label: 'Electricity', icon: <Zap className="h-5 w-5" /> },
  { href: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-5 w-5" /> },
  { href: '/enquiries', label: 'Enquiries', icon: <PhoneCall className="h-5 w-5" /> },
  { href: '/meals', label: 'Meals', icon: <Utensils className="h-5 w-5" />, featureFlag: 'messFeedbackEnabled' },
  { href: '/menus', label: 'Menus', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/services', label: 'Services', icon: <Wifi className="h-5 w-5" /> },
  { href: '/notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" /> },
  { href: '/notices', label: 'Notices', icon: <Megaphone className="h-5 w-5" />, featureFlag: 'noticeBoardEnabled' },
  { href: '/visitors', label: 'Visitors', icon: <DoorOpen className="h-5 w-5" />, featureFlag: 'visitorManagementEnabled' },
  {
    href: '/guardians',
    label: 'Guardians',
    icon: <ShieldCheck className="h-5 w-5" />,
    featureFlag: 'guardianPortalEnabled',
  },
  {
    href: '/assets',
    label: 'Assets',
    icon: <Package className="h-5 w-5" />,
    // Assets are always visible (no feature flag needed)
  },
  {
    href: '/leaves',
    label: 'Leaves',
    icon: <CalendarClock className="h-5 w-5" />,
    featureFlag: 'attendanceEnabled',
  },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: <CalendarCheck className="h-5 w-5" />,
    featureFlag: 'attendanceEnabled',
  },
  { href: '/audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-5 w-5" /> },
  { href: '/export', label: 'Export', icon: <FileSpreadsheet className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const sidebarContent = (
    <nav className="flex h-full flex-col border-r-[length:var(--bw-strong)] border-r-[color:var(--border-color)] bg-[color:var(--color-surface-100)]">
      {/* Brand */}
      <div className="flex items-center justify-between border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] px-5 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-display text-surface-900 text-xl font-extrabold tracking-tight">
            APEX PG
          </span>
        </Link>
        <button
          className="hover:bg-surface-100 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-1 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'font-[family:var(--font-body)] flex items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-3 py-2.5 text-sm font-semibold transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
              pathname === item.href
                ? 'bg-brand-500 translate-x-[var(--active-press-x)] translate-y-[var(--active-press-y)] border-[color:var(--border-color)] text-white shadow-[var(--shadow-button)]'
                : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900 border-transparent hover:border-[color:var(--border-color)]',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className="bg-danger-500 font-display ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="space-y-2 border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] px-5 py-4">
        <Link
          href="/settings"
          className={clsx(
            'font-[family:var(--font-body)] flex items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-3 py-2.5 text-sm font-semibold transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
            pathname === '/settings'
              ? 'bg-brand-500 border-[color:var(--border-color)] text-white shadow-[var(--shadow-button)]'
              : 'text-surface-700 hover:bg-surface-100 border-transparent hover:border-[color:var(--border-color)]',
          )}
        >
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-surface-600 hover:bg-danger-100 hover:border-danger-300 hover:text-danger-700 font-[family:var(--font-body)] flex w-full items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-transparent px-3 py-2.5 text-sm font-semibold transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
        {user && (
          <p className="text-surface-400 truncate px-3 text-xs">
            {user.name} ({user.role})
          </p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-4 top-4 z-50 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-2 shadow-[var(--shadow-card)] md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-width)] flex-shrink-0 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="animate-slide-in-left h-full w-[var(--sidebar-width)]"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
