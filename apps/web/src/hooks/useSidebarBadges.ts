'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface SidebarBadges {
  unreadNotifications: number;
  openComplaints: number;
  pendingEnquiries: number;
}

const empty: SidebarBadges = {
  unreadNotifications: 0,
  openComplaints: 0,
  pendingEnquiries: 0,
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export function useSidebarBadges(): SidebarBadges {
  const [badges, setBadges] = useState<SidebarBadges>(empty);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    // Initial fetch
    api
      .get('dashboard/badges')
      .json<{ success: boolean; data: SidebarBadges }>()
      .then((res) => setBadges(res.data))
      .catch(() => {});

    // SSE for live updates — needs auth token as query param (EventSource doesn't support custom headers)
    if (!accessToken) return;
    const url = `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/sse/admin?token=${encodeURIComponent(accessToken)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('badges-update', (e) => {
      try {
        const data = JSON.parse(e.data) as SidebarBadges;
        setBadges(data);
      } catch {
        // ignore malformed SSE data
      }
    });

    eventSource.addEventListener('connected', () => {
      // SSE stream established — no action needed
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => eventSource.close();
  }, [accessToken]);

  return badges;
}
