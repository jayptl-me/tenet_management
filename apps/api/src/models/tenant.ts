import { Schema, model, type Document, type Model } from 'mongoose';

export interface ITenantDocument extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  roomId: Schema.Types.ObjectId;
  bedId: string;
  moveInDate: Date;
  moveOutDate: Date | null;
  depositPaid: number;
  monthlyRent: number;
  isActive: boolean;
  documents: {
    aadhaarUrl?: string;
    photoUrl?: string;
  };
  emergencyContact: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenantDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    bedId: {
      type: String,
      required: [true, 'Bed ID is required'],
      enum: ['A', 'B', 'C', 'D'],
    },
    moveInDate: {
      type: Date,
      required: [true, 'Move-in date is required'],
    },
    moveOutDate: {
      type: Date,
      default: null,
    },
    depositPaid: {
      type: Number,
      default: 0,
      min: [0, 'Deposit cannot be negative'],
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Monthly rent is required'],
      min: [1000, 'Rent must be at least ₹1,000'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    documents: {
      aadhaarUrl: { type: String },
      photoUrl: { type: String },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: {
        type: String,
        match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
      },
      relation: { type: String, trim: true },
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

// ── Indexes ─────────────────────────────────────────────
tenantSchema.index({ userId: 1 }, { unique: true });
tenantSchema.index({ roomId: 1 });
tenantSchema.index({ bedId: 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ moveInDate: -1 });
tenantSchema.index({ roomId: 1, bedId: 1, isActive: 1 });

// ── Virtuals ────────────────────────────────────────────
tenantSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

tenantSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true,
});

export const Tenant: Model<ITenantDocument> = model<ITenantDocument>('Tenant', tenantSchema);
