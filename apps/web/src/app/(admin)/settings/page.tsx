'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { triggerThemeUpdate } from '@/themes/ThemeProvider';
import type { IAppConfig, IFeatureFlags, ITestimonial, ThemeSettings, AmenityDefinition } from '@pg/types';
import AppearanceTab from '@/components/admin/AppearanceTab';
import AmenityTypesTab from '@/components/admin/AmenityTypesTab';

type TabKey =
  | 'general'
  | 'pricing'
  | 'payment'
  | 'amenities'
  | 'amenity-types'
  | 'testimonials'
  | 'features'
  | 'appearance'
  | 'advanced';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'payment', label: 'Payment' },
  { key: 'amenities', label: 'Landing Amenities' },
  { key: 'amenity-types', label: 'Amenity Types' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'features', label: 'Features' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'advanced', label: 'Advanced' },
];

const defaultFeatureFlags: IFeatureFlags = {
  attendanceEnabled: false,
  laundryEnabled: true,
  messFeedbackEnabled: true,
  visitorManagementEnabled: true,
  guardianPortalEnabled: true,
  noticeBoardEnabled: true,
  emergencyAlertsEnabled: true,
};

const emptyTestimonial: ITestimonial = { name: '', occupation: '', rating: 5, quote: '' };

interface ConfigFormData {
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
    youtube: string;
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
  testimonials: ITestimonial[];
  gstNumber: string;
  panNumber: string;
  termsAndConditions: string;
  features: IFeatureFlags;
  theme?: ThemeSettings;
  amenityDefinitions: AmenityDefinition[];
}

