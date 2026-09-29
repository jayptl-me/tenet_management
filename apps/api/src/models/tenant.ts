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
    idType?: 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';
    idNumberMasked?: string;
    idUrl?: string;
    idPublicId?: string;
    photoUrl?: string;
    photoPublicId?: string;
    isVerified?: boolean;
    verifiedAt?: Date;
    consentGiven?: boolean;
    consentTimestamp?: Date;
    // Backward compatibility fields
    aadhaarUrl?: string;
    aadhaarPublicId?: string;
  };
  emergencyContact: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  verificationProfile?: {
    fatherOrSpouseName?: string;
    dob?: Date;
    gender?: 'male' | 'female' | 'other';
    bloodGroup?: string;
    identificationMark?: string;
    permanentAddress?: {
      street?: string;
      city?: string;
      district?: string;
      state?: string;
      pincode?: string;
      policeStation?: string;
    };
    occupation?: {
      category?: 'salaried' | 'student' | 'business' | 'other';
      organizationName?: string;
      officeAddress?: string;
      idNumber?: string;
      contactPhone?: string;
    };
    localReferences?: Array<{
      name?: string;
      phone?: string;
      address?: string;
      relation?: string;
    }>;
    stayPurpose?: string;
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
      idType: {
        type: String,
        enum: ['aadhaar', 'passport', 'voter_id', 'driving_license'],
      },
      idNumberMasked: { type: String, trim: true },
      idUrl: { type: String },
      idPublicId: { type: String },
      photoUrl: { type: String },
      photoPublicId: { type: String },
      isVerified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      consentGiven: { type: Boolean, default: false },
      consentTimestamp: { type: Date },
      // Backward compatibility fields
      aadhaarUrl: { type: String },
      aadhaarPublicId: { type: String },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: {
        type: String,
        match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
      },
      relation: { type: String, trim: true },
    },
    verificationProfile: {
      fatherOrSpouseName: { type: String, trim: true },
      dob: { type: Date },
      gender: {
        type: String,
        enum: ['male', 'female', 'other'],
      },
      bloodGroup: { type: String, trim: true },
      identificationMark: { type: String, trim: true },
      permanentAddress: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
        pincode: { type: String, trim: true },
        policeStation: { type: String, trim: true },
      },
      occupation: {
        category: {
          type: String,
          enum: ['salaried', 'student', 'business', 'other'],
        },
        organizationName: { type: String, trim: true },
        officeAddress: { type: String, trim: true },
        idNumber: { type: String, trim: true },
        contactPhone: { type: String, trim: true },
      },
      localReferences: [
        {
          name: { type: String, trim: true },
          phone: { type: String, trim: true },
          address: { type: String, trim: true },
          relation: { type: String, trim: true },
        },
      ],
      stayPurpose: { type: String, trim: true },
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
tenantSchema.index({ roomId: 1 });
tenantSchema.index({ bedId: 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ moveInDate: -1 });
// P1-T1: at most one active tenant per room+bed (historical inactive rows may share)
tenantSchema.index(
  { roomId: 1, bedId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);

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
