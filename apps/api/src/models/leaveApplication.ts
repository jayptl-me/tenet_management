import { Schema, model, type Document, type Model } from 'mongoose';

export interface ILeaveApplicationDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  approvedBy: Schema.Types.ObjectId | null;
  approvedAt: Date | null;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveApplicationSchema = new Schema<ILeaveApplicationDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    fromDate: {
      type: String,
      required: [true, 'From date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    toDate: {
      type: String,
      required: [true, 'To date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      // cancelled: tenant/admin withdraw of a pending leave (additive; historical docs ok)
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Admin notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
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

leaveApplicationSchema.index({ tenantId: 1, fromDate: -1 });
leaveApplicationSchema.index({ status: 1, createdAt: -1 });

export const LeaveApplication: Model<ILeaveApplicationDocument> = model<ILeaveApplicationDocument>(
  'LeaveApplication',
  leaveApplicationSchema,
);
