import { Schema, model, type Document, type Model } from 'mongoose';

export interface INoticePostDocument extends Document {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  authorId: Schema.Types.ObjectId;
  targetType: string;
  targetIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const noticePostSchema = new Schema<INoticePostDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters'],
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    targetType: {
      type: String,
      enum: ['all', 'floor', 'room'],
      default: 'all',
    },
    targetIds: {
      type: [String],
      default: [],
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

noticePostSchema.index({ pinned: -1, createdAt: -1 });
noticePostSchema.index({ targetType: 1 });

noticePostSchema.virtual('author', {
  ref: 'User',
  localField: 'authorId',
  foreignField: '_id',
  justOne: true,
});

export const NoticePost: Model<INoticePostDocument> = model<INoticePostDocument>(
  'NoticePost',
  noticePostSchema,
);
