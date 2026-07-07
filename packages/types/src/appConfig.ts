import type { IAddress, ISocialLinks } from './common.js';
import type { IBrandTokens } from './tokens.js';

// ── Amenity Definition ─────────────────────────────────
export type AmenityCategory = 'essential' | 'appliance' | 'furnishing' | 'other';

export interface AmenityDefinition {
  key: string; // unique: "wifi", "fan", "bedsheet", "washing_machine"
  label: string; // display: "WiFi", "Fan", "Bedsheet"
  icon: string; // lucide-react icon name: "wifi", "fan", "bed-single"
  category: AmenityCategory;
  showAsStatusLabel: boolean; // quick-view dot on room list
  isPerFloor: boolean; // true = one status per floor, false = per room
  maxPerFloor?: number; // e.g. 2 for washing machines
  applicableComplaintCategories?: string[]; // maps to Complaint.category
}

export type ThemePreset = 'brutalist' | 'neumorphic' | 'soft-ui' | 'saas' | 'custom';

export type ThemeMode = 'light' | 'dark';

export interface ThemeSettings {
  preset: ThemePreset;
  mode: ThemeMode;
  brandColor?: string;
  customTokens?: Record<string, string>;
  fonts?: {
    display?: string;
    body?: string;
    mono?: string;
  };
}

export interface ITestimonial {
  name: string;
  occupation?: string;
  rating: number;
  quote: string;
}

export interface IFeatureFlags {
  attendanceEnabled: boolean;
  laundryEnabled: boolean;
  messFeedbackEnabled: boolean;
  visitorManagementEnabled: boolean;
  guardianPortalEnabled: boolean;
  noticeBoardEnabled: boolean;
  emergencyAlertsEnabled: boolean;
}

export interface IAppConfig {
  id: string;
  pgName: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  address: IAddress;
  phone: string;
  email: string;
  upiId?: string;
  upiPayeeName?: string;
  socialLinks?: ISocialLinks;
  googleMapsEmbedUrl?: string;
  amenities: string[];
  amenityDefinitions: AmenityDefinition[];
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
  testimonials: ITestimonial[];
  gstNumber?: string;
  panNumber?: string;
  termsAndConditions?: string;
  features: IFeatureFlags;
  theme?: ThemeSettings;
  brandTokens?: IBrandTokens;
  createdAt: string;
  updatedAt: string;
}

export interface IAppConfigPublic {
  pgName: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  address: IAddress;
  phone: string;
  email: string;
  socialLinks?: ISocialLinks;
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
  testimonials: ITestimonial[];
  features: IFeatureFlags;
  theme?: ThemeSettings;
  brandTokens?: IBrandTokens;
}

export interface IAppConfigUpdate {
  pgName?: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  address?: IAddress;
  phone?: string;
  email?: string;
  upiId?: string;
  upiPayeeName?: string;
  socialLinks?: ISocialLinks;
  googleMapsEmbedUrl?: string;
  amenities?: string[];
  roomPricing?: {
    sharing2?: number;
    sharing3?: number;
    sharing4?: number;
  };
  primaryColor?: string;
  primaryColorLight?: string;
  primaryColorDark?: string;
  landingHeroHeadline?: string;
  landingHeroSubline?: string;
  testimonials?: ITestimonial[];
  gstNumber?: string;
  panNumber?: string;
  termsAndConditions?: string;
  features?: IFeatureFlags;
  theme?: ThemeSettings;
  brandTokens?: IBrandTokens;
}
