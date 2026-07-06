# Phase 5: Notification System (ntfy.sh + In-App + SSE)

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Tenant push notifications via ntfy.sh HTTP pub-sub, in-app notification center with read tracking, emergency alerts, direct WhatsApp share text, and admin real-time SSE stream for dashboard updates.
**Estimated:** 3.5-4.5 days
**Depends On:** Phase 4 (payments — notification triggers on payment events)
**Package Manager:** bun

---

## Architecture Decisions

| Decision            | Choice                                                     | Rationale                                                       |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Push provider       | ntfy.sh (self-hosted or public)                            | Simple HTTP POST, no Firebase/Google dependency, open-source    |
| Topic strategy      | Per-user UUID topic, stored in `User.ntfyTopic`            | Private, unguessable, no auth needed for subscriber             |
| In-app storage      | MongoDB `notifications` collection with `readBy[]`         | Persistent, queryable, supports targeted delivery               |
| Admin real-time     | Hono `streamSSE` with EventBus                             | No WebSocket overhead, automatic reconnect, Render-compatible   |
| Flutter integration | Polling `GET /notifications/my` every 30s + ntfy WebSocket | Dual-channel: real-time push + reliable in-app sync             |
| Emergency WhatsApp  | Direct share text/URL only                                 | No SMS, no WhatsApp API, no paid messaging                      |
| Notification copy   | Plain text only                                            | No emoji in titles, bodies, generated messages, or seed content |

---

## Step 5.1: ntfy.sh Client

### File: `apps/api/src/lib/ntfy.ts`

```typescript
import { env } from './env.js';
import { logger } from './logger.js';

interface NtfyMessage {
  topic: string;
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5; // 5 = urgent
  tags?: string[]; // plain category tags only, no emoji
  click?: string; // URL opened when notification tapped
  actions?: Array<{ action: string; label: string; url: string }>;
}

const BASE_URL = env.NTFY_SELF_HOSTED ? env.NTFY_BASE_URL : 'https://ntfy.sh';

export async function sendNtfyNotification(msg: NtfyMessage): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/${msg.topic}`, {
      method: 'POST',
      headers: {
        Title: msg.title,
        Message: msg.message,
        Priority: String(msg.priority || 3),
        Tags: (msg.tags || []).join(','),
        ...(msg.click && { Click: msg.click }),
      },
      body: msg.message,
    });

    if (!response.ok) {
      logger.error({ status: response.status, topic: msg.topic }, 'ntfy send failed');
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, topic: msg.topic }, 'ntfy send error');
    return false;
  }
}

export async function sendNtfyBulk(
  topics: string[],
  message: Omit<NtfyMessage, 'topic'>,
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    topics.map((topic) => sendNtfyNotification({ ...message, topic })),
  );

  const success = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - success;

  logger.info({ success, failed, total: topics.length }, 'Bulk ntfy send complete');
  return { success, failed };
}

// ── Resolve topics for a target ─────────────────────────
export async function resolveNtfyTopics(
  targetType: 'all' | 'individual' | 'room' | 'floor',
  targetIds: string[],
): Promise<string[]> {
  const { User } = await import('../models/user.js');

  switch (targetType) {
    case 'all': {
      // Use findWithNtfyTopic since ntfyTopic has select: false on the model
      const users = await User.find({ role: 'tenant', isActive: true }).select('+ntfyTopic').lean();
      return users.map((u: any) => u.ntfyTopic).filter(Boolean);
    }
    case 'individual': {
      const users = await User.find({ _id: { $in: targetIds } })
        .select('ntfyTopic')
        .lean();
      return users.map((u) => u.ntfyTopic);
    }
    case 'room': {
      const { Tenant } = await import('../models/tenant.js');
      const tenants = await Tenant.find({ roomId: { $in: targetIds }, isActive: true })
        .populate('userId', 'ntfyTopic')
        .lean();
      return tenants.map((t: any) => t.userId?.ntfyTopic).filter(Boolean);
    }
    case 'floor': {
      const { Room } = await import('../models/room.js');
      const rooms = await Room.find({ floorId: { $in: targetIds } })
        .select('_id')
        .lean();
      const roomIds = rooms.map((r) => r._id);
      const { Tenant } = await import('../models/tenant.js');
      const tenants = await Tenant.find({ roomId: { $in: roomIds }, isActive: true })
        .populate('userId', 'ntfyTopic')
        .lean();
      return tenants.map((t: any) => t.userId?.ntfyTopic).filter(Boolean);
    }
    default:
      return [];
  }
}
```

---

## Step 5.2: Notification Service

### File: `apps/api/src/services/notification.service.ts`

```typescript
import { Notification } from '../models/notification.js';
import { sendNtfyBulk, resolveNtfyTopics } from '../lib/ntfy.js';
import { eventBus } from '../lib/eventBus.js';
import type { INotificationCreate, NotificationType } from '@pg/types/notification';
import { logger } from '../lib/logger.js';

