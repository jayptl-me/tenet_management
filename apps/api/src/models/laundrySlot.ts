import { Schema, model, type Document, type Model } from 'mongoose';

const TIME_SLOTS = [
  '06-08',
  '08-10',
  '10-12',
  '12-14',
  '14-16',
  '16-18',
  '18-20',
  '20-22',
] as const;

export interface ILaundrySlotDocument extends Document {
  id: string;
  floorId: Schema.Types.ObjectId;
  machineNumber: number;
  date: string;
  timeSlot: string;
  tenantId: Schema.Types.ObjectId | null;
  bookingId: Schema.Types.ObjectId | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const laundrySlotSchema = new Schema<ILaundrySlotDocument>(
  {
    floorId: {
      type: Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor reference is required'],
    },
    machineNumber: {
      type: Number,
      enum: [1, 2],
      required: [true, 'Machine number is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    timeSlot: {
      type: String,
      enum: TIME_SLOTS,
      required: [true, 'Time slot is required'],
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'maintenance'],
      default: 'available',
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

laundrySlotSchema.index({ floorId: 1, machineNumber: 1, date: 1, timeSlot: 1 }, { unique: true });
laundrySlotSchema.index({ tenantId: 1, date: 1 });
laundrySlotSchema.index({ floorId: 1, date: 1 });

/**
 * Auto-generate laundry slots for a floor for a given date.
 * Skips generation if slots already exist for that floor+date.
 */
export async function generateLaundrySlots(
  floorId: string,
  date: string,
  machines: number = 2,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await LaundrySlot.exists({ floorId: floorId as any, date });
  if (existing) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots: any[] = [];
  for (let machine = 1; machine <= Math.min(machines, 2); machine++) {
    for (const timeSlot of TIME_SLOTS) {
      slots.push({
        floorId,
        machineNumber: machine,
        date,
        timeSlot,
        status: 'available',
      });
    }
  }

  await LaundrySlot.insertMany(slots, { ordered: false });
}

export const LaundrySlot: Model<ILaundrySlotDocument> = model<ILaundrySlotDocument>(
  'LaundrySlot',
  laundrySlotSchema,
);
