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
  ChevronLeft,
  ChevronRight,
  Search,
  Wifi,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useAppConfigPublic } from '@/hooks/useAppConfig';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { motion, AnimatePresence } from 'motion/react';
import { collapse } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  featureFlag?: string;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// ── Feature Flag Check ─────────────────────────────────

const FEATURE_DEFAULTS: Record<string, boolean> = {
  attendanceEnabled: false,
  laundryEnabled: true,
  messFeedbackEnabled: true,
  visitorManagementEnabled: true,
  guardianPortalEnabled: true,
  noticeBoardEnabled: true,
  emergencyAlertsEnabled: true,
};

// ── Restructured Navigation Sections ──────────────────

const navSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    id: 'residents',
    label: 'Residents',
    items: [
      { href: '/tenants', label: 'Tenants', icon: <Users className="h-4 w-4" /> },
      { href: '/rooms', label: 'Rooms', icon: <BedDouble className="h-4 w-4" /> },
      { href: '/floors', label: 'Floors', icon: <Building2 className="h-4 w-4" /> },
      {
        href: '/guardians',
        label: 'Guardians',
        icon: <ShieldCheck className="h-4 w-4" />,
        featureFlag: 'guardianPortalEnabled',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { href: '/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
      { href: '/invoices', label: 'Invoices', icon: <Receipt className="h-4 w-4" /> },
      { href: '/electricity', label: 'Electricity', icon: <Zap className="h-4 w-4" /> },
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    items: [
      { href: '/services', label: 'Services', icon: <Wifi className="h-4 w-4" /> },
      { href: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-4 w-4" /> },
      {
        href: '/laundry',
        label: 'Laundry',
        icon: <Shirt className="h-4 w-4" />,
        featureFlag: 'laundryEnabled',
      },
      {
        href: '/meals',
        label: 'Meals',
        icon: <Utensils className="h-4 w-4" />,
        featureFlag: 'messFeedbackEnabled',
      },
      { href: '/menus', label: 'Menus', icon: <ClipboardList className="h-4 w-4" /> },
      { href: '/assets', label: 'Assets', icon: <Package className="h-4 w-4" /> },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    items: [
      {
        href: '/notices',
        label: 'Notices',
        icon: <Megaphone className="h-4 w-4" />,
        featureFlag: 'noticeBoardEnabled',
      },
      { href: '/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
      { href: '/enquiries', label: 'Enquiries', icon: <PhoneCall className="h-4 w-4" /> },
      {
        href: '/visitors',
        label: 'Visitors',
        icon: <DoorOpen className="h-4 w-4" />,
        featureFlag: 'visitorManagementEnabled',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        href: '/attendance',
        label: 'Attendance',
        icon: <CalendarCheck className="h-4 w-4" />,
        featureFlag: 'attendanceEnabled',
      },
      {
        href: '/leaves',
        label: 'Leaves',
        icon: <CalendarClock className="h-4 w-4" />,
        featureFlag: 'attendanceEnabled',
      },
      { href: '/export', label: 'Export', icon: <FileSpreadsheet className="h-4 w-4" /> },
      { href: '/audit-logs', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
    ],
  },
];

const PINNED_STORAGE_KEY = 'sidebar-pinned';
const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';
const MAX_PINNED = 4;

// ── Helpers ────────────────────────────────────────────

function loadPinned(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function savePinned(pinned: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // localStorage full or disabled — silently ignore
  }
}

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // silently ignore
  }
}

// ── Badge Pill ─────────────────────────────────────────

function BadgePill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex-shrink-0 rounded-full bg-[color:var(--color-danger-500)] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Sidebar Component ──────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: appConfig } = useAppConfigPublic();
  const liveBadges = useSidebarBadges();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'residents', 'finance', 'facilities']),
  );
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  // Feature flags from AppConfig or defaults
  const features = useMemo(() => {
    const flags = appConfig?.features;
    return {
      attendanceEnabled: flags?.attendanceEnabled ?? FEATURE_DEFAULTS.attendanceEnabled,
      laundryEnabled: flags?.laundryEnabled ?? FEATURE_DEFAULTS.laundryEnabled,
      messFeedbackEnabled: flags?.messFeedbackEnabled ?? FEATURE_DEFAULTS.messFeedbackEnabled,
      visitorManagementEnabled:
        flags?.visitorManagementEnabled ?? FEATURE_DEFAULTS.visitorManagementEnabled,
      guardianPortalEnabled: flags?.guardianPortalEnabled ?? FEATURE_DEFAULTS.guardianPortalEnabled,
      noticeBoardEnabled: flags?.noticeBoardEnabled ?? FEATURE_DEFAULTS.noticeBoardEnabled,
    };
  }, [appConfig]);

  // Auto-expand section containing the active route
  useEffect(() => {
    for (const section of navSections) {
      if (
        section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
      ) {
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

  // Toggle pin for a nav item
  const togglePin = useCallback((href: string) => {
    setPinned((prev) => {
      let next: string[];
      if (prev.includes(href)) {
        next = prev.filter((h) => h !== href);
      } else if (prev.length >= MAX_PINNED) {
        return prev; // max reached — don't add
      } else {
        next = [...prev, href];
      }
      savePinned(next);
      return next;
    });
  }, []);

  // Toggle sidebar collapse
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  }, []);

  // Build flat list of all valid nav items for pinned lookup
  const allNavItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.featureFlag) {
          const flagKey = item.featureFlag as keyof typeof features;
          if (!features[flagKey]) continue;
        }
        items.push(item);
      }
    }
    return items;
  }, [features]);

  // Render pinned items (those that still exist in nav)
  const pinnedItems = useMemo(() => {
    return pinned
      .map((href) => allNavItems.find((item) => item.href === href))
      .filter(Boolean) as NavItem[];
  }, [pinned, allNavItems]);

  // Filter sections by feature flags and search
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const badgeMap: Record<string, number> = {
      '/complaints': liveBadges.openComplaints,
      '/notifications': liveBadges.unreadNotifications,
      '/enquiries': liveBadges.pendingEnquiries,
    };
    return navSections
      .map((section) => {
        const filteredItems = section.items
          .filter((item) => {
            // Feature flag gate
            if (item.featureFlag) {
              const flagKey = item.featureFlag as keyof typeof features;
              if (!features[flagKey]) return false;
            }
            // Search filter
            if (q) {
              return item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q);
            }
            return true;
          })
          .map((item) => {
            const count = badgeMap[item.href];
            return count && count > 0 ? { ...item, badge: count } : item;
          });
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [searchQuery, features, liveBadges]);

  const handleLogout = () => {
    logout();
  };

  // ── Render a single nav item ─────────────────────────
  const renderNavItem = (item: NavItem, showPinButton = true) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const isPinned = pinned.includes(item.href);

    const linkContent = (
      <>
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[color:var(--color-brand-500)]" />
        )}

        <span
          className={clsx(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors duration-[var(--transition-duration)]',
            isActive
              ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-xs)]'
              : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)] group-hover:border-[color:var(--color-brand-200)] group-hover:bg-[color:var(--color-brand-50)] group-hover:text-[color:var(--color-brand-600)]',
          )}
        >
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge != null && <BadgePill count={item.badge} />}
          </>
        )}
      </>
    );

    return (
      <div key={item.href} className="group relative flex items-center">
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          className={clsx(
            'flex flex-1 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-all duration-[var(--transition-duration)]',
            isActive
              ? 'border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-xs)]'
              : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-xs)]',
          )}
        >
          {linkContent}
        </Link>

        {/* Pin button — visible on hover when not collapsed */}
        {!collapsed && showPinButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePin(item.href);
            }}
            className={clsx(
              'absolute right-1 rounded p-0.5 opacity-0 transition-opacity duration-[var(--transition-duration)] group-hover:opacity-100',
              isPinned
                ? 'text-[color:var(--color-warning-500)]'
                : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-warning-500)]',
            )}
            title={isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Star className="h-3.5 w-3.5" fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <nav
      className={clsx(
        'flex h-full flex-col border-r border-r-[color:var(--border-color)] bg-[color:var(--color-surface-100)] transition-all duration-[var(--transition-duration-slow)]',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-b-[color:var(--border-color)] bg-[color:var(--glass-bg)] px-5 py-4 backdrop-blur-[var(--glass-blur)]">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-brand-500)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] group-hover:scale-105 group-hover:shadow-[var(--shadow-md)]">
            <span className="text-sm font-semibold tracking-tight text-white">A</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-[color:var(--color-text-primary)]">
              Apex PG
            </span>
          )}
        </Link>
        <button
          className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-1.5 shadow-[var(--shadow-xs)] transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] hover:shadow-[var(--shadow-sm)] active:scale-[var(--active-press-scale)] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4 text-[color:var(--color-text-secondary)]" />
        </button>
      </div>

      {/* Search — hidden when collapsed */}
      {!collapsed && (
        <div className="px-3 pb-1 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] py-1.5 pl-8 pr-3 text-[13px] font-medium text-[color:var(--color-text-primary)] transition-all duration-[var(--transition-duration)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-brand-300)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-300)]"
            />
          </div>
        </div>
      )}

      {/* Nav sections */}
      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {/* Pinned section */}
        {!collapsed && pinnedItems.length > 0 && !searchQuery.trim() && (
          <div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)]">
                Pinned
              </span>
              <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                {pinnedItems.length}/{MAX_PINNED}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              {pinnedItems.map((item) => renderNavItem(item, true))}
            </div>
          </div>
        )}

        {collapsed && pinnedItems.length > 0 && !searchQuery.trim() && (
          <div className="space-y-0.5">{pinnedItems.map((item) => renderNavItem(item, false))}</div>
        )}

        {filteredSections.map((section) => {
          const isExpanded = expandedSections.has(section.id) || searchQuery.trim() !== '';

          return (
            <div key={section.id}>
              {/* Section header — hidden when collapsed or searching */}
              {!collapsed && !searchQuery.trim() && (
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
              {!collapsed && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={collapse}
                      className="mt-1 space-y-0.5"
                    >
                      {section.items.map((item) => renderNavItem(item, true))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Collapsed: show items directly without sections */}
              {collapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => renderNavItem(item, false))}
                </div>
              )}
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
      <div className="space-y-1 border-t border-t-[color:var(--border-color)] bg-[color:var(--glass-bg)] px-3 py-3 backdrop-blur-[var(--glass-blur)]">
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="hidden w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-secondary)] lg:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* Settings */}
        <Link
          href="/settings"
          className={clsx(
            'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-all duration-[var(--transition-duration)]',
            pathname === '/settings' || pathname.startsWith('/settings/')
              ? 'border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-[var(--shadow-xs)]'
              : 'border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-xs)]',
          )}
          title={collapsed ? 'Settings' : undefined}
        >
          <span
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-[var(--transition-duration)]',
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-500)] text-white'
                : 'border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]',
            )}
          >
            <Settings className="h-4 w-4" />
          </span>
          {!collapsed && <span>Settings</span>}
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-danger-200)] hover:bg-[color:var(--color-danger-50)] hover:text-[color:var(--color-danger-700)] hover:shadow-[var(--shadow-xs)]"
          title={collapsed ? 'Logout' : undefined}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]">
            <LogOut className="h-4 w-4" />
          </span>
          {!collapsed && <span>Logout</span>}
        </button>

        {/* User info */}
        {user && !collapsed && (
          <div className="mt-2 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2">
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
        className="hover:translate-[var(--hover-lift)] fixed left-3 top-3 z-50 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-2.5 shadow-[var(--shadow-md)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-lg)] active:scale-[var(--active-press-scale)] lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
      </button>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-shrink-0 lg:flex">{sidebarContent}</aside>

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
