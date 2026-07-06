'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/admin/Sidebar';
import { NotificationBell } from '@/components/admin/NotificationBell';
import type { IUser } from '@pg/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }

    // Verify token is still valid by fetching current user
    if (!user) {
      api
        .get('auth/me')
        .json<{ success: boolean; data: { user: IUser } }>()
        .then((res) => {
          const { user: fetchedUser } = res.data;
          login(fetchedUser, accessToken, refreshToken ?? '');
        })
        .catch(async () => {
          // Try token refresh
          try {
            const res = await api.post('auth/refresh').json<{
              success: boolean;
              data: { accessToken: string; refreshToken: string; user: IUser };
            }>();
            const { accessToken: newAt, refreshToken: newRt, user: refreshedUser } = res.data;
            login(refreshedUser, newAt, newRt);
          } catch {
            logout();
            router.replace('/login');
          }
        });
    }
  }, [accessToken, user, router, login, logout, refreshToken]);

  return (
    <div className="bg-surface-50 flex min-h-screen">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] bg-white px-6 py-3">
          <div className="w-8 md:hidden" />
          {/* spacer for mobile hamburger */}
          <h1 className="font-display text-surface-900 truncate text-lg font-bold">
            {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
