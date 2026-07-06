import { Schema, model, type Document, type Model } from 'mongoose';

export interface IComplaintDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  roomId: Schema.Types.ObjectId;
  category: string;
  title: string;
  description: string;
  photos: string[];
  priority: string;
  status: string;
  adminNotes?: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaintDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    category: {
      type: String,
      enum: [
        'wifi',
        'water',
        'electricity',
        'food_quality',
        'cleaning_room',
        'cleaning_washroom',
        'washing_machine',
        'fridge',
        'lights',
        'noise',
        'other',
      ],
      required: [true, 'Category is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    photos: [{ type: String }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'dismissed'],
      default: 'open',
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
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

complaintSchema.index({ tenantId: 1 });
complaintSchema.index({ roomId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ status: 1, priority: 1 });

complaintSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

complaintSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true,
});

export const Complaint: Model<IComplaintDocument> = model<IComplaintDocument>(
  'Complaint',
  complaintSchema,
);
