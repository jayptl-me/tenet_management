/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { Notification, type INotificationDocument } from '../models/notification.js';
import { User, type IUserDocument } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { publishToNtfy, buildClickUrl } from '../lib/ntfy.js';
import { broadcast } from '../lib/eventBus.js';
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

/**
 * Resolve target user IDs based on targetType and targetIds.
 */
async function resolveTargetUsers(
  targetType: string,
  targetIds: string[],
): Promise<IUserDocument[]> {
  switch (targetType) {
    case 'all': {
      return UserModel.find({ isActive: true }).select('_id ntfyTopic').exec();
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
  const unreadBy = targetUsers.map((u) => u._id);

  const doc = await NotifModel.create({
    targetType,
    targetIds,
    title,
    body,
    type,
    data: new Map(Object.entries(data)),
    unreadBy,
    sentAt: new Date(),
  });

  logger.info(
    { notificationId: doc._id, targetType, targetCount: unreadBy.length },
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
      unreadBy: unreadBy.map(String),
      sentAt: doc.sentAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    },
    timestamp: new Date().toISOString(),
  };

  broadcast(sseMessage);
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
  return { modifiedCount: result.modifiedCount };
}

/**
 * List notifications for a user with pagination.
 */
export async function listNotifications(
  userId: string,
  role: string,
  page: number,
  limit: number,
  options?: { type?: INotificationType; unreadOnly?: boolean },
): Promise<{ notifications: INotificationDocument[]; total: number }> {
  const objectId = new mongoose.Types.ObjectId(userId);
  const filter: Record<string, any> = {};

  if (role !== 'admin') {
    filter.unreadBy = objectId;
  }
  if (options?.type) {
    filter.type = options.type;
  }
  if (options?.unreadOnly) {
    filter.unreadBy = objectId;
  }

  const total = await NotifModel.countDocuments(filter);
  const results = await NotifModel.find(filter)
    .sort({ sentAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .exec();

  return { notifications: results, total };
}
