import { Schema, model, type Document, type Model } from 'mongoose';

export interface IVisitorDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  expectedArrival: Date;
  actualArrival: Date | null;
  actualDeparture: Date | null;
  status: string;
  approvedBy: Schema.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const visitorSchema = new Schema<IVisitorDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    visitorName: {
      type: String,
      required: [true, 'Visitor name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    visitorPhone: {
      type: String,
      required: [true, 'Visitor phone is required'],
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true,
      maxlength: [200, 'Purpose cannot exceed 200 characters'],
    },
    expectedArrival: {
      type: Date,
      required: [true, 'Expected arrival is required'],
    },
    actualArrival: {
      type: Date,
      default: null,
    },
    actualDeparture: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['expected', 'arrived', 'departed', 'cancelled'],
      default: 'expected',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

visitorSchema.index({ tenantId: 1, expectedArrival: -1 });
visitorSchema.index({ status: 1 });
visitorSchema.index({ expectedArrival: 1 });

visitorSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

export const Visitor: Model<IVisitorDocument> = model<IVisitorDocument>('Visitor', visitorSchema);
