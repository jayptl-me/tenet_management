/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { Notification, type INotificationDocument } from '../models/notification.js';
import { User, type IUserDocument } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { publishToNtfy, buildClickUrl } from '../lib/ntfy.js';
import { broadcast } from '../lib/eventBus.js';
import { broadcastBadgesUpdate } from '../lib/broadcast-badges.js';
import { logger } from '../lib/logger.js';
import type { INotificationType, SSEMessage, INotificationCreate } from '@pg/types';

// Mongoose v9 strict types require casting for filter objects. The room model
// itself uses `any` typed schemas, so we follow the same pattern.
const NotifModel = Notification as any;
const UserModel = User as any;
const TenantModel = Tenant as any;
const RoomModel = Room as any;

interface CreateNotificationOptions extends INotificationCreate {
  senderId?: string;
}

export type ListNotificationOptions = {
  type?: INotificationType;
  /** When true, only items still in unreadBy for the requesting user. */
  unreadOnly?: boolean;
  /**
   * Non-admin: default is full history for recipients (F1).
   * `status=unread` is equivalent to unreadOnly=true.
   * `status=all` forces history even if unreadOnly was set.
   */
  status?: 'all' | 'unread';
};

/**
 * Resolve target user IDs based on targetType and targetIds.
 * F3: targetType `all` is residents only (active users with role tenant).
 */
async function resolveTargetUsers(
  targetType: string,
  targetIds: string[],
): Promise<IUserDocument[]> {
  switch (targetType) {
    case 'all': {
      // Product intent: broadcast announcements to residents, not admins/guardians.
      return UserModel.find({ isActive: true, role: 'tenant' }).select('_id ntfyTopic').exec();
    }
    case 'individual': {
      return UserModel.find({ _id: { $in: targetIds }, isActive: true })
        .select('_id ntfyTopic')
        .exec();
    }
    case 'floor': {
      const rooms = await RoomModel.find({ floorId: { $in: targetIds } })
        .select('_id')
        .exec();
      const roomIds = rooms.map((r: any) => r._id);
      const tenants = await TenantModel.find({ roomId: { $in: roomIds }, isActive: true })
        .select('userId')
        .exec();
      const userIds = tenants.map((t: any) => t.userId);
      return UserModel.find({ _id: { $in: userIds }, isActive: true })
        .select('_id ntfyTopic')
        .exec();
    }
    case 'room': {
      const tenants = await TenantModel.find({ roomId: { $in: targetIds }, isActive: true })
        .select('userId')
        .exec();
      const userIds = tenants.map((t: any) => t.userId);
      return UserModel.find({ _id: { $in: userIds }, isActive: true })
        .select('_id ntfyTopic')
        .exec();
    }
    default:
      return [];
  }
}

/**
 * Create a notification, persist it, push to ntfy, and broadcast via SSE.
 */
export async function createNotification(
  options: CreateNotificationOptions,
): Promise<INotificationDocument> {
  const { targetType, targetIds = [], title, body, type, data = {}, sendPush = true } = options;

  const targetUsers = await resolveTargetUsers(targetType, targetIds);
  const recipientIds = targetUsers.map((u) => u._id);

  const doc = await NotifModel.create({
    targetType,
    targetIds,
    title,
    body,
    type,
    data: new Map(Object.entries(data)),
    // F1: permanent recipient set for history after mark-read
    recipientUserIds: recipientIds,
    unreadBy: recipientIds,
    sentAt: new Date(),
  });

  logger.info(
    { notificationId: doc._id, targetType, targetCount: recipientIds.length },
    'Notification created',
  );

  if (sendPush) {
    const clickUrl = buildClickUrl('/notifications');
    for (const user of targetUsers) {
      const fullUser = await User.findWithNtfyTopic(String(user._id));
      const topic = fullUser?.ntfyTopic;
      if (topic) {
        publishToNtfy({
          topic,
          title,
          message: body,
          priority: type === 'emergency' ? 5 : 3,
          click: clickUrl,
          tags:
            type === 'emergency'
              ? 'rotating_light'
              : type === 'payment_verified'
                ? 'white_check_mark'
                : 'bell',
        }).catch((err) => {
          logger.error({ err, userId: String(user._id) }, 'ntfy push failed');
        });
      }
    }
  }

  const sseMessage: SSEMessage = {
    event: 'notification_created',
    data: {
      id: String(doc._id),
      targetType,
      targetIds,
      title,
      body,
      type,
      data,
      recipientUserIds: recipientIds.map(String),
      unreadBy: recipientIds.map(String),
      sentAt: doc.sentAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    },
    timestamp: new Date().toISOString(),
  };

  broadcast(sseMessage);
  // D2: refresh admin sidebar badges after notification mutations
  void broadcastBadgesUpdate();
  return doc;
}

