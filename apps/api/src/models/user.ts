import { Schema, model, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const SALT_ROUNDS = 12;

export interface IUserDocument extends Document {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'admin' | 'tenant' | 'guardian';
  ntfyTopic: string;
  isActive: boolean;
  profilePhoto?: string;
  tenantId?: string;
  guardianId?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  toPublicJSON(): Omit<IUserDocument, 'passwordHash'>;
}

interface IUserModel extends Model<IUserDocument> {
  findByEmail(email: string): Promise<IUserDocument | null>;
  findWithNtfyTopic(userId: string): Promise<IUserDocument | null>;
}

const userSchema = new Schema<IUserDocument, IUserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^\+91[6-9]\d{9}$/, 'Please provide a valid Indian mobile number (+91XXXXXXXXXX)'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'tenant', 'guardian'],
      default: 'tenant',
    },
    ntfyTopic: {
      type: String,
      unique: true,
      default: () => randomUUID(),
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profilePhoto: {
      type: String,
    },
    tenantId: {
      type: String,
    },
    guardianId: {
      type: String,
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

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

userSchema.pre('save', async function () {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  }
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toJSON();
  return obj;
};

userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
};

userSchema.statics.findWithNtfyTopic = function (userId: string) {
  return this.findById(userId).select('+ntfyTopic');
};

export const User = model<IUserDocument, IUserModel>('User', userSchema);
