import { Schema, model, type Document, type Model } from 'mongoose';

export interface IServiceStatusDocument extends Document {
  id: string;
  floorId: Schema.Types.ObjectId;
  serviceType: string;
  status: string;
  lastUpdatedBy: Schema.Types.ObjectId;
  lastUpdatedAt: Date;
  note?: string;
  updatedAt: Date;
}

const serviceStatusSchema = new Schema<IServiceStatusDocument>(
  {
    floorId: {
      type: Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor reference is required'],
    },
    serviceType: {
      type: String,
      enum: [
        'wifi',
        'washing_machine_1',
        'washing_machine_2',
        'fridge',
        'water_supply',
        'electricity',
      ],
      required: [true, 'Service type is required'],
    },
    status: {
      type: String,
      enum: ['operational', 'degraded', 'down'],
      default: 'operational',
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updating user is required'],
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
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

serviceStatusSchema.index({ floorId: 1, serviceType: 1 }, { unique: true });

export const ServiceStatus: Model<IServiceStatusDocument> = model<IServiceStatusDocument>(
  'ServiceStatus',
  serviceStatusSchema,
);
