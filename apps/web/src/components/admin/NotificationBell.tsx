'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  MessageSquare,
  Megaphone,
  Wrench,
  Zap,
  User,
  AlertTriangle,
  Utensils,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import type { INotification } from '@pg/types';

export function NotificationBell() {
  const router = useRouter();
  const liveBadges = useSidebarBadges();
  const unreadCount = liveBadges.unreadNotifications;
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await api
        .get('notifications', { searchParams: { limit: 10, page: 1 } })
        .json<{ success: boolean; data: INotification[] }>();
      setNotifications(res.data);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      fetchNotifications();
    }
  };

  if (!isAuthenticated) return null;

  const typeIcons: Record<string, React.ReactNode> = {
    payment_reminder: <Bell className="h-4 w-4 text-[color:var(--color-warning-500)]" />,
    payment_verified: <Bell className="h-4 w-4 text-[color:var(--color-success-500)]" />,
    complaint_update: <MessageSquare className="h-4 w-4 text-[color:var(--color-brand-500)]" />,
    announcement: <Megaphone className="h-4 w-4 text-[color:var(--color-brand-500)]" />,
    service_update: <Wrench className="h-4 w-4 text-[color:var(--color-warning-500)]" />,
    electricity_bill: <Zap className="h-4 w-4 text-[color:var(--color-danger-500)]" />,
    welcome: <User className="h-4 w-4 text-[color:var(--color-success-500)]" />,
    emergency: <AlertTriangle className="h-4 w-4 text-[color:var(--color-danger-500)]" />,
    meal_feedback: <Utensils className="h-4 w-4 text-[color:var(--color-brand-500)]" />,
  };

  const typeColors: Record<string, string> = {
    emergency: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)]',
    payment_verified: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)]',
    payment_reminder: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)]',
    welcome: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-2 transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:bg-[color:var(--color-field-bg)] active:scale-[var(--active-press-scale)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-[color:var(--color-surface-700)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-[var(--radius-full)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-danger-500)] px-1 font-mono text-[10px] font-bold text-[color:var(--color-text-inverted)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-dropdown)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color:var(--border-color)] p-3">
            <h3 className="text-sm font-display font-bold text-[color:var(--color-text-primary)]">
              Notifications & Broadcasts
            </h3>
            <Link
              href="/notifications?tab=history"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors duration-[var(--transition-duration)] hover:underline"
            >
              History
            </Link>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--color-surface-200)] border-t-[color:var(--color-brand-500)]" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Bell className="h-8 w-8 text-[color:var(--color-text-muted)]" />
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = notif.unreadBy.length > 0;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/notifications/${notif.id}`);
                    }}
                    className={`flex w-full items-start gap-3 border-b border-[color:var(--border-color)] p-3 text-left transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-field-bg)] ${
                      isUnread ? 'bg-[color:var(--color-brand-50)]/50' : ''
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0">
                      {typeIcons[notif.type] ?? (
                        <Bell className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                          {notif.title}
                        </p>
                        {isUnread ? (
                          <span className="flex-shrink-0 rounded-full bg-[color:var(--color-warning-100)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--color-warning-800)]">
                            {notif.unreadBy.length} unread
                          </span>
                        ) : (
                          <span className="flex-shrink-0 rounded-full bg-[color:var(--color-success-100)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--color-success-800)]">
                            All read
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--color-text-secondary)]">
                        {notif.body}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                            typeColors[notif.type] ??
                            'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)]'
                          }`}
                        >
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
                          {new Date(notif.sentAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[color:var(--border-color)] p-2">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-center text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-brand-50)]"
            >
              Compose & Manage Broadcasts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
