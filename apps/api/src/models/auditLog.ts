import { Schema, model, type Document, type Model } from 'mongoose';

export interface IAuditLogDocument extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    action: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'payment_verify',
        'complaint_status_change',
        'tenant_checkout',
        'tenant_transfer',
        'settings_change',
        'notification_send',
        'visitor_approve',
        'export',
      ],
      required: [true, 'Action is required'],
    },
    resource: {
      type: String,
      required: [true, 'Resource is required'],
    },
    resourceId: {
      type: String,
      required: [true, 'Resource ID is required'],
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: {
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
        ret.timestamp = ret.createdAt;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret._id;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret.__v;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret.createdAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
// TTL index: auto-delete logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog: Model<IAuditLogDocument> = model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema,
);
