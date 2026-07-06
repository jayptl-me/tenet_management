'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { INotification } from '@pg/types';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('notifications/unread-count').json<{
        success: boolean;
        data: { count: number };
      }>();
      setUnreadCount(res.data.count);
    } catch {
      // Silently fail — user might not be admin
    }
  }, [isAuthenticated]);

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
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchUnreadCount();
      }
    });
    // Poll every 30 seconds as fallback (SSE handles real-time updates)
    const interval = setInterval(() => {
      if (active) {
        fetchUnreadCount();
      }
    }, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchUnreadCount]);

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

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`notifications/${id}/read`).json<{ success: boolean }>();
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unreadBy: [] } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('notifications/read-all').json<{ success: boolean }>();
      setNotifications((prev) => prev.map((n) => ({ ...n, unreadBy: [] })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  if (!isAuthenticated) return null;

  const typeIcons: Record<string, string> = {
    payment_reminder: '💰',
    payment_verified: '✅',
    complaint_update: '📋',
    announcement: '📢',
    service_update: '🔧',
    electricity_bill: '⚡',
    welcome: '👋',
    emergency: '🚨',
    meal_feedback: '🍽️',
  };

  const typeColors: Record<string, string> = {
    emergency: 'bg-danger-100 text-danger-800',
    payment_verified: 'bg-success-100 text-success-800',
    payment_reminder: 'bg-warning-100 text-warning-800',
    welcome: 'bg-brand-100 text-brand-800',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="hover:bg-surface-100 relative rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white p-2 shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] active:scale-[var(--active-press-scale)]"
        aria-label="Notifications"
      >
        <Bell className="text-surface-700 h-5 w-5" />
        {unreadCount > 0 && (
          <span className="bg-danger-500 absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-[var(--radius-full)] border-[length:var(--bw-default)] border-[color:var(--border-color)] px-1 font-mono text-[10px] font-bold text-white shadow-[var(--shadow-button)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white shadow-[var(--shadow-dropdown)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b-[length:var(--bw-default)] border-b-[color:var(--color-surface-200)] p-3">
            <h3 className="font-display text-surface-900 text-sm font-bold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-body text-brand-600 hover:bg-brand-50 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors duration-[var(--transition-duration)]"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <div className="border-surface-200 border-t-brand-500 h-5 w-5 animate-spin rounded-full border-2" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Bell className="text-surface-300 h-8 w-8" />
                <p className="font-body text-surface-400 mt-2 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = notif.unreadBy.length > 0;
                return (
                  <div
                    key={notif.id}
                    className={`border-surface-100 hover:bg-surface-50 flex items-start gap-3 border-b p-3 transition-colors duration-[var(--transition-duration)] ${
                      isUnread ? 'bg-brand-50/50' : ''
                    }`}
                  >
                    <span className="mt-0.5 text-lg" role="img" aria-label={notif.type}>
                      {typeIcons[notif.type] ?? '🔔'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-body text-surface-900 truncate text-sm font-semibold">
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span className="bg-brand-500 h-2 w-2 flex-shrink-0 rounded-full" />
                        )}
                      </div>
                      <p className="font-body text-surface-500 mt-0.5 line-clamp-2 text-xs">
                        {notif.body}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                            typeColors[notif.type] ?? 'bg-surface-100 text-surface-600'
                          }`}
                        >
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-surface-400 font-mono text-[10px]">
                          {new Date(notif.sentAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-surface-400 hover:bg-surface-100 hover:text-surface-600 flex-shrink-0 rounded-md p-1 transition-colors duration-[var(--transition-duration)]"
                        title="Mark as read"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-surface-200 border-t-2 p-2">
            <a
              href="/admin/notifications"
              className="font-body text-brand-600 hover:bg-brand-50 block rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
