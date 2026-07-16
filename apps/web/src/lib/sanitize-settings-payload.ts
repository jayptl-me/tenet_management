/**
 * Sanitize admin Settings form state for PUT /app-config.
 * Form fields use '' for empty inputs; API Zod treats optional phone/email as
 * real strings and rejects '' with regex/email. Blank testimonials fail min(1).
 */

export type SettingsFormLike = {
  pgName: string;
  tagline: string;
  logoUrl: string;
  heroImageUrl: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
  phone: string;
  email: string;
  upiId: string;
  upiPayeeName: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    youtube?: string;
  };
  googleMapsEmbedUrl: string;
  amenities: string[];
  roomPricing: {
    sharing2: number;
    sharing3: number;
    sharing4: number;
  };
  primaryColor: string;
  primaryColorDark: string;
  landingHeroHeadline: string;
  landingHeroSubline: string;
  testimonials: Array<{
    name: string;
    occupation?: string;
    rating: number;
    quote: string;
  }>;
  gstNumber: string;
  panNumber: string;
  termsAndConditions: string;
  features: unknown;
  theme?: unknown;
  amenityDefinitions: unknown[];
};

export function emptyToUndef(value: string | undefined | null): string | undefined {
  const t = (value ?? '').trim();
  return t === '' ? undefined : t;
}

export function sanitizeSettingsPayload(config: SettingsFormLike): Record<string, unknown> {
  const phone = emptyToUndef(config.phone);
  const email = emptyToUndef(config.email);

  const testimonials = (config.testimonials ?? [])
    .filter((t) => Boolean(t.name?.trim()) && Boolean(t.quote?.trim()))
    .map((t) => ({
      name: t.name.trim(),
      occupation: emptyToUndef(t.occupation),
      rating: t.rating >= 1 && t.rating <= 5 ? t.rating : 5,
      quote: t.quote.trim().slice(0, 500),
    }));

  const addr = config.address;
  const hasAddress = Boolean(
    emptyToUndef(addr?.line1) &&
      emptyToUndef(addr?.city) &&
      emptyToUndef(addr?.state) &&
      emptyToUndef(addr?.pincode),
  );

  const payload: Record<string, unknown> = {
    pgName: emptyToUndef(config.pgName)?.slice(0, 100),
    tagline: emptyToUndef(config.tagline)?.slice(0, 200),
    logoUrl: emptyToUndef(config.logoUrl),
    heroImageUrl: emptyToUndef(config.heroImageUrl),
    phone,
    email,
    upiId: emptyToUndef(config.upiId),
    upiPayeeName: emptyToUndef(config.upiPayeeName),
    socialLinks: {
      facebook: emptyToUndef(config.socialLinks?.facebook),
      instagram: emptyToUndef(config.socialLinks?.instagram),
      whatsapp: emptyToUndef(config.socialLinks?.whatsapp),
      youtube: emptyToUndef(config.socialLinks?.youtube),
    },
    googleMapsEmbedUrl: emptyToUndef(config.googleMapsEmbedUrl),
    amenities: config.amenities ?? [],
    roomPricing: config.roomPricing,
    primaryColor: config.primaryColor || undefined,
    primaryColorDark: config.primaryColorDark || undefined,
    landingHeroHeadline: emptyToUndef(config.landingHeroHeadline)?.slice(0, 200),
    landingHeroSubline: emptyToUndef(config.landingHeroSubline)?.slice(0, 500),
    testimonials,
    gstNumber: emptyToUndef(config.gstNumber)?.slice(0, 20),
    panNumber: emptyToUndef(config.panNumber)?.slice(0, 20),
    termsAndConditions: emptyToUndef(config.termsAndConditions)?.slice(0, 10000),
    features: config.features,
    theme: config.theme,
    amenityDefinitions: config.amenityDefinitions ?? [],
  };

  if (hasAddress && addr) {
    payload.address = {
      line1: addr.line1.trim(),
      line2: emptyToUndef(addr.line2),
      city: addr.city.trim(),
      state: addr.state.trim(),
      pincode: addr.pincode.trim(),
    };
  }

  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}
