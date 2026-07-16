/**
 * Drives the shipped sanitizeSettingsPayload used by Settings handleSave.
 * Proves empty phone/email/testimonials never reach API as '' or blank rows.
 */
import { describe, it, expect } from 'bun:test';
import {
  emptyToUndef,
  sanitizeSettingsPayload,
  type SettingsFormLike,
} from './sanitize-settings-payload';

function baseForm(overrides: Partial<SettingsFormLike> = {}): SettingsFormLike {
  return {
    pgName: 'Test PG',
    tagline: '',
    logoUrl: '',
    heroImageUrl: '',
    address: { line1: '1 St', line2: '', city: 'City', state: 'ST', pincode: '560001' },
    phone: '',
    email: '',
    upiId: '',
    upiPayeeName: '',
    socialLinks: { instagram: '', facebook: '', whatsapp: '', youtube: 'https://yt.example' },
    googleMapsEmbedUrl: '',
    amenities: ['wifi'],
    roomPricing: { sharing2: 8000, sharing3: 6000, sharing4: 5000 },
    primaryColor: '#f59e0b',
    primaryColorDark: '#d97706',
    landingHeroHeadline: '',
    landingHeroSubline: '',
    testimonials: [
      { name: '', occupation: '', rating: 5, quote: '' },
      { name: 'Valid User', occupation: 'Eng', rating: 5, quote: 'Great stay' },
    ],
    gstNumber: '',
    panNumber: '',
    termsAndConditions: '',
    features: { laundryEnabled: true },
    theme: { preset: 'saas', mode: 'light' },
    amenityDefinitions: [{ key: 'wifi', label: 'WiFi' }],
    ...overrides,
  };
}

describe('sanitizeSettingsPayload (settings Save path)', () => {
  it('emptyToUndef maps blank strings to undefined', () => {
    expect(emptyToUndef('')).toBeUndefined();
    expect(emptyToUndef('   ')).toBeUndefined();
    expect(emptyToUndef('+919876543210')).toBe('+919876543210');
  });

  it('omits empty phone and email so Zod optional fields do not see ""', () => {
    const payload = sanitizeSettingsPayload(baseForm({ phone: '', email: '' }));
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('email');
  });

  it('keeps valid phone and email when set', () => {
    const payload = sanitizeSettingsPayload(
      baseForm({ phone: '+919876543210', email: 'admin@pg.local' }),
    );
    expect(payload.phone).toBe('+919876543210');
    expect(payload.email).toBe('admin@pg.local');
  });

  it('filters blank testimonials and keeps valid ones', () => {
    const payload = sanitizeSettingsPayload(baseForm());
    const testimonials = payload.testimonials as Array<{ name: string; quote: string }>;
    expect(testimonials).toHaveLength(1);
    expect(testimonials[0]!.name).toBe('Valid User');
    expect(testimonials[0]!.quote).toBe('Great stay');
  });

  it('includes youtube social when set', () => {
    const payload = sanitizeSettingsPayload(baseForm());
    const social = payload.socialLinks as Record<string, string | undefined>;
    expect(social.youtube).toBe('https://yt.example');
  });

  it('omits blank youtube social', () => {
    const payload = sanitizeSettingsPayload(
      baseForm({ socialLinks: { instagram: '', facebook: '', whatsapp: '', youtube: '' } }),
    );
    const social = payload.socialLinks as Record<string, string | undefined>;
    expect(social.youtube).toBeUndefined();
  });

  it('includes amenityDefinitions and gst when provided', () => {
    const payload = sanitizeSettingsPayload(
      baseForm({
        gstNumber: '29AAAAA0000A1Z5',
        amenityDefinitions: [{ key: 'wifi', label: 'WiFi' }],
      }),
    );
    expect(payload.gstNumber).toBe('29AAAAA0000A1Z5');
    expect(payload.amenityDefinitions).toEqual([{ key: 'wifi', label: 'WiFi' }]);
  });
});
