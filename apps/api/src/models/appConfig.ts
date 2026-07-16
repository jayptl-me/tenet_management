import { Schema, model, type Document, type Model } from 'mongoose';

export interface IAppConfigDocument extends Document {
  id: string;
  pgName: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  phone: string;
  email: string;
  upiId?: string;
  upiPayeeName?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    youtube?: string;
  };
  googleMapsEmbedUrl?: string;
  amenities: string[];
  roomPricing: {
    sharing2: number;
    sharing3: number;
    sharing4: number;
  };
  primaryColor: string;
  primaryColorLight?: string;
  primaryColorDark?: string;
  landingHeroHeadline?: string;
  landingHeroSubline?: string;
  testimonials: Array<{
    name: string;
    occupation?: string;
    rating: number;
    quote: string;
  }>;
  gstNumber?: string;
  panNumber?: string;
  termsAndConditions?: string;
  amenityDefinitions: Array<{
    key: string;
    label: string;
    icon: string;
    category: 'essential' | 'appliance' | 'furnishing' | 'other';
    showAsStatusLabel: boolean;
    isPerFloor: boolean;
    maxPerFloor?: number;
    applicableComplaintCategories?: string[];
  }>;
  features: {
    attendanceEnabled: boolean;
    laundryEnabled: boolean;
    messFeedbackEnabled: boolean;
    visitorManagementEnabled: boolean;
    guardianPortalEnabled: boolean;
    noticeBoardEnabled: boolean;
    emergencyAlertsEnabled: boolean;
  };
  theme?: {
    preset: string;
    mode: string;
    brandColor?: string;
    customTokens?: Record<string, string>;
    fonts?: {
      display?: string;
      body?: string;
      mono?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    occupation: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    quote: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const amenityDefinitionSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Amenity key is required'],
      match: [/^[a-z][a-z0-9_]*$/, 'Key must be lowercase alphanumeric with underscores'],
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    icon: {
      type: String,
      required: [true, 'Icon name (lucide) is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['essential', 'appliance', 'furnishing', 'other'],
      required: [true, 'Category is required'],
    },
    showAsStatusLabel: {
      type: Boolean,
      default: false,
    },
    isPerFloor: {
      type: Boolean,
      default: true,
    },
    maxPerFloor: {
      type: Number,
      min: [0, 'Max per floor must be >= 0'],
      max: [10, 'Max per floor cannot exceed 10'],
    },
    applicableComplaintCategories: {
      type: [String],
      default: undefined,
    },
  },
  { _id: false },
);

const DEFAULT_AMENITY_DEFINITIONS = [
  {
    key: 'wifi',
    label: 'WiFi',
    icon: 'wifi',
    category: 'essential',
    showAsStatusLabel: true,
    isPerFloor: true,
    applicableComplaintCategories: ['wifi'],
  },
  {
    key: 'electricity',
    label: 'Electricity',
    icon: 'zap',
    category: 'essential',
    showAsStatusLabel: true,
    isPerFloor: true,
    applicableComplaintCategories: ['electricity', 'lights'],
  },
  {
    key: 'water_supply',
    label: 'Water Supply',
    icon: 'droplets',
    category: 'essential',
    showAsStatusLabel: true,
    isPerFloor: true,
    applicableComplaintCategories: ['water'],
  },
  {
    key: 'geyser',
    label: 'Geyser',
    icon: 'thermometer',
    category: 'essential',
    showAsStatusLabel: false,
    isPerFloor: true,
    applicableComplaintCategories: ['water'],
  },
  {
    key: 'washing_machine',
    label: 'Washing Machine',
    icon: 'shirt',
    category: 'appliance',
    showAsStatusLabel: false,
    isPerFloor: true,
    maxPerFloor: 3,
    applicableComplaintCategories: ['washing_machine'],
  },
  {
    key: 'fridge',
    label: 'Fridge',
    icon: 'sparkles',
    category: 'appliance',
    showAsStatusLabel: false,
    isPerFloor: true,
    maxPerFloor: 2,
    applicableComplaintCategories: ['fridge'],
  },
  {
    key: 'fan',
    label: 'Fan',
    icon: 'fan',
    category: 'furnishing',
    showAsStatusLabel: false,
    isPerFloor: false,
  },
  {
    key: 'bed',
    label: 'Bed',
    icon: 'bed-single',
    category: 'furnishing',
    showAsStatusLabel: false,
    isPerFloor: false,
  },
  {
    key: 'bedsheet',
    label: 'Bedsheet',
    icon: 'scroll-text',
    category: 'furnishing',
    showAsStatusLabel: false,
    isPerFloor: false,
  },
  {
    key: 'pillow',
    label: 'Pillow',
    icon: 'moon-star',
    category: 'furnishing',
    showAsStatusLabel: false,
    isPerFloor: false,
  },
];

const appConfigSchema = new Schema<IAppConfigDocument>(
  {
    pgName: {
      type: String,
      required: [true, 'PG name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'PG name cannot exceed 100 characters'],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [200, 'Tagline cannot exceed 200 characters'],
    },
    logoUrl: { type: String },
    heroImageUrl: { type: String },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'],
    },
    upiId: { type: String, trim: true },
    upiPayeeName: { type: String, trim: true },
    socialLinks: {
      facebook: { type: String },
      instagram: { type: String },
      whatsapp: { type: String },
      youtube: { type: String },
    },
    googleMapsEmbedUrl: { type: String },
    amenities: {
      type: [String],
      default: [],
    },
    roomPricing: {
      sharing2: { type: Number, required: true, min: 0 },
      sharing3: { type: Number, required: true, min: 0 },
      sharing4: { type: Number, required: true, min: 0 },
    },
    primaryColor: {
      type: String,
      required: true,
      default: '#f59e0b',
      match: [/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'],
    },
    primaryColorLight: { type: String },
    primaryColorDark: { type: String },
    landingHeroHeadline: { type: String, trim: true, maxlength: 200 },
    landingHeroSubline: { type: String, trim: true, maxlength: 500 },
    testimonials: {
      type: [testimonialSchema],
      default: [],
    },
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    termsAndConditions: { type: String, maxlength: 10000 },
    amenityDefinitions: {
      type: [amenityDefinitionSchema],
      default: () => [...DEFAULT_AMENITY_DEFINITIONS],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    features: {
      attendanceEnabled: { type: Boolean, default: false },
      laundryEnabled: { type: Boolean, default: true },
      messFeedbackEnabled: { type: Boolean, default: true },
      visitorManagementEnabled: { type: Boolean, default: true },
      guardianPortalEnabled: { type: Boolean, default: true },
      noticeBoardEnabled: { type: Boolean, default: true },
      emergencyAlertsEnabled: { type: Boolean, default: true },
    },
    theme: {
      type: {
        preset: {
          type: String,
          enum: ['brutalist', 'neumorphic', 'soft-ui', 'saas', 'custom'],
          default: 'brutalist',
        },
        mode: { type: String, enum: ['light', 'dark'], default: 'light' },
        brandColor: { type: String },
        customTokens: { type: Schema.Types.Mixed },
        fonts: {
          display: { type: String },
          body: { type: String },
          mono: { type: String },
        },
      },
      default: { preset: 'brutalist', mode: 'light' },
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

export const AppConfig: Model<IAppConfigDocument> = model<IAppConfigDocument>(
  'AppConfig',
  appConfigSchema,
);
