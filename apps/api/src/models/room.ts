import { Schema, model, type Document, type Model } from 'mongoose';
import type { SharingType, RoomAmenityStatus } from '@pg/types/room';
import { Floor } from './floor.js';

const BED_IDS = ['A', 'B', 'C', 'D'] as const;

export interface IBedSubdoc {
  bedId: string;
  isOccupied: boolean;
  tenantId: Schema.Types.ObjectId | null;
}

export interface IRoomDocument extends Document {
  id: string;
  roomNumber: string;
  floorId: Schema.Types.ObjectId;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  photos: string[];
  beds: IBedSubdoc[];
  roomAmenities: RoomAmenityStatus[];
  occupancyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IRoomModel extends Model<IRoomDocument> {
  generateBeds(sharingType: SharingType): IBedSubdoc[];
}

const bedSchema = new Schema<IBedSubdoc>(
  {
    bedId: {
      type: String,
      required: true,
      enum: BED_IDS,
    },
    isOccupied: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
  },
  { _id: false },
);

const roomAmenitySchema = new Schema<RoomAmenityStatus>(
  {
    amenityKey: {
      type: String,
      required: true,
      match: /^[a-z][a-z0-9_]*$/,
    },
    status: {
      type: String,
      enum: ['operational', 'degraded', 'down'],
      default: 'operational',
    },
  },
  { _id: false },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roomSchema: any = new Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Room number cannot exceed 20 characters'],
    },
    floorId: {
      type: Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor is required'],
    },
    sharingType: {
      type: Number,
      required: [true, 'Sharing type is required'],
      enum: [2, 3, 4],
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Monthly rent is required'],
      min: [1000, 'Rent must be at least ₹1,000'],
      max: [50000, 'Rent cannot exceed ₹50,000'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    photos: [{ type: String }],
    roomAmenities: {
      type: [roomAmenitySchema],
      default: [],
    },
    beds: {
      type: [bedSchema],
      validate: {
        validator(beds: IBedSubdoc[]) {
          return beds.length === (this as unknown as IRoomDocument).sharingType;
        },
        message: 'Number of beds must equal sharing type',
      },
    },
    occupancyCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: unknown, ret: Record<string, unknown>) {
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
roomSchema.index({ floorId: 1 });
roomSchema.index({ sharingType: 1 });
roomSchema.index({ isActive: 1 });
roomSchema.index({ 'beds.isOccupied': 1 });
roomSchema.index({ 'roomAmenities.amenityKey': 1 });

// ── Virtual: populate floor info ────────────────────────
roomSchema.virtual('floor', {
  ref: 'Floor',
  localField: 'floorId',
  foreignField: '_id',
  justOne: true,
});

// ── Pre-save: derive occupancyCount ─────────────────────
roomSchema.pre('save', function (this: IRoomDocument) {
  if (this.isModified('beds')) {
    this.occupancyCount = this.beds.filter((b) => b.isOccupied).length;
  }
});

// ── Post-save: keep Floor.totalRooms in sync ────────────
roomSchema.post('save', async function (doc: IRoomDocument) {
  try {
    const count = await Room.countDocuments({ floorId: doc.floorId, isActive: true });
    await Floor.findByIdAndUpdate(doc.floorId, { totalRooms: count });
  } catch {
    // Silently ignore — don't block the room save on floor update failure
  }
});

// ── Post-remove: decrement Floor.totalRooms on deletion ─
roomSchema.post('findOneAndDelete', async function (doc: IRoomDocument | null) {
  if (!doc) return;
  try {
    const count = await Room.countDocuments({ floorId: doc.floorId, isActive: true });
    await Floor.findByIdAndUpdate(doc.floorId, { totalRooms: count });
  } catch {
    // Silently ignore
  }
});

// ── Static: auto-generate beds from sharingType ─────────
roomSchema.statics.generateBeds = function (sharingType: SharingType): IBedSubdoc[] {
  const count = sharingType === 2 ? 2 : sharingType === 3 ? 3 : 4;
  return BED_IDS.slice(0, count).map((bedId) => ({
    bedId,
    isOccupied: false,
    tenantId: null,
  }));
};

export const Room = model<IRoomDocument, IRoomModel>('Room', roomSchema);
