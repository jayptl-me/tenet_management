'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Search,
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
  Shirt,
  FileSpreadsheet,
  ScrollText,
  Settings,
  Wifi,
  Sun,
  Moon,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalOverlay, modalContent } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

interface CommandAction {
  id: string;
  label: string;
  category: string;
  href?: string;
  keywords?: string[];
  icon: LucideIcon;
  action?: () => void;
}

// ── Command Data ───────────────────────────────────────

function buildCommands(
  onToggleTheme: () => void,
  onLogout: () => void,
  isDark: boolean,
): CommandAction[] {
  return [
    // Pages
    {
      id: 'dashboard',
      label: 'Dashboard',
      category: 'Pages',
      href: '/dashboard',
      keywords: ['home', 'overview'],
      icon: LayoutDashboard,
    },
    {
      id: 'tenants',
      label: 'Tenants',
      category: 'Pages',
      href: '/tenants',
      keywords: ['renters', 'occupants', 'residents'],
      icon: Users,
    },
    {
      id: 'rooms',
      label: 'Rooms',
      category: 'Pages',
      href: '/rooms',
      keywords: ['beds', 'accommodation'],
      icon: BedDouble,
    },
    {
      id: 'floors',
      label: 'Floors',
      category: 'Pages',
      href: '/floors',
      keywords: ['levels', 'building'],
      icon: Building2,
    },
    {
      id: 'payments',
      label: 'Payments',
      category: 'Financial',
      href: '/payments',
      keywords: ['transactions', 'upi'],
      icon: CreditCard,
    },
    {
      id: 'invoices',
      label: 'Invoices',
      category: 'Financial',
      href: '/invoices',
      keywords: ['bills', 'receipts'],
      icon: Receipt,
    },
    {
      id: 'electricity',
      label: 'Electricity',
      category: 'Financial',
      href: '/electricity',
      keywords: ['power', 'units', 'meter'],
      icon: Zap,
    },
    {
      id: 'laundry',
      label: 'Laundry',
      category: 'Operations',
      href: '/laundry',
      keywords: ['wash', 'slots'],
      icon: Shirt,
    },
    {
      id: 'meals',
      label: 'Meals',
      category: 'Operations',
      href: '/meals',
      keywords: ['food', 'feedback'],
      icon: Utensils,
    },
    {
      id: 'menus',
      label: 'Menus',
      category: 'Operations',
      href: '/menus',
      keywords: ['daily', 'food plan'],
      icon: ClipboardList,
    },
    {
      id: 'services',
      label: 'Services',
      category: 'Operations',
      href: '/services',
      keywords: ['wifi', 'facilities'],
      icon: Wifi,
    },
    {
      id: 'assets',
      label: 'Assets',
      category: 'Operations',
      href: '/assets',
      keywords: ['inventory', 'items'],
      icon: Package,
    },
    {
      id: 'complaints',
      label: 'Complaints',
      category: 'Communication',
      href: '/complaints',
      keywords: ['issues', 'problems'],
      icon: MessageSquare,
    },
    {
      id: 'enquiries',
      label: 'Enquiries',
      category: 'Communication',
      href: '/enquiries',
      keywords: ['leads', 'prospects'],
      icon: PhoneCall,
    },
    {
      id: 'notices',
      label: 'Notices',
      category: 'Communication',
      href: '/notices',
      keywords: ['announcements', 'posts'],
      icon: Megaphone,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      category: 'Communication',
      href: '/notifications',
      keywords: ['alerts', 'push'],
      icon: Bell,
    },
    {
      id: 'visitors',
      label: 'Visitors',
      category: 'People',
      href: '/visitors',
      keywords: ['guests', 'entries'],
      icon: DoorOpen,
    },
    {
      id: 'guardians',
      label: 'Guardians',
      category: 'People',
      href: '/guardians',
      keywords: ['parents', 'contacts'],
      icon: ShieldCheck,
    },
    {
      id: 'leaves',
      label: 'Leaves',
      category: 'People',
      href: '/leaves',
      keywords: ['vacation', 'absence'],
      icon: CalendarClock,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      category: 'People',
      href: '/attendance',
      keywords: ['present', 'roll'],
      icon: CalendarCheck,
    },
    {
      id: 'export',
      label: 'Export Data',
      category: 'Reports',
      href: '/export',
      keywords: ['download', 'csv', 'excel'],
      icon: FileSpreadsheet,
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      category: 'Reports',
      href: '/audit-logs',
      keywords: ['history', 'trail'],
      icon: ScrollText,
    },
    {
      id: 'settings',
      label: 'Settings',
      category: 'System',
      href: '/settings',
      keywords: ['preferences', 'config'],
      icon: Settings,
    },

    // Actions
    {
      id: 'toggle-theme',
      label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'Actions',
      keywords: ['theme', 'dark', 'light', 'mode', 'appearance'],
      icon: isDark ? Sun : Moon,
      action: onToggleTheme,
    },
    {
      id: 'logout',
      label: 'Logout',
      category: 'Actions',
      keywords: ['sign out', 'exit'],
      icon: LogOut,
      action: onLogout,
    },
  ];
}

// ── Component ──────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export function CommandPalette({
  open,
  onClose,
  isDark,
  onToggleTheme,
  onLogout,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () => buildCommands(onToggleTheme, onLogout, isDark),
    [onToggleTheme, onLogout, isDark],
  );

  // Filter results — fuzzy-ish
  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [query, commands]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIdx((prev) => (prev + 1) % Math.max(results.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIdx((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
          break;
        case 'Enter': {
          e.preventDefault();
          const cmd = results[selectedIdx];
          if (cmd) {
            if (cmd.href) {
              router.push(cmd.href);
            } else if (cmd.action) {
              cmd.action();
            }
            onClose();
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [open, results, selectedIdx, router, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          onClose();
        } else {
          // The parent manages opening — but we default here too as backup
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    for (const r of results) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [results]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Overlay */}
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-modal)]"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-b-[color:var(--border-color)] px-4 py-3">
              <Search className="h-4 w-4 flex-shrink-0 text-[color:var(--color-text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIdx(0);
                }}
                placeholder="Search pages and actions..."
                className="flex-1 bg-transparent text-[15px] font-medium text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-muted)]"
              />
              <kbd className="hidden h-5 items-center gap-0.5 rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1.5 text-[10px] font-semibold text-[color:var(--color-text-muted)] sm:inline-flex">
                <span className="text-[11px]">⌘</span>K
              </kbd>
              <button
                onClick={onClose}
                className="rounded-md p-0.5 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)]"
              >
                <span className="text-xs font-semibold">ESC</span>
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-64 overflow-y-auto p-2">
              {Object.entries(groupedResults).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)]">
                    {category}
                  </div>
                  {items.map((item) => {
                    const flatIndex = results.indexOf(item);
                    const isSelected = flatIndex === selectedIdx;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.href) {
                            router.push(item.href);
                          } else if (item.action) {
                            item.action();
                          }
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIdx(flatIndex)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-[var(--transition-duration)]',
                          isSelected
                            ? 'bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]'
                            : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-50)]',
                        )}
                      >
                        <Icon
                          className={clsx(
                            'h-4 w-4 flex-shrink-0',
                            isSelected
                              ? 'text-[color:var(--color-brand-600)]'
                              : 'text-[color:var(--color-text-muted)]',
                          )}
                        />
                        <span className="text-[13px] font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {results.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                    No results found
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-t-[color:var(--border-color)] px-4 py-2 text-[10px] font-medium text-[color:var(--color-text-muted)]">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1 py-0.5">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1 py-0.5">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1 py-0.5">
                  ESC
                </kbd>
                Close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