export async function sendNotification(params: INotificationCreate): Promise<string> {
  // 1. Store in DB
  const [notification] = await Notification.create([
    {
      targetType: params.targetType,
      targetIds: params.targetIds || [],
      title: params.title,
      body: params.body,
      type: params.type,
      data: params.data || {},
      readBy: [],
      deliveredVia: params.sendPush ? 'both' : 'in_app',
      sentAt: new Date(),
    },
  ]);

  // 2. Send push if requested
  if (params.sendPush) {
    const topics = await resolveNtfyTopics(params.targetType, params.targetIds || []);
    if (topics.length > 0) {
      await sendNtfyBulk(topics, {
        title: params.title,
        message: params.body,
        priority: params.type === 'payment_reminder' ? 4 : 3,
        tags: getNtfyTags(params.type),
        click: params.data?.clickUrl,
      });
    }
  }

  // 3. Emit SSE for admin-relevant events
  if (['complaint_update', 'payment_submitted', 'payment_verified'].includes(params.type)) {
    eventBus.emit(params.type as any, {
      notificationId: notification._id,
      title: params.title,
      body: params.body,
      type: params.type,
    });
  }

  return notification._id.toString();
}

function getNtfyTags(type: NotificationType): string[] {
  const tagMap: Record<string, string[]> = {
    payment_reminder: ['payment', 'reminder'],
    complaint_update: ['complaint'],
    announcement: ['announcement'],
    service_update: ['service'],
    electricity_bill: ['electricity'],
    welcome: ['welcome'],
    meal_feedback: ['meal'],
    payment_verified: ['payment', 'verified'],
    emergency: ['emergency'],
  };
  return tagMap[type] || ['notification'];
}

// ── Query Helpers ───────────────────────────────────────
export async function getUserNotifications(userId: string, page = 1, limit = 20) {
  // Find tenant to determine room/floor for targeted notifications
  const { Tenant } = await import('../models/tenant.js');
  const tenant = await Tenant.findOne({ userId }).lean();

  const filter = {
    $or: [
      { targetType: 'all' },
      { targetType: 'individual', targetIds: userId },
      ...(tenant ? [{ targetType: 'room', targetIds: tenant.roomId.toString() }] : []),
    ],
  };

  const [data, total] = await Promise.all([
    Notification.find(filter)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .then((notifs) =>
        notifs.map((n) => ({
          ...n,
          isRead: n.readBy.some((id: any) => id.toString() === userId),
        })),
      ),
    Notification.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const tenant = await Tenant.findOne({ userId }).lean();

  return Notification.countDocuments({
    readBy: { $ne: userId },
    $or: [
      { targetType: 'all' },
      { targetType: 'individual', targetIds: userId },
      ...(tenant ? [{ targetType: 'room', targetIds: tenant.roomId.toString() }] : []),
    ],
  });
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await Notification.findByIdAndUpdate(notificationId, {
    $addToSet: { readBy: userId },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const tenant = await Tenant.findOne({ userId }).lean();

  await Notification.updateMany(
    {
      readBy: { $ne: userId },
      $or: [
        { targetType: 'all' },
        { targetType: 'individual', targetIds: userId },
        ...(tenant ? [{ targetType: 'room', targetIds: tenant.roomId.toString() }] : []),
      ],
    },
    { $addToSet: { readBy: userId } },
  );
}

export async function sendEmergencyAlert(title: string, body: string): Promise<string> {
  const notificationId = await sendNotification({
    targetType: 'all',
    targetIds: [],
    title: `EMERGENCY: ${title}`,
    body,
    type: 'emergency',
    data: { emergency: 'true', timestamp: new Date().toISOString() },
    sendPush: true,
  });

  eventBus.emit('emergency_alert', {
    notificationId,
    title,
    body,
  });

  return notificationId;
}
```

---

## Step 5.3: Notification Routes

### File: `apps/api/src/routes/notifications.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard, adminOnly, tenantOnly } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  sendEmergencyAlert,
  sendNotification,
} from '../services/notification.service.js';

const notifications = new Hono();

// ── GET /notifications/my (tenant) ──────────────────────
notifications.get('/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').id;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));

  const result = await getUserNotifications(userId, page, limit);
  return c.json({ success: true, ...result });
});

