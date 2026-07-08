'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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

export function useSidebarBadges(): SidebarBadges {
  const [badges, setBadges] = useState<SidebarBadges>(empty);

  useEffect(() => {
    // Initial fetch
    api.get('dashboard/badges')
      .json<{ success: boolean; data: SidebarBadges }>()
      .then((res) => setBadges(res.data))
      .catch(() => {});

    // SSE for live updates
    const eventSource = new EventSource('/api/v1/sse/stream');

    eventSource.addEventListener('badges-update', (e) => {
      try {
        const data = JSON.parse(e.data) as SidebarBadges;
        setBadges(data);
      } catch {
        // ignore malformed SSE data
      }
    });

    return () => eventSource.close();
  }, []);

  return badges;
}
