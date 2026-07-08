'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, X, Users, BedDouble, Building2, MessageSquare,
  Receipt, CreditCard, Megaphone, PhoneCall, Wifi, Package, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppConfigPublic } from '@/hooks/useAppConfig';

interface CreateAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  featureFlag?: string;
}

const createActions: CreateAction[] = [
  { label: 'New Tenant', href: '/tenants/new', icon: <Users className="h-4 w-4" /> },
  { label: 'New Room', href: '/rooms/new', icon: <BedDouble className="h-4 w-4" /> },
  { label: 'New Floor', href: '/floors/new', icon: <Building2 className="h-4 w-4" /> },
  { label: 'New Complaint', href: '/complaints/new', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'New Invoice', href: '/invoices/new', icon: <Receipt className="h-4 w-4" /> },
  { label: 'New Payment', href: '/payments/new', icon: <CreditCard className="h-4 w-4" /> },
  {
    label: 'New Notice',
    href: '/notices/new',
    icon: <Megaphone className="h-4 w-4" />,
    featureFlag: 'noticeBoardEnabled',
  },
  { label: 'New Enquiry', href: '/enquiries/new', icon: <PhoneCall className="h-4 w-4" /> },
  { label: 'New Service', href: '/services/new', icon: <Wifi className="h-4 w-4" /> },
  { label: 'New Asset', href: '/assets/new', icon: <Package className="h-4 w-4" /> },
  {
    label: 'New Guardian',
    href: '/guardians/new',
    icon: <ShieldCheck className="h-4 w-4" />,
    featureFlag: 'guardianPortalEnabled',
  },
];

export function QuickCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: appConfig } = useAppConfigPublic();

  // Keyboard shortcut: Cmd+N or Ctrl+N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Filter by feature flags and search query
  const filtered = useMemo(() => {
    const features = appConfig?.features ?? {};
    const q = search.trim().toLowerCase();
    return createActions.filter((action) => {
      if (action.featureFlag && !features[action.featureFlag as keyof typeof features])
        return false;
      if (q) return action.label.toLowerCase().includes(q);
      return true;
    });
  }, [search, appConfig]);

  return (
    <>
      {/* FAB trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-lg)] transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-600)] hover:shadow-[var(--shadow-xl)] hover:scale-105 active:scale-95"
        title="Quick Create (Cmd+N)"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-modal)] overflow-hidden"
            >
              {/* Search bar */}
              <div className="flex items-center gap-2 border-b border-[color:var(--border-color)] px-4 py-3">
                <Search className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Quick create..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-sm font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none"
                />
                <kbd className="rounded border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
                  Cmd+N
                </kbd>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Action list */}
              <div className="max-h-72 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-[color:var(--color-text-muted)]">
                    No matching actions
                  </p>
                ) : (
                  filtered.map((action) => (
                    <button
                      key={action.href}
                      onClick={() => {
                        router.push(action.href);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-50)]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]">
                        {action.icon}
                      </span>
                      {action.label}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
