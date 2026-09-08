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
  serializeNotification,
} from '../services/notification.service.js';
import { Notification } from '../models/notification.js';
import { parsePagination, parseId, notFound, badRequest } from '../lib/routeUtils.js';
import { writeAuditLog } from '../lib/write-audit-log.js';

const notifRoutes = new Hono();

notifRoutes.use('*', authGuard);

// ── GET /api/v1/notifications ────────────────────────────
// List notifications for the authenticated user.
// Non-admin default = history (recipientUserIds). Use unreadOnly=true or status=unread for inbox.
notifRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { page, limit } = parsePagination(c);
  const type = c.req.query('type') as string | undefined;
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  const statusParam = c.req.query('status');
  const status =
    statusParam === 'unread' || statusParam === 'all'
      ? (statusParam as 'unread' | 'all')
      : undefined;

  const result = await listNotifications(user.sub, user.role, page, limit, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: type as any,
    unreadOnly,
    status,
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

  // Emergency broadcasts honor the emergency alerts flag; other types flow always.
  if (body.type === 'emergency') {
    const { AppConfig } = await import('../models/appConfig.js');
    const config = await AppConfig.findOne().select('features').lean();
    const enabled =
      (config as { features?: Record<string, boolean> } | null)?.features?.emergencyAlertsEnabled ??
      true;
    if (!enabled) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: 'Feature "emergencyAlertsEnabled" is disabled in app configuration.',
          },
        },
        403,
      );
    }
  }

  const notification = await createNotification({
    ...body,
    senderId: user.sub,
  });

  const notificationId = String(
    (notification as { id?: string; _id?: unknown }).id ??
      (notification as { _id?: unknown })._id ??
      '',
  );

  await writeAuditLog({
    userId: user.sub,
    action: 'notification_send',
    resource: 'notification',
    resourceId: notificationId,
    details: {
      targetType: body.targetType,
      type: body.type,
      title: body.title,
      targetIds: body.targetIds,
      sendPush: body.sendPush,
    },
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

// ── PATCH /api/v1/notifications/read-all ──────────────────
// Static path must be registered before /:id routes
notifRoutes.patch('/read-all', async (c) => {
  const user = c.get('user');

  const result = await markAllAsRead(user.sub);

  return c.json({
    success: true,
    message: `Marked ${result.modifiedCount} notifications as read`,
  });
});

const updateSchema = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
  type: z
    .enum([
      'payment_reminder',
      'payment_verified',
      'complaint_update',
      'announcement',
      'service_update',
      'electricity_bill',
      'welcome',
      'emergency',
      'meal_feedback',
    ])
    .optional(),
  targetType: z.enum(['all', 'individual', 'room', 'floor']).optional(),
  targetIds: z.array(z.string()).optional(),
});

// ── GET /api/v1/notifications/:id ────────────────────────
notifRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notification ID');

  const notification = await Notification.findById(id);
  if (!notification) return notFound(c, 'Notification');

  // IDOR protection: non-admin must be a designated recipient or in unreadBy
  if (user.role !== 'admin') {
    const isRecipient =
      notification.recipientUserIds.some((uid) => String(uid) === user.sub) ||
      notification.unreadBy.some((uid) => String(uid) === user.sub);
    if (!isRecipient) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to view this notification',
          },
        },
        403,
      );
    }
  }

  return c.json({ success: true, data: serializeNotification(notification, user.sub) });
});

// ── PUT /api/v1/notifications/:id ────────────────────────
// Admin metadata edit (does not re-broadcast)
notifRoutes.put('/:id', adminOnly, zValidator('json', updateSchema), async (c) => {
  const user = c.get('user');
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notification ID');

  const body = c.req.valid('json');
  const notification = await Notification.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!notification) return notFound(c, 'Notification');

  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'notification',
    resourceId: id,
    details: body,
  });

  return c.json({ success: true, data: serializeNotification(notification, user.sub) });
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

// ── DELETE /api/v1/notifications/:id ─────────────────────
notifRoutes.delete('/:id', adminOnly, async (c) => {
  const user = c.get('user');
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notification ID');

  const result = await deleteNotification(id);

  if (result.deletedCount === 0) {
    return notFound(c, 'Notification');
  }

  await writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'notification',
    resourceId: id,
  });

  return c.json({
    success: true,
    message: 'Notification deleted',
  });
});

export default notifRoutes;
