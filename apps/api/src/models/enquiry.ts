import { Schema, model, type Document, type Model } from 'mongoose';

export interface IEnquiryDocument extends Document {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredSharing: string;
  message?: string;
  status: string;
  source: string;
  createdAt: Date;
}

const enquirySchema = new Schema<IEnquiryDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    preferredSharing: {
      type: String,
      enum: ['2', '3', '4', 'single'],
      required: [true, 'Preferred sharing is required'],
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'lost'],
      default: 'new',
    },
    source: {
      type: String,
      enum: ['landing_page', 'referral', 'other'],
      default: 'landing_page',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

enquirySchema.index({ status: 1 });
enquirySchema.index({ createdAt: -1 });

export const Enquiry: Model<IEnquiryDocument> = model<IEnquiryDocument>('Enquiry', enquirySchema);
