import { Schema, model, type Document, type Model } from 'mongoose';
import type { IFloor } from '@pg/types/floor';

export interface IFloorDocument extends Document {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenities: {
    washingMachines: number;
    fridges: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const floorSchema = new Schema<IFloorDocument>(
  {
    floorNumber: {
      type: Number,
      required: [true, 'Floor number is required'],
      unique: true,
      min: [0, 'Floor number cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Floor number must be an integer',
      },
    },
    label: {
      type: String,
      required: [true, 'Floor label is required'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    totalRooms: {
      type: Number,
      required: [true, 'Total rooms is required'],
      min: [1, 'Must have at least 1 room'],
      max: [50, 'Cannot exceed 50 rooms per floor'],
    },
    amenities: {
      washingMachines: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      fridges: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
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

floorSchema.index({ floorNumber: 1 }, { unique: true });

export const Floor: Model<IFloorDocument> = model<IFloorDocument>('Floor', floorSchema);
