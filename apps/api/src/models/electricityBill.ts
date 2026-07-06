import { Schema, model, type Document, type Model } from 'mongoose';

export interface IRoomReadingSubdoc {
  roomId: Schema.Types.ObjectId;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

export interface IElectricityBillDocument extends Document {
  id: string;
  month: string;
  totalBillAmount: number;
  billImageUrl?: string;
  roomEntries: IRoomReadingSubdoc[];
  status: 'draft' | 'finalized' | 'distributed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomReadingSchema = new Schema<IRoomReadingSubdoc>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    previousReading: {
      type: Number,
      required: [true, 'Previous reading is required'],
      min: [0, 'Reading cannot be negative'],
    },
    currentReading: {
      type: Number,
      required: [true, 'Current reading is required'],
      min: [0, 'Reading cannot be negative'],
    },
    unitsConsumed: {
      type: Number,
      required: [true, 'Units consumed is required'],
      min: [0, 'Units cannot be negative'],
    },
    ratePerUnit: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [0, 'Rate cannot be negative'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
  },
  { _id: false },
);

const electricityBillSchema = new Schema<IElectricityBillDocument>(
  {
    month: {
      type: String,
      required: [true, 'Month is required'],
      unique: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'],
    },
    totalBillAmount: {
      type: Number,
      required: [true, 'Total bill amount is required'],
      min: [0, 'Total bill amount cannot be negative'],
    },
    billImageUrl: {
      type: String,
      default: null,
    },
    roomEntries: {
      type: [roomReadingSchema],
      validate: {
        validator(entries: IRoomReadingSubdoc[]) {
          return entries.length > 0;
        },
        message: 'Must have at least one room entry',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'finalized', 'distributed'],
      default: 'draft',
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

// ── Index ──────────────────────────────────────────────
electricityBillSchema.index({ month: 1 }, { unique: true });

// ── Pre-save: derive unitsConsumed and amount ──────────
electricityBillSchema.pre('save', function (this: IElectricityBillDocument) {
  for (const entry of this.roomEntries) {
    entry.unitsConsumed = entry.currentReading - entry.previousReading;
    entry.amount = entry.unitsConsumed * entry.ratePerUnit;
  }
});

export const ElectricityBill: Model<IElectricityBillDocument> = model<IElectricityBillDocument>(
  'ElectricityBill',
  electricityBillSchema,
);
