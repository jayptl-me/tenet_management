import { Schema, model, type Document, type Model } from 'mongoose';

export interface IMealFeedbackDocument extends Document {
  id: string;
  tenantId: Schema.Types.ObjectId;
  date: string;
  mealType: string;
  rating: number;
  comment?: string;
  categories: string[];
  createdAt: Date;
}

const mealFeedbackSchema = new Schema<IMealFeedbackDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'],
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner'],
      required: [true, 'Meal type is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      default: '',
    },
    categories: {
      type: [String],
      default: [],
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

mealFeedbackSchema.index({ tenantId: 1, date: 1, mealType: 1 }, { unique: true });

export const MealFeedback: Model<IMealFeedbackDocument> = model<IMealFeedbackDocument>(
  'MealFeedback',
  mealFeedbackSchema,
);