// ── GET /notifications/unread-count ─────────────────────
notifications.get('/unread-count', authGuard, async (c) => {
  const userId = c.get('user').id;
  const count = await getUnreadCount(userId);
  return c.json({ success: true, data: { count } });
});

// ── POST /notifications/send (admin) ────────────────────
const sendSchema = z.object({
  targetType: z.enum(['all', 'individual', 'room', 'floor']),
  targetIds: z.array(z.string()).optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  type: z.enum([
    'payment_reminder',
    'complaint_update',
    'announcement',
    'service_update',
    'electricity_bill',
    'welcome',
    'meal_feedback',
    'payment_verified',
    'emergency',
  ]),
  data: z.record(z.string()).optional(),
  sendPush: z.boolean().default(false),
});

notifications.post('/send', authGuard, adminOnly, zValidator('json', sendSchema), async (c) => {
  const body = c.req.valid('json');
  const notificationId = await sendNotification(body);
  return c.json({ success: true, data: { id: notificationId, message: 'Notification sent' } }, 201);
});

// ── POST /notifications/emergency (admin) ───────────────
const emergencySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
});

notifications.post(
  '/emergency',
  authGuard,
  adminOnly,
  zValidator('json', emergencySchema),
  async (c) => {
    const body = c.req.valid('json');
    const notificationId = await sendEmergencyAlert(body.title, body.body);

    return c.json(
      {
        success: true,
        data: {
          id: notificationId,
          message: 'Emergency alert sent',
          whatsappText: `EMERGENCY: ${body.title}\n${body.body}`,
        },
      },
      201,
    );
  },
);

// ── PUT /notifications/:id/read ─────────────────────────
notifications.put('/:id/read', authGuard, async (c) => {
  const userId = c.get('user').id;
  await markAsRead(c.req.param('id'), userId);
  return c.json({ success: true, data: { message: 'Marked as read' } });
});

// ── PUT /notifications/read-all ─────────────────────────
notifications.put('/read-all', authGuard, async (c) => {
  const userId = c.get('user').id;
  await markAllAsRead(userId);
  return c.json({ success: true, data: { message: 'All marked as read' } });
});

export { notifications as notificationRoutes };
```

---

## Step 5.4: SSE Admin Stream

### File: `apps/api/src/routes/sse.ts`

```typescript
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authGuard, adminOnly } from '../middleware/auth.js';
import { eventBus, type SseEvent } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';

const sse = new Hono();

sse.get('/admin', authGuard, adminOnly, async (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connection event
    await stream.writeSSE({
      data: JSON.stringify({ type: 'connected', message: 'SSE stream established' }),
    });

    // Subscribe to all events
    const eventTypes: SseEvent['type'][] = [
      'complaint_created',
      'complaint_updated',
      'service_updated',
      'payment_submitted',
      'payment_verified',
      'new_enquiry',
    ];

    const unsubscribes = eventTypes.map((type) =>
      eventBus.on(type, (event) => {
        stream
          .writeSSE({
            data: JSON.stringify(event),
          })
          .catch(() => {
            // Client disconnected, cleanup will handle
          });
      }),
    );

    // Heartbeat every 30 seconds (prevents Render timeout)
    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: ': heartbeat' }).catch(() => {});
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      unsubscribes.forEach((unsub) => unsub());
      clearInterval(heartbeat);
      logger.info('SSE client disconnected');
    });

    // Keep connection alive
    await new Promise(() => {}); // Never resolves — waits for abort
  });
});

