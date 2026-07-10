import { Schema, model, type Document, type Model } from 'mongoose';

export interface IInvoiceLineItemSubdoc {
  description: string;
  amount: number;
}

export interface IInvoiceDocument extends Document {
  id: string;
  invoiceNumber: string;
  tenantId: Schema.Types.ObjectId;
  month: string;
  generatedAt: Date;
  lineItems: IInvoiceLineItemSubdoc[];
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  /** Due date for payment; defaults to 5th of billing month (or next month if past). */
  dueDate: Date | null;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<IInvoiceLineItemSubdoc>(
  {
    description: { type: String, required: [true, 'Line item description is required'] },
    amount: { type: Number, required: [true, 'Line item amount is required'], min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema<IInvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      match: [/^INV-\d{6}-\d{3}$/, 'Invoice number must be INV-YYYYMM-NNN format'],
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    month: {
      type: String,
      required: [true, 'Month is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    lineItems: {
      type: [lineItemSchema],
      default: [],
    },
    rentAmount: {
      type: Number,
      required: [true, 'Rent amount is required'],
      min: [0, 'Rent amount cannot be negative'],
    },
    electricityAmount: {
      type: Number,
      default: 0,
      min: [0, 'Electricity amount cannot be negative'],
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: [0, 'Other charges cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    dueDate: {
      type: Date,
      // Optional at schema level so historical docs load; generation always sets it.
      // Offline payment path falls back to 5th of month when missing.
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
      default: 'draft',
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
invoiceSchema.index({ tenantId: 1 });
invoiceSchema.index({ month: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ tenantId: 1, month: 1 }, { unique: true });

// ── Virtual ────────────────────────────────────────────
invoiceSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

// ── Pre-save: calculate total ───────────────────────────
invoiceSchema.pre('save', function (this: IInvoiceDocument) {
  this.totalAmount = this.rentAmount + this.electricityAmount + this.otherCharges;
});

export const Invoice: Model<IInvoiceDocument> = model<IInvoiceDocument>('Invoice', invoiceSchema);
