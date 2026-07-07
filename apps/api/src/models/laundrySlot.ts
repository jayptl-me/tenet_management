import { Schema, model, type Document, type Model } from 'mongoose';

export interface ILaundrySlotDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const laundrySlotSchema = new Schema<ILaundrySlotDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    slotDate: {
      type: String,
      required: [true, 'Slot date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    slotTime: {
      type: String,
      required: [true, 'Slot time is required'],
    },
    items: {
      type: Number,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      enum: ['booked', 'confirmed', 'completed', 'cancelled'],
      default: 'booked',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
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

laundrySlotSchema.index({ tenantId: 1, slotDate: 1, slotTime: 1 }, { unique: true });
laundrySlotSchema.index({ slotDate: 1, status: 1 });

// Virtual: populate tenant -> user + room for display
laundrySlotSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

export const LaundrySlot: Model<ILaundrySlotDocument> = model<ILaundrySlotDocument>(
  'LaundrySlot',
  laundrySlotSchema,
);

/** Stub retained for backwards-compat — slot generation is now manual via admin UI */
export async function generateLaundrySlots(): Promise<void> {
  // no-op: slots are now created manually through the admin dashboard
}
