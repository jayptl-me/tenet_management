import { Schema, model, type Document, type Model } from 'mongoose';

export interface IAssetDocument extends Document {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  lowStockThreshold: number;
  status: string;
  purchasedDate: Date | null;
  lastServicedDate: Date | null;
  nextServiceDate: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAssetDocument>(
  {
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    category: {
      type: String,
      enum: ['furniture', 'appliance', 'electronics', 'cleaning', 'other'],
      required: [true, 'Category is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [160, 'Location cannot exceed 160 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 1,
    },
    lowStockThreshold: {
      type: Number,
      min: [0, 'Threshold cannot be negative'],
      default: 0,
    },
    status: {
      type: String,
      enum: ['available', 'in_use', 'under_maintenance', 'damaged', 'retired'],
      default: 'available',
    },
    purchasedDate: {
      type: Date,
      default: null,
    },
    lastServicedDate: {
      type: Date,
      default: null,
    },
    nextServiceDate: {
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

assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ nextServiceDate: 1 });

export const Asset: Model<IAssetDocument> = model<IAssetDocument>('Asset', assetSchema);