function mapToForm(config: Partial<IAppConfig>): ConfigFormData {
  return {
    pgName: config.pgName ?? '',
    tagline: config.tagline ?? '',
    logoUrl: config.logoUrl ?? '',
    heroImageUrl: config.heroImageUrl ?? '',
    address: {
      line1: config.address?.line1 ?? '',
      line2: config.address?.line2 ?? '',
      city: config.address?.city ?? '',
      state: config.address?.state ?? '',
      pincode: config.address?.pincode ?? '',
    },
    phone: config.phone ?? '',
    email: config.email ?? '',
    upiId: config.upiId ?? '',
    upiPayeeName: config.upiPayeeName ?? '',
    socialLinks: {
      instagram: config.socialLinks?.instagram ?? '',
      facebook: config.socialLinks?.facebook ?? '',
      whatsapp: config.socialLinks?.whatsapp ?? '',
      youtube: config.socialLinks?.youtube ?? '',
    },
    googleMapsEmbedUrl: config.googleMapsEmbedUrl ?? '',
    amenities: config.amenities ?? [],
    roomPricing: {
      sharing2: config.roomPricing?.sharing2 ?? 0,
      sharing3: config.roomPricing?.sharing3 ?? 0,
      sharing4: config.roomPricing?.sharing4 ?? 0,
    },
    primaryColor: config.primaryColor ?? '#f59e0b',
    primaryColorDark: config.primaryColorDark ?? '#d97706',
    landingHeroHeadline: config.landingHeroHeadline ?? '',
    landingHeroSubline: config.landingHeroSubline ?? '',
    testimonials: config.testimonials ?? [],
    gstNumber: config.gstNumber ?? '',
    panNumber: config.panNumber ?? '',
    termsAndConditions: config.termsAndConditions ?? '',
    features: { ...defaultFeatureFlags, ...(config.features ?? {}) },
    theme: config.theme ?? { preset: 'saas', mode: 'light' },
    amenityDefinitions: config.amenityDefinitions ?? [],
  };
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigFormData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newAmenity, setNewAmenity] = useState('');

  // Tab persistence via URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabKey;
    if (hash && tabs.some((t) => t.key === hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`);
    }
  };

  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => setConfig(mapToForm(res.data)))
      .catch(() => setError('Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError('');
    try {
      await api.put('app-config', { json: config }).json();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Trigger theme re-fetch so changes apply immediately
      if (typeof window !== 'undefined') {
        triggerThemeUpdate();
      }
    } catch {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const update = (patch: Partial<ConfigFormData>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateNested = <K extends keyof ConfigFormData>(
    key: K,
    patch: Partial<ConfigFormData[K]> | ((prev: ConfigFormData[K]) => ConfigFormData[K]),
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = prev[key];
      const updated =
        typeof patch === 'function'
          ? (patch as (p: ConfigFormData[K]) => ConfigFormData[K])(current)
          : { ...(current as object), ...patch };
      return { ...prev, [key]: updated };
    });
  };

  const addAmenity = () => {
    const trimmed = newAmenity.trim();
    if (!trimmed) return;
    setConfig((prev) => (prev ? { ...prev, amenities: [...prev.amenities, trimmed] } : prev));
    setNewAmenity('');
  };

  const removeAmenity = (index: number) => {
    setConfig((prev) =>
      prev ? { ...prev, amenities: prev.amenities.filter((_, i) => i !== index) } : prev,
    );
  };

  const addTestimonial = () => {
    updateNested('testimonials', (prev) => [...prev, { ...emptyTestimonial }]);
  };

  const updateTestimonial = (index: number, patch: Partial<ITestimonial>) => {
    updateNested('testimonials', (prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  };

  const removeTestimonial = (index: number) => {
    updateNested('testimonials', (prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-t-[color:var(--color-brand-500)] border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-6 text-center">
        <p className="font-[family:var(--font-display)] text-[color:var(--color-danger-800)] text-lg font-semibold">
          {error || 'Failed to load settings'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const renderSection = (title: string, description: string, content: React.ReactNode) => (
    <section className="space-y-4 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
      <div>
        <h3 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-lg font-bold">{title}</h3>
        <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">{description}</p>
      </div>
      {content}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Settings</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">
            Configure PG brand, pricing, and features
          </p>
        </div>
        <Button onClick={handleSave} loading={isSaving} size="lg">
          <Save className="h-5 w-5" />
          Save All Settings
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-success-500)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)] p-4 text-sm font-semibold">
          Settings saved successfully
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-200)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`font-[family:var(--font-display)] flex-shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-[color:var(--color-surface-100)] text-[color:var(--color-text-primary)] shadow-[var(--shadow-button)]'
                : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'general' &&
          renderSection(
            'Brand & Contact',
            'PG name, branding, contact details, and social links',
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="PG Name"
                  value={config.pgName}
                  onChange={(e) => update({ pgName: e.target.value })}
                />
                <Input
                  label="Tagline"
                  value={config.tagline}
                  onChange={(e) => update({ tagline: e.target.value })}
                />
              </div>
              <Input
                label="Logo URL"
                value={config.logoUrl}
                onChange={(e) => update({ logoUrl: e.target.value })}
                placeholder="Cloudinary URL for logo"
              />
              <Input
                label="Hero Image URL"
                value={config.heroImageUrl}
                onChange={(e) => update({ heroImageUrl: e.target.value })}
                placeholder="Cloudinary URL for hero background"
              />
              <Input
                label="Phone"
                value={config.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="+91..."
              />
              <Input
                label="Email"
                value={config.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="contact@pg.com"
              />

              <h4 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] pt-2 text-sm font-bold">Address</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Address Line 1"
                  value={config.address.line1}
                  onChange={(e) => updateNested('address', { line1: e.target.value })}
                />
                <Input
                  label="Address Line 2"
                  value={config.address.line2}
                  onChange={(e) => updateNested('address', { line2: e.target.value })}
                />
                <Input
                  label="City"
                  value={config.address.city}
                  onChange={(e) => updateNested('address', { city: e.target.value })}
                />
                <Input
                  label="State"
                  value={config.address.state}
                  onChange={(e) => updateNested('address', { state: e.target.value })}
                />
                <Input
                  label="Pincode"
                  value={config.address.pincode}
                  onChange={(e) => updateNested('address', { pincode: e.target.value })}
                />
              </div>
              <Input
                label="Google Maps Embed URL"
                value={config.googleMapsEmbedUrl}
                onChange={(e) => update({ googleMapsEmbedUrl: e.target.value })}
                placeholder="https://www.google.com/maps/embed?..."
              />

              <h4 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] pt-2 text-sm font-bold">Social Links</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Instagram"
                  value={config.socialLinks.instagram}
                  onChange={(e) => updateNested('socialLinks', { instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
                <Input
                  label="Facebook"
                  value={config.socialLinks.facebook}
                  onChange={(e) => updateNested('socialLinks', { facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                />
                <Input
                  label="WhatsApp"
                  value={config.socialLinks.whatsapp}
                  onChange={(e) => updateNested('socialLinks', { whatsapp: e.target.value })}
                  placeholder="https://wa.me/..."
                />
                <Input
                  label="YouTube"
                  value={config.socialLinks.youtube}
                  onChange={(e) => updateNested('socialLinks', { youtube: e.target.value })}
                  placeholder="https://youtube.com/..."
                />
              </div>

              <h4 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] pt-2 text-sm font-bold">Branding</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Input
                    label="Primary Color (hex)"
                    value={config.primaryColor}
                    onChange={(e) => update({ primaryColor: e.target.value })}
                  />
                  <div
                    className="mt-2 h-8 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                    style={{ backgroundColor: config.primaryColor }}
                  />
                </div>
                <div>
                  <Input
                    label="Primary Dark (hex)"
                    value={config.primaryColorDark}
                    onChange={(e) => update({ primaryColorDark: e.target.value })}
                  />
                  <div
                    className="mt-2 h-8 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                    style={{ backgroundColor: config.primaryColorDark }}
                  />
                </div>
              </div>

              <h4 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] pt-2 text-sm font-bold">Landing Page</h4>
              <Input
                label="Hero Headline"
                value={config.landingHeroHeadline}
                onChange={(e) => update({ landingHeroHeadline: e.target.value })}
              />
              <Input
                label="Hero Subline"
                value={config.landingHeroSubline}
                onChange={(e) => update({ landingHeroSubline: e.target.value })}
              />
            </div>,
          )}

        {activeTab === 'pricing' &&
          renderSection(
            'Room Pricing',
            'Default monthly rents for each sharing type',
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="2-Sharing (₹)"
                type="number"
                value={config.roomPricing.sharing2}
                onChange={(e) => updateNested('roomPricing', { sharing2: Number(e.target.value) })}
              />
              <Input
                label="3-Sharing (₹)"
                type="number"
                value={config.roomPricing.sharing3}
                onChange={(e) => updateNested('roomPricing', { sharing3: Number(e.target.value) })}
              />
              <Input
                label="4-Sharing (₹)"
                type="number"
                value={config.roomPricing.sharing4}
                onChange={(e) => updateNested('roomPricing', { sharing4: Number(e.target.value) })}
              />
            </div>,
          )}

        {activeTab === 'payment' &&
          renderSection(
            'Payment Settings',
            'UPI details for tenant payments',
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="UPI ID"
                value={config.upiId}
                onChange={(e) => update({ upiId: e.target.value })}
                placeholder="pgowner@okhdfcbank"
              />
              <Input
                label="UPI Payee Name"
                value={config.upiPayeeName}
                onChange={(e) => update({ upiPayeeName: e.target.value })}
                placeholder="Apex PG"
              />
            </div>,
          )}

        {activeTab === 'amenities' &&
          renderSection(
            'Amenities',
            'List of amenities shown on the landing page',
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add amenity (e.g. High-Speed WiFi)..."
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAmenity();
                    }
                  }}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addAmenity}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {config.amenities.length === 0 ? (
                <p className="text-[color:var(--color-text-muted)] py-4 text-center text-sm">No amenities added yet</p>
              ) : (
                <div className="space-y-2">
                  {config.amenities.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-2"
                    >
                      <span className="text-[color:var(--color-text-primary)] text-sm font-semibold">{a}</span>
                      <button
                        onClick={() => removeAmenity(i)}
                        className="text-[color:var(--color-danger-500)] hover:bg-[color:var(--color-danger-50)] rounded-md p-1 transition-colors duration-[var(--transition-duration)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>,
          )}

        {activeTab === 'amenity-types' && (
          <AmenityTypesTab
            definitions={config.amenityDefinitions}
            onChange={(defs) => update({ amenityDefinitions: defs })}
          />
        )}

        {activeTab === 'testimonials' &&
          renderSection(
            'Testimonials',
            'Reviews displayed on the landing page',
            <div className="space-y-4">
              {config.testimonials.length === 0 ? (
                <p className="text-[color:var(--color-text-muted)] py-4 text-center text-sm">
                  No testimonials added yet
                </p>
              ) : (
                config.testimonials.map((t, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-sm font-bold">
                        Testimonial #{i + 1}
                      </span>
                      <button
                        onClick={() => removeTestimonial(i)}
                        className="text-[color:var(--color-danger-500)] hover:bg-[color:var(--color-danger-50)] rounded-md p-1 transition-colors duration-[var(--transition-duration)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Name"
                        value={t.name}
                        onChange={(e) => updateTestimonial(i, { name: e.target.value })}
                      />
                      <Input
                        label="Occupation"
                        value={t.occupation ?? ''}
                        onChange={(e) => updateTestimonial(i, { occupation: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="font-[family:var(--font-body)] text-[color:var(--color-text-primary)] mb-1 block text-sm font-semibold">
                        Rating
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => updateTestimonial(i, { rating: star })}
                            className={`p-0.5 transition-colors duration-[var(--transition-duration)] ${star <= t.rating ? 'text-[color:var(--color-warning-500)]' : 'text-[color:var(--color-text-muted)]'}`}
                          >
                            <Star
                              className="h-5 w-5"
                              fill={star <= t.rating ? 'currentColor' : 'none'}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      label="Quote"
                      value={t.quote}
                      onChange={(e) => updateTestimonial(i, { quote: e.target.value })}
                      rows={2}
                      placeholder="Great place to stay..."
                    />
                  </div>
                ))
              )}
              <Button variant="outline" onClick={addTestimonial}>
                <Plus className="h-4 w-4" /> Add Testimonial
              </Button>
            </div>,
          )}

        {activeTab === 'features' &&
          renderSection(
            'Feature Toggles',
            'Enable or disable optional modules',
            <div className="space-y-3">
              {(Object.keys(config.features) as (keyof IFeatureFlags)[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between rounded-md border-[length:var(--bw-default)] border-[color:var(--color-surface-200)] px-3 py-2 transition-colors duration-[var(--transition-duration)] hover:border-[color:var(--border-color)]"
                >
                  <span className="text-[color:var(--color-text-primary)] font-[family:var(--font-body)] text-sm font-semibold">
                    {key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (s) => s.toUpperCase())
                      .trim()}
                  </span>
                  <input
                    type="checkbox"
                    checked={config.features[key]}
                    onChange={(e) =>
                      updateNested('features', {
                        [key]: e.target.checked,
                      } as Partial<IFeatureFlags>)
                    }
                    className="text-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-500)] h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] focus:ring-[length:var(--bw-default)]"
                  />
                </label>
              ))}
            </div>,
          )}

        {activeTab === 'appearance' && (
          <AppearanceTab
            theme={config.theme ?? { preset: 'saas', mode: 'light' }}
            onChange={(theme) => update({ theme })}
          />
        )}

        {activeTab === 'advanced' &&
          renderSection(
            'Legal & Advanced',
            'GST, PAN, terms and conditions',
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="GST Number"
                  value={config.gstNumber}
                  onChange={(e) => update({ gstNumber: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
                <Input
                  label="PAN Number"
                  value={config.panNumber}
                  onChange={(e) => update({ panNumber: e.target.value })}
                  placeholder="AAAAA0000A"
                />
              </div>
              <div>
                <Textarea
                  label="Terms & Conditions"
                  value={config.termsAndConditions}
                  onChange={(e) => update({ termsAndConditions: e.target.value })}
                  rows={6}
                  placeholder="Terms and conditions text (supports markdown)..."
                />
              </div>
            </div>,
          )}
      </div>

      {/* Bottom save */}
      <div className="flex items-center gap-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] pt-6">
        <Button onClick={handleSave} loading={isSaving} size="lg">
          <Save className="h-5 w-5" />
          Save All Settings
        </Button>
        {saved && (
          <span className="text-[color:var(--color-success-600)] font-[family:var(--font-display)] text-sm font-semibold">
            Settings saved
          </span>
        )}
      </div>
    </div>
  );
}
