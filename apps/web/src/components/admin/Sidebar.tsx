'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';
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
  Bell,
  Menu,
  X,
  LogOut,
  Shirt,
  FileSpreadsheet,
  ScrollText,
  Settings,
  ChevronDown,
  Search,
  Wifi,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { motion, AnimatePresence } from 'motion/react';
import { collapse } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// ── Navigation Sections (categorized) ──────────────────

const navSections: NavSection[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: '/tenants', label: 'Tenants', icon: <Users className="h-4 w-4" /> },
      { href: '/rooms', label: 'Rooms', icon: <BedDouble className="h-4 w-4" /> },
      { href: '/floors', label: 'Floors', icon: <Building2 className="h-4 w-4" /> },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    items: [
      { href: '/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
      { href: '/invoices', label: 'Invoices', icon: <Receipt className="h-4 w-4" /> },
      { href: '/electricity', label: 'Electricity', icon: <Zap className="h-4 w-4" /> },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/laundry', label: 'Laundry', icon: <Shirt className="h-4 w-4" /> },
      { href: '/meals', label: 'Meals', icon: <Utensils className="h-4 w-4" /> },
      { href: '/menus', label: 'Menus', icon: <ClipboardList className="h-4 w-4" /> },
      { href: '/services', label: 'Services', icon: <Wifi className="h-4 w-4" /> },
      { href: '/assets', label: 'Assets', icon: <Package className="h-4 w-4" /> },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { href: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-4 w-4" /> },
      { href: '/enquiries', label: 'Enquiries', icon: <PhoneCall className="h-4 w-4" /> },
      { href: '/notices', label: 'Notices', icon: <Megaphone className="h-4 w-4" /> },
      { href: '/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    ],
  },
  {
    id: 'people',
    label: 'People & Logs',
    items: [
      { href: '/visitors', label: 'Visitors', icon: <DoorOpen className="h-4 w-4" /> },
      { href: '/guardians', label: 'Guardians', icon: <ShieldCheck className="h-4 w-4" /> },
      { href: '/leaves', label: 'Leaves', icon: <CalendarClock className="h-4 w-4" /> },
      { href: '/attendance', label: 'Attendance', icon: <CalendarCheck className="h-4 w-4" /> },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { href: '/export', label: 'Export', icon: <FileSpreadsheet className="h-4 w-4" /> },
      { href: '/audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
    ],
  },
];

// ── Sidebar Component ──────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['core', 'financial', 'operations']),
  );

  // Auto-expand section containing the active route
  useEffect(() => {
    for (const section of navSections) {
      if (section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))) {
        setExpandedSections((prev) => new Set([...prev, section.id]));
        break;
      }
    }
  }, [pathname]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return navSections;
    const q = searchQuery.toLowerCase();
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.href.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
  };

  const sidebarContent = (
    <nav className="flex h-full flex-col bg-[color:var(--color-surface-100)] border-r border-r-[color:var(--border-color)]">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-b-[color:var(--border-color)] bg-[color:var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-5 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-brand-500)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] group-hover:shadow-[var(--shadow-md)] group-hover:scale-105">
            <span className="font-semibold text-white text-sm tracking-tight">A</span>
          </div>
          <span className="font-semibold text-[color:var(--color-text-primary)] text-lg tracking-tight">
            Apex PG
          </span>
        </Link>
        <button
          className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-1.5 shadow-[var(--shadow-xs)] transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] hover:shadow-[var(--shadow-sm)] active:scale-[var(--active-press-scale)] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4 text-[color:var(--color-text-secondary)]" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] py-1.5 pl-8 pr-3 text-[13px] font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] focus:border-[color:var(--color-brand-300)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-300)]"
          />
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {filteredSections.map((section) => {
          const isExpanded = expandedSections.has(section.id) || searchQuery.trim() !== '';
          const hasActiveChild = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
          );

          return (
            <div key={section.id}>
              {/* Section header — only show when not searching */}
              {!searchQuery.trim() && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className={clsx(
                    'flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)] transition-colors duration-[var(--transition-duration)] hover:text-[color:var(--color-text-secondary)]',
                  )}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    className={clsx(
                      'h-3 w-3 transition-transform duration-[var(--transition-duration)]',
                      isExpanded && 'rotate-180',
                    )}
                  />
                </button>
              )}

              {/* Section items */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={collapse}
                    className="space-y-0.5 mt-1"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={clsx(
                            'group relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-all duration-[var(--transition-duration)]',
                            isActive
                              ? 'border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-xs)]'
                              : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-xs)]',
                          )}
                        >
                          {/* Active indicator bar */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[color:var(--color-brand-500)]" />
                          )}

                          <span
                            className={clsx(
                              'flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-[var(--transition-duration)]',
                              isActive
                                ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-xs)]'
                                : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)] group-hover:border-[color:var(--color-brand-200)] group-hover:bg-[color:var(--color-brand-50)] group-hover:text-[color:var(--color-brand-600)]',
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* No results */}
        {searchQuery.trim() && filteredSections.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
              No pages matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-t-[color:var(--border-color)] bg-[color:var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-3 py-3 space-y-1">
        {/* Settings */}
        <Link
          href="/settings"
          className={clsx(
            'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-all duration-[var(--transition-duration)]',
            pathname === '/settings' || pathname.startsWith('/settings/')
              ? 'border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-xs)]'
              : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-xs)]',
          )}
        >
          <span
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-[var(--transition-duration)]',
              pathname === '/settings'
                ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white'
                : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]',
            )}
          >
            <Settings className="h-4 w-4" />
          </span>
          <span>Settings</span>
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-danger-200)] hover:bg-[color:var(--color-danger-50)] hover:text-[color:var(--color-danger-700)] hover:shadow-[var(--shadow-xs)]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]">
            <LogOut className="h-4 w-4" />
          </span>
          <span>Logout</span>
        </button>

        {/* User info */}
        {user && (
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 mt-2">
            <p className="truncate text-[12px] font-semibold text-[color:var(--color-text-primary)]">
              {user.name}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {user.role}
            </p>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-3 top-3 z-50 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-2.5 shadow-[var(--shadow-md)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-lg)] hover:translate-[var(--hover-lift)] active:scale-[var(--active-press-scale)] lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
      </button>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-width)] flex-shrink-0 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 42, mass: 0.85 }}
              className="h-full w-72"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
