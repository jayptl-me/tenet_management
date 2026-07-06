import { Schema, model, type Document, type Model } from 'mongoose';

export interface IGuardianDocument extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  tenantId: Schema.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const guardianSchema = new Schema<IGuardianDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Guardian name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    relation: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      required: [true, 'Relation is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
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

guardianSchema.index({ tenantId: 1, isActive: 1 });
guardianSchema.index({ phone: 1 });

export const Guardian: Model<IGuardianDocument> = model<IGuardianDocument>(
  'Guardian',
  guardianSchema,
);
