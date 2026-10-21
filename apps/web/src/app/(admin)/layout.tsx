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
import { QuickCreate } from '@/components/admin/QuickCreate';
import { GlobalLoadingBar } from '@/components/admin/GlobalLoadingBar';
import { ContentFrame } from '@/components/ui/ContentFrame';
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
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const { theme, toggleMode } = useTheme();

  const [commandOpen, setCommandOpen] = useState(false);

  // Auth guard — admin web shell only (tenant/guardian/visitor live in Flutter)
  useEffect(() => {
    // The persisted session is restored asynchronously. Until it is, the store
    // is empty, and an empty store is not evidence that nobody is signed in:
    // deciding here sent a signed-in admin to the login page on every full
    // page load (a refresh, a shared link, a bookmark).
    if (isHydrating) return;

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    if (user && user.role !== 'admin') {
      logout();
      router.replace('/login');
      return;
    }

    if (!user) {
      api
        .get('auth/me')
        .json<{ success: boolean; data: IUser }>()
        .then((res) => {
          if (res.data.role !== 'admin') {
            logout();
            router.replace('/login');
            return;
          }
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
            if (meRes.data.role !== 'admin') {
              logout();
              router.replace('/login');
              return;
            }
            login(meRes.data, newAt, newRt);
          } catch {
            logout();
            router.replace('/login');
          }
        });
    }
  }, [isHydrating, accessToken, user, router, login, logout, refreshToken]);

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
    api
      .post('auth/logout')
      .json()
      .catch(() => {});
    logout();
    setCommandOpen(false);
    router.replace('/login');
  }, [logout, router]);

  return (
    <div className="flex min-h-screen bg-(--color-page-bg)">
      <GlobalLoadingBar />
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* ── Top Bar (Glass morphism) ────────────── */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-b-(--border-color) bg-(--glass-bg) px-6 py-3 backdrop-blur-(--glass-blur)">
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
              className="text-2xs hidden items-center gap-1.5 rounded-lg border border-(--border-color) bg-(--color-card-bg) px-2.5 py-1.5 font-medium text-(--color-text-muted) shadow-(--shadow-xs) transition-all duration-(--transition-duration) hover:border-(--color-brand-200) hover:text-(--color-text-secondary) hover:shadow-(--shadow-sm) sm:flex"
            >
              <Search className="h-3 w-3" />
              <span>Search</span>
              <kbd className="text-3xs ml-1 rounded border border-(--border-color) bg-(--color-surface-50) px-1 py-0.5 font-semibold">
                ⌘K
              </kbd>
            </button>

            <EmergencyAlertButton />
            <DarkModeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* ── Page Content ────────────────────────── */}
        {/* The shell owns the one content frame: every admin page sits on the
            same band, the same gutters and the same grid. */}
        <motion.div variants={pageReveal} initial="initial" animate="animate" className="flex-1">
          <ContentFrame>{children}</ContentFrame>
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

      {/* ── Quick Create FAB + Cmd+N ────────────── */}
      <QuickCreate />
    </div>
  );
}