/**
 * Get unread notification count for a specific user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return NotifModel.countDocuments({
    unreadBy: new mongoose.Types.ObjectId(userId),
  });
}

/**
 * Mark a notification as read by a specific user.
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<{ modifiedCount: number }> {
  const objectId = new mongoose.Types.ObjectId(userId);
  const result = await NotifModel.updateOne(
    { _id: notificationId, unreadBy: objectId },
    { $pull: { unreadBy: objectId } },
  );
  if (result.modifiedCount > 0) {
    void broadcastBadgesUpdate();
  }
  return { modifiedCount: result.modifiedCount };
}

/**
 * Mark all notifications as read for a specific user.
 */
export async function markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
  const objectId = new mongoose.Types.ObjectId(userId);
  const result = await NotifModel.updateMany(
    { unreadBy: objectId },
    { $pull: { unreadBy: objectId } },
  );
  if (result.modifiedCount > 0) {
    void broadcastBadgesUpdate();
  }
  return { modifiedCount: result.modifiedCount };
}

/**
 * Delete a single notification by ID (admin only).
 */
export async function deleteNotification(
  notificationId: string,
): Promise<{ deletedCount: number }> {
  const result = await NotifModel.deleteOne({ _id: notificationId });
  if (result.deletedCount > 0) {
    void broadcastBadgesUpdate();
  }
  return { deletedCount: result.deletedCount };
}

function serializeNotification(
  doc: INotificationDocument,
  viewerUserId?: string,
): Record<string, unknown> {
  const plain =
    typeof (doc as any).toJSON === 'function'
      ? (doc as any).toJSON()
      : typeof (doc as any).toObject === 'function'
        ? (doc as any).toObject()
        : { ...(doc as any) };

  const unreadBy = Array.isArray(plain.unreadBy)
    ? plain.unreadBy.map((id: unknown) => String(id))
    : [];
  const recipientUserIds = Array.isArray(plain.recipientUserIds)
    ? plain.recipientUserIds.map((id: unknown) => String(id))
    : [];

  const result: Record<string, unknown> = {
    ...plain,
    id: String(plain.id ?? plain._id ?? ''),
    unreadBy,
    recipientUserIds,
  };

  // F2: derive isRead for the requesting user from unreadBy membership
  if (viewerUserId) {
    result.isRead = !unreadBy.includes(viewerUserId);
  }

  return result;
}

/**
 * List notifications for a user with pagination.
 * Admin: full broadcast history (optional type / unreadOnly filters).
 * Non-admin (F1): history via recipientUserIds (fallback unreadBy for legacy docs);
 *   use unreadOnly=true or status=unread for inbox-only.
 */
export async function listNotifications(
  userId: string,
  role: string,
  page: number,
  limit: number,
  options?: ListNotificationOptions,
): Promise<{ notifications: Record<string, unknown>[]; total: number }> {
  const objectId = new mongoose.Types.ObjectId(userId);
  const filter: Record<string, any> = {};

  const wantUnreadOnly =
    options?.status === 'unread' || (options?.unreadOnly === true && options?.status !== 'all');

  if (role !== 'admin') {
    if (wantUnreadOnly) {
      filter.unreadBy = objectId;
    } else {
      // History: user was a recipient (new docs) OR still/ever in unreadBy (legacy)
      filter.$or = [{ recipientUserIds: objectId }, { unreadBy: objectId }];
    }
  } else if (wantUnreadOnly) {
    filter.unreadBy = objectId;
  }

  if (options?.type) {
    filter.type = options.type;
  }

  const total = await NotifModel.countDocuments(filter);
  const results = await NotifModel.find(filter)
    .sort({ sentAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .exec();

  const notifications = results.map((doc: INotificationDocument) =>
    serializeNotification(doc, userId),
  );

  return { notifications, total };
}
