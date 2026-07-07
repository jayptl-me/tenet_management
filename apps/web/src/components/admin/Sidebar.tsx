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
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/tenants', label: 'Tenants', icon: <Users className="h-4 w-4" /> },
  { href: '/rooms', label: 'Rooms', icon: <BedDouble className="h-4 w-4" /> },
  { href: '/floors', label: 'Floors', icon: <Building2 className="h-4 w-4" /> },
  { href: '/laundry', label: 'Laundry', icon: <Shirt className="h-4 w-4" /> },
  { href: '/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
  { href: '/invoices', label: 'Invoices', icon: <Receipt className="h-4 w-4" /> },
  { href: '/electricity', label: 'Electricity', icon: <Zap className="h-4 w-4" /> },
  { href: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/enquiries', label: 'Enquiries', icon: <PhoneCall className="h-4 w-4" /> },
  { href: '/meals', label: 'Meals', icon: <Utensils className="h-4 w-4" /> },
  { href: '/menus', label: 'Menus', icon: <ClipboardList className="h-4 w-4" /> },
  { href: '/services', label: 'Services', icon: <Wifi className="h-4 w-4" /> },
  { href: '/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { href: '/notices', label: 'Notices', icon: <Megaphone className="h-4 w-4" /> },
  { href: '/visitors', label: 'Visitors', icon: <DoorOpen className="h-4 w-4" /> },
  { href: '/guardians', label: 'Guardians', icon: <ShieldCheck className="h-4 w-4" /> },
  { href: '/assets', label: 'Assets', icon: <Package className="h-4 w-4" /> },
  { href: '/leaves', label: 'Leaves', icon: <CalendarClock className="h-4 w-4" /> },
  { href: '/attendance', label: 'Attendance', icon: <CalendarCheck className="h-4 w-4" /> },
  { href: '/audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
  { href: '/export', label: 'Export', icon: <FileSpreadsheet className="h-4 w-4" /> },
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
    <nav className="flex h-full flex-col bg-[color:var(--color-surface-100)] border-r-[length:var(--bw-strong)] border-r-[color:var(--border-color)]">
      {/* Brand */}
      <div className="flex items-center justify-between border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] bg-[color:var(--color-surface-100)]/80 backdrop-blur-sm px-5 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-brand-500)] shadow-[var(--shadow-button)]">
            <span className="font-display text-sm font-extrabold text-white">A</span>
          </div>
          <span className="font-display text-[color:var(--color-text-primary)] text-lg font-extrabold tracking-tight">
            APEX PG
          </span>
        </Link>
        <button
          className="hover:bg-[color:var(--color-surface-200)] rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-1.5 shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:translate-[var(--hover-lift)] active:scale-[var(--active-press-scale)] lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4 text-[color:var(--color-text-secondary)]" />
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group flex items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] px-3 py-2 text-sm font-semibold transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
                isActive
                  ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-button)]'
                  : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-button)] hover:translate-[var(--hover-lift)]',
              )}
            >
              <span className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[length:var(--bw-default)] transition-colors duration-[var(--transition-duration)]',
                isActive
                  ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white'
                  : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)] group-hover:border-[color:var(--color-brand-200)] group-hover:bg-[color:var(--color-brand-50)] group-hover:text-[color:var(--color-brand-600)]',
              )}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-[color:var(--color-brand-600)]" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] bg-[color:var(--color-surface-100)]/80 backdrop-blur-sm px-3 py-4 space-y-1.5">
        <Link
          href="/settings"
          className={clsx(
            'flex items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] px-3 py-2 text-sm font-semibold transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
            pathname === '/settings'
              ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-button)]'
              : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-button)] hover:translate-[var(--hover-lift)]',
          )}
        >
          <span className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[length:var(--bw-default)] transition-colors duration-[var(--transition-duration)]',
            pathname === '/settings'
              ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white'
              : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]',
          )}>
            <Settings className="h-4 w-4" />
          </span>
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-transparent px-3 py-2 text-sm font-semibold text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:border-[color:var(--color-danger-300)] hover:bg-[color:var(--color-danger-50)] hover:text-[color:var(--color-danger-700)] hover:shadow-[var(--shadow-button)] hover:translate-[var(--hover-lift)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)] transition-colors duration-[var(--transition-duration)] group-hover:border-[color:var(--color-danger-300)] group-hover:bg-[color:var(--color-danger-50)] group-hover:text-[color:var(--color-danger-600)]">
            <LogOut className="h-4 w-4" />
          </span>
          <span>Logout</span>
        </button>
        {user && (
          <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2">
            <p className="truncate text-xs font-semibold text-[color:var(--color-text-primary)]">{user.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">{user.role}</p>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-3 top-3 z-50 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-2.5 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:translate-[var(--hover-lift)] active:scale-[var(--active-press-scale)] lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
      </button>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-width)] flex-shrink-0 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="animate-slide-in-left h-full w-72"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
