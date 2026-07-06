import { Schema, model, type Document, type Model } from 'mongoose';

export interface IAttendanceRecordDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  date: string;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  method: string;
  recordedBy: Schema.Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceRecordSchema = new Schema<IAttendanceRecordDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'on_leave', 'not_returned'],
      required: [true, 'Status is required'],
    },
    method: {
      type: String,
      enum: ['manual', 'qr', 'app'],
      required: [true, 'Method is required'],
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id ?? '');
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret._id;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

attendanceRecordSchema.index({ tenantId: 1, date: 1 }, { unique: true });
attendanceRecordSchema.index({ date: 1, status: 1 });

export const AttendanceRecord: Model<IAttendanceRecordDocument> = model<IAttendanceRecordDocument>(
  'AttendanceRecord',
  attendanceRecordSchema,
);
