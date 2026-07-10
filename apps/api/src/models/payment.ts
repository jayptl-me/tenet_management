import { Schema, model, type Document, type Model } from 'mongoose';

export interface IPaymentDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  amount: number;
  type: 'rent' | 'electricity' | 'deposit' | 'laundry' | 'other';
  method: 'upi' | 'cash' | 'bank_transfer' | 'other';
  status: 'pending' | 'pending_verification' | 'paid' | 'overdue' | 'cancelled';
  month: string;
  dueDate: Date;
  paidAt: Date | null;
  utrNumber?: string;
  verifiedBy?: Schema.Types.ObjectId | null;
  screenshotUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice reference is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    type: {
      type: String,
      enum: ['rent', 'electricity', 'deposit', 'laundry', 'other'],
      required: [true, 'Payment type is required'],
    },
    method: {
      type: String,
      enum: ['upi', 'cash', 'bank_transfer', 'other'],
      default: 'upi',
    },
    status: {
      type: String,
      enum: ['pending', 'pending_verification', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
    },
    month: {
      type: String,
      required: [true, 'Month is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    paidAt: {
      type: Date,
      default: null,
    },
    utrNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      validate: {
        validator(v: string | null | undefined) {
          if (!v) return true;
          return /^[A-Z0-9]{6,22}$/.test(v);
        },
        message: 'UTR must be 6-22 alphanumeric characters',
      },
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    screenshotUrl: {
      type: String,
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
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ── Indexes ─────────────────────────────────────────────
paymentSchema.index({ tenantId: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ month: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ tenantId: 1, month: 1 });

// ── Virtuals ────────────────────────────────────────────
paymentSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

paymentSchema.virtual('invoice', {
  ref: 'Invoice',
  localField: 'invoiceId',
  foreignField: '_id',
  justOne: true,
});

export const Payment: Model<IPaymentDocument> = model<IPaymentDocument>('Payment', paymentSchema);
