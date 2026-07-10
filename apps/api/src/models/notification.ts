import { Schema, model, type Document, type Model } from 'mongoose';

export interface INotificationDocument extends Document {
  id: string;
  targetType: string;
  targetIds: string[];
  title: string;
  body: string;
  type: string;
  data: Map<string, string>;
  unreadBy: Schema.Types.ObjectId[];
  sentAt: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    targetType: {
      type: String,
      enum: ['all', 'individual', 'room', 'floor'],
      required: [true, 'Target type is required'],
    },
    targetIds: {
      type: [String],
      default: [],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
      trim: true,
      maxlength: [2000, 'Body cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: [
        'payment_reminder',
        'payment_verified',
        'complaint_update',
        'announcement',
        'service_update',
        'electricity_bill',
        'welcome',
        'emergency',
        'meal_feedback',
      ],
      required: [true, 'Notification type is required'],
    },
    data: {
      type: Map,
      of: String,
      default: {},
    },
    unreadBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id ?? '');
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ targetType: 1 });
notificationSchema.index({ unreadBy: 1 });

export const Notification: Model<INotificationDocument> = model<INotificationDocument>(
  'Notification',
  notificationSchema,
);
