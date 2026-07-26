import { Schema, model, Types, type Document, type Model } from 'mongoose';

export interface IWashingMachineDocument extends Document {
  id: string;
  floorId: Types.ObjectId;
  machineNumber: number;
  label: string;
  status: string; // 'available' | 'in_use' | 'under_maintenance' | 'down'
  currentUserId: Types.ObjectId | null; // Tenant who claimed it
  claimedAt: Date | null;
  timerDuration: number; // minutes (default 50)
  timerEndsAt: Date | null;
  lastUsedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const washingMachineSchema = new Schema<IWashingMachineDocument>(
  {
    floorId: {
      type: Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor reference is required'],
    },
    machineNumber: {
      type: Number,
      required: [true, 'Machine number is required'],
      min: [1, 'Machine number must be at least 1'],
    },
    label: {
      type: String,
      trim: true,
      maxlength: [80, 'Label cannot exceed 80 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['available', 'in_use', 'under_maintenance', 'down'],
      default: 'available',
    },
    currentUserId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    timerDuration: {
      type: Number,
      default: 50,
      min: [10, 'Timer must be at least 10 minutes'],
      max: [180, 'Timer cannot exceed 180 minutes'],
    },
    timerEndsAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
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

// Compound unique: one machine number per floor
washingMachineSchema.index({ floorId: 1, machineNumber: 1 }, { unique: true });
washingMachineSchema.index({ floorId: 1, status: 1 });
washingMachineSchema.index({ currentUserId: 1 });
washingMachineSchema.index({ timerEndsAt: 1 });

// Virtual: populate floor
washingMachineSchema.virtual('floor', {
  ref: 'Floor',
  localField: 'floorId',
  foreignField: '_id',
  justOne: true,
});

// Virtual: populate current tenant user info
washingMachineSchema.virtual('currentUser', {
  ref: 'Tenant',
  localField: 'currentUserId',
  foreignField: '_id',
  justOne: true,
});

export const WashingMachine: Model<IWashingMachineDocument> = model<IWashingMachineDocument>(
  'WashingMachine',
  washingMachineSchema,
);
