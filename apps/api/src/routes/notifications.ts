import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  createNotification,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  listNotifications,
  deleteNotification,
} from '../services/notification.service.js';
import { parsePagination, parseId, notFound, badRequest } from '../lib/routeUtils.js';

const notifRoutes = new Hono();

notifRoutes.use('*', authGuard);

// ── GET /api/v1/notifications ────────────────────────────
// List notifications for the authenticated user
notifRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { page, limit } = parsePagination(c);
  const type = c.req.query('type') as string | undefined;
  const unreadOnly = c.req.query('unreadOnly') === 'true';

  const result = await listNotifications(user.sub, user.role, page, limit, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: type as any,
    unreadOnly,
  });

  return c.json({
    success: true,
    data: result.notifications,
    meta: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});

// ── GET /api/v1/notifications/unread-count ───────────────
notifRoutes.get('/unread-count', async (c) => {
  const user = c.get('user');
  const count = await getUnreadCount(user.sub);

  return c.json({
    success: true,
    data: { count },
  });
});

// ── POST /api/v1/notifications ───────────────────────────
// Admin-only: broadcast a notification to tenants
const createSchema = z.object({
  targetType: z.enum(['all', 'individual', 'room', 'floor']),
  targetIds: z.array(z.string()).optional().default([]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.enum([
    'payment_reminder',
    'payment_verified',
    'complaint_update',
    'announcement',
    'service_update',
    'electricity_bill',
    'welcome',
    'emergency',
    'meal_feedback',
  ]),
  data: z.record(z.string(), z.string()).optional().default({}),
  sendPush: z.boolean().optional().default(true),
});

notifRoutes.post('/', adminOnly, zValidator('json', createSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const notification = await createNotification({
    ...body,
    senderId: user.sub,
  });

  return c.json(
    {
      success: true,
      data: notification,
      message: 'Notification created and pushed successfully',
    },
    201,
  );
});

// ── PATCH /api/v1/notifications/:id/read ─────────────────
notifRoutes.patch('/:id/read', async (c) => {
  const user = c.get('user');
  const notificationId = c.req.param('id');

  const result = await markAsRead(notificationId, user.sub);

  if (result.modifiedCount === 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found or already read',
        },
      },
      404,
    );
  }

  return c.json({
    success: true,
    message: 'Notification marked as read',
  });
});

// ── PATCH /api/v1/notifications/read-all ──────────────────
notifRoutes.patch('/read-all', async (c) => {
  const user = c.get('user');

  const result = await markAllAsRead(user.sub);

  return c.json({
    success: true,
    message: `Marked ${result.modifiedCount} notifications as read`,
  });
});

// ── DELETE /api/v1/notifications/:id ─────────────────────
notifRoutes.delete('/:id', adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notification ID');

  const result = await deleteNotification(id);

  if (result.deletedCount === 0) {
    return notFound(c, 'Notification');
  }

  return c.json({
    success: true,
    message: 'Notification deleted',
  });
});

export default notifRoutes;
