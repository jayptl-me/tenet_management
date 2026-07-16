import { Complaint } from '../models/complaint.js';
import { Enquiry } from '../models/enquiry.js';
import { Notification } from '../models/notification.js';
import { broadcast } from './eventBus.js';
import { logger } from './logger.js';
import type { SSEMessage } from '@pg/types';

export interface SidebarBadges {
  unreadNotifications: number;
  openComplaints: number;
  pendingEnquiries: number;
}

/** Recompute admin sidebar badge counts (same shape as GET /dashboard/badges). */
export async function getBadgeCounts(): Promise<SidebarBadges> {
  const [unreadNotifications, openComplaints, pendingEnquiries] = await Promise.all([
    Notification.countDocuments({ 'unreadBy.0': { $exists: true } } as Record<string, unknown>),
    Complaint.countDocuments({ status: 'open' } as Record<string, unknown>),
    Enquiry.countDocuments({ status: 'new' } as Record<string, unknown>),
  ]);

  return { unreadNotifications, openComplaints, pendingEnquiries };
}

/**
 * D2: Push live badge counts to admin SSE clients as event `badges-update`.
 * Failures are logged only -- never break primary mutation flows.
 */
export async function broadcastBadgesUpdate(): Promise<void> {
  try {
    const data = await getBadgeCounts();
    const message: SSEMessage = {
      event: 'badges-update',
      data,
      timestamp: new Date().toISOString(),
    };
    broadcast(message);
  } catch (err) {
    logger.error({ err }, 'Failed to broadcast badges-update');
  }
}
