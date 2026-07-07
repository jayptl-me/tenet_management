'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/admin/Sidebar';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { DarkModeToggle } from '@/components/admin/DarkModeToggle';
import { EmergencyAlertButton } from '@/components/admin/EmergencyAlertButton';
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'motion/react';
import { pageReveal } from '@/lib/animations';
import { Search } from 'lucide-react';
import type { IUser } from '@pg/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleMode } = useTheme();

  const [commandOpen, setCommandOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }

    if (!user) {
      api
        .get('auth/me')
        .json<{ success: boolean; data: IUser }>()
        .then((res) => {
          login(res.data, accessToken, refreshToken ?? '');
        })
        .catch(async () => {
          try {
            const res = await api
              .post('auth/refresh', {
                json: { refreshToken },
              })
              .json<{
                success: boolean;
                data: { accessToken: string; refreshToken: string };
              }>();
            const { accessToken: newAt, refreshToken: newRt } = res.data;
            const meRes = await api.get('auth/me').json<{
              success: boolean;
              data: IUser;
            }>();
            login(meRes.data, newAt, newRt);
          } catch {
            logout();
            router.replace('/login');
          }
        });
    }
  }, [accessToken, user, router, login, logout, refreshToken]);

  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleToggleTheme = useCallback(() => {
    toggleMode();
    setCommandOpen(false);
  }, [toggleMode]);

  const handleLogout = useCallback(() => {
    logout();
    setCommandOpen(false);
  }, [logout]);

  return (
    <div className="flex min-h-screen bg-[color:var(--color-surface-50)]">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* ── Top Bar (Glass morphism) ────────────── */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-b-[color:var(--border-color)] bg-[color:var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile spacer for hamburger */}
            <div className="w-8 md:hidden" />

            {/* Breadcrumbs */}
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2">
            {/* Cmd+K hint */}
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)] shadow-[var(--shadow-xs)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-200)] hover:text-[color:var(--color-text-secondary)] hover:shadow-[var(--shadow-sm)]"
            >
              <Search className="h-3 w-3" />
              <span>Search</span>
              <kbd className="ml-1 rounded border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-1 py-0.5 text-[10px] font-semibold">
                ⌘K
              </kbd>
            </button>

            <EmergencyAlertButton />
            <DarkModeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* ── Page Content ────────────────────────── */}
        <motion.div
          variants={pageReveal}
          initial="initial"
          animate="animate"
          className="flex-1 p-6"
        >
          {children}
        </motion.div>
      </main>

      {/* ── Command Palette ──────────────────────── */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        isDark={theme.mode === 'dark'}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
      />
    </div>
  );
}