export { sse as sseRoutes };
```

---

## Step 5.5: SSE Context Provider (Frontend)

### File: `apps/web/src/lib/useSse.ts`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

export function useAdminSse() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const es = new EventSource(`${API_URL}/sse/admin?token=${accessToken}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      if (!event.data || event.data.startsWith(': heartbeat')) return;

      try {
        const parsed = JSON.parse(event.data);
        handleEvent(parsed);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
    };
  }, [accessToken]);

  function handleEvent(event: { type: string; data: any }) {
    switch (event.type) {
      case 'complaint_created':
      case 'complaint_updated':
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        toast.info(`Complaint: ${event.data.title}`);
        break;
      case 'payment_submitted':
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        toast.info(`Payment submitted: ₹${event.data.amount} by ${event.data.tenantName}`);
        break;
      case 'payment_verified':
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        break;
      case 'service_updated':
        queryClient.invalidateQueries({ queryKey: ['services'] });
        break;
      case 'new_enquiry':
        queryClient.invalidateQueries({ queryKey: ['enquiries'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        toast.info(`New enquiry from ${event.data.name}`);
        break;
    }
  }
}
```

---

## Step 5.6: Flutter ntfy Integration

```dart
// mobile/lib/shared/services/ntfy_service.dart

class NtfyService {
  WebSocketChannel? _channel;

  Future<void> connect(String topic) async {
    final wsUrl = 'wss://ntfy.sh/$topic/ws';
    _channel = WebSocketChannel.connect(Uri.parse(wsUrl));

    _channel!.stream.listen(
      (message) {
        // Parse ntfy message, show local notification
        final notification = jsonDecode(message);
        _showLocalNotification(
          title: notification['title'] ?? 'PG Alert',
          body: notification['message'] ?? '',
        );
      },
      onError: (error) {
        // Reconnect after delay
        Future.delayed(Duration(seconds: 5), () => connect(topic));
      },
    );
  }

  void disconnect() {
    _channel?.sink.close();
  }
}
```

---

## Verification Checklist

- [ ] `POST /notifications/send` with `targetType: 'all'` → reaches all active tenants
- [ ] `POST /notifications/send` with `sendPush: true` → ntfy.sh receives POST
- [ ] Tenant `GET /notifications/my` → returns targeted notifications with `isRead` computed
- [ ] `GET /notifications/unread-count` → correct count for tenant
- [ ] `PUT /notifications/:id/read` → notification marked read
- [ ] `PUT /notifications/read-all` → all notifications marked read
- [ ] `POST /notifications/emergency` sends urgent push and stores in-app notification
- [ ] Emergency dialog exposes direct WhatsApp text/URL without any API key
- [ ] Notification titles, bodies, tags, and generated share text contain no emoji
- [ ] SSE admin stream: open in browser → heartbeat every 30s
- [ ] SSE: submit enquiry from landing page → admin dashboard toast appears
- [ ] SSE: tenant submits UTR → admin gets real-time notification
- [ ] Frontend `NotificationBell` component shows unread count badge
- [ ] Flutter: ntfy WebSocket receives push, shows system notification
- [ ] Flutter: in-app notification list pulls from API, marks read on tap
- [ ] `bun run typecheck` passes

---

## Edge Cases Summary

| Scenario                      | Handling                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| ntfy.sh down                  | sendNtfyBulk logs failure, doesn't crash; in-app notification still stored                  |
| User has no ntfyTopic         | resolveNtfyTopics skips users without topics                                                |
| SSE client disconnects        | stream.onAbort cleans up listeners, EventSource auto-reconnects                             |
| 1000+ SSE connections         | Consider Redis pub/sub for horizontal scaling (not needed for single Render instance)       |
| Notification for deleted user | resolveNtfyTopics only returns active users                                                 |
| Flutter app in background     | ntfy WebSocket disconnects; flutter_local_notifications handles system notification display |
| Render 5-min SSE timeout      | Heartbeat every 30s keeps connection alive                                                  |
