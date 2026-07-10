import { Schema, model, type Document, type Model } from 'mongoose';

export interface IMenuItemSubdoc {
  name: string;
  description?: string;
  category?: string;
}

export interface IDailyMenuDocument extends Document {
  id: string;
  date: string;
  meals: {
    breakfast: IMenuItemSubdoc[];
    lunch: IMenuItemSubdoc[];
    dinner: IMenuItemSubdoc[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new Schema<IMenuItemSubdoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
  },
  { _id: false },
);

const dailyMenuSchema = new Schema<IDailyMenuDocument>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    meals: {
      breakfast: { type: [menuItemSchema], default: [] },
      lunch: { type: [menuItemSchema], default: [] },
      dinner: { type: [menuItemSchema], default: [] },
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

export const DailyMenu: Model<IDailyMenuDocument> = model<IDailyMenuDocument>(
  'DailyMenu',
  dailyMenuSchema,
);
