import { Schema, model, type Document, type Model } from 'mongoose';
import type { IFloor, AmenityCount } from '@pg/types/floor';

export interface IFloorDocument extends Document {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenityCounts: AmenityCount[];
  /** @deprecated Use amenityCounts instead */
  amenities?: {
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
    amenityCounts: {
      type: [
        new Schema(
          {
            amenityKey: {
              type: String,
              required: [true, 'Amenity key is required'],
              validate: {
                validator: (v: string) => /^[a-z][a-z0-9_]*$/.test(v),
                message: 'Amenity key must be lowercase alphanumeric with underscores',
              },
            },
            count: {
              type: Number,
              default: 0,
              min: [0, 'Count cannot be negative'],
              max: [10, 'Count cannot exceed 10'],
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /** @deprecated Use amenityCounts instead */
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
floorSchema.index({ 'amenityCounts.amenityKey': 1 });

export const Floor: Model<IFloorDocument> = model<IFloorDocument>('Floor', floorSchema);
