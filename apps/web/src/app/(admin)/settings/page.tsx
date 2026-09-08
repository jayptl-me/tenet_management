'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Save, Plus, Trash2, Star, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { CardSkeleton, FormFieldSkeleton, ShimmerBlock } from '@/components/ui/Skeleton';
import { triggerThemeUpdate } from '@/themes/ThemeProvider';
import type {
  IAppConfig,
  IFeatureFlags,
  ITestimonial,
  ThemeSettings,
  AmenityDefinition,
} from '@pg/types';
import AppearanceTab from '@/components/admin/AppearanceTab';
import AmenityTypesTab from '@/components/admin/AmenityTypesTab';
import { sanitizeSettingsPayload } from '@/lib/sanitize-settings-payload';

type TabKey =
  | 'general'
  | 'pricing'
  | 'payment'
  | 'amenities'
  | 'amenity-types'
  | 'testimonials'
  | 'features'
  | 'appearance'
  | 'security'
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
  { key: 'security', label: 'Security' },
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

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const UPI_RE = /^[\w.-]{2,64}@[a-zA-Z]{2,64}$/;
const GST_RE = /^\d{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function hexError(value: string, allowEmpty = false): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return allowEmpty ? undefined : 'Use #RRGGBB format (e.g. #f59e0b)';
  }
  return HEX_RE.test(trimmed) ? undefined : 'Use #RRGGBB format (e.g. #f59e0b)';
}

function pickerValue(value: string, fallback: string): string {
  const trimmed = value.trim();
  return HEX_RE.test(trimmed) ? trimmed : fallback;
}

function getUrlError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  try {
    new URL(trimmed);
    return undefined;
  } catch {
    return 'Enter a valid URL starting with https://';
  }
}

function isPreviewableUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

function getUpiError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return UPI_RE.test(trimmed)
    ? undefined
    : 'Use the something@bank format (e.g. name@okhdfcbank)';
}

function getGstWarning(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return GST_RE.test(trimmed.toUpperCase())
    ? undefined
    : 'GSTIN is usually 15 characters (e.g. 22AAAAA0000A1Z5)';
}

function getPanWarning(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return PAN_RE.test(trimmed.toUpperCase())
    ? undefined
    : 'PAN is usually 10 characters (e.g. AAAAA0000A)';
}

function passwordStrengthHint(value: string): string {
  if (value === '') return 'Use 8+ characters with mixed case and a digit';
  const okLength = value.length >= 8;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  if (okLength && hasLower && hasUpper && hasDigit) {
    return 'Strong password: 8+ characters with mixed case and a digit';
  }
  return 'Use 8+ characters with mixed case and a digit';
}

function featureLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const FEATURE_DESCRIPTIONS: Record<keyof IFeatureFlags, string> = {
  attendanceEnabled: 'Attendance + leaves tracking (admin + tenant check-in/out)',
  laundryEnabled: 'Laundry slots + washing machines',
  messFeedbackEnabled: 'Meal feedback + menus',
  visitorManagementEnabled: 'Visitor gate-pass flow',
  guardianPortalEnabled: 'Guardian ward portal',
  noticeBoardEnabled: 'Notices feed',
  emergencyAlertsEnabled: 'Emergency broadcasts',
};

const CONFIRM_OFF_FLAGS: (keyof IFeatureFlags)[] = [
  'attendanceEnabled',
  'laundryEnabled',
  'visitorManagementEnabled',
  'guardianPortalEnabled',
  'noticeBoardEnabled',
];

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
    sharing2: number | '';
    sharing3: number | '';
    sharing4: number | '';
  };
  primaryColor: string;
  primaryColorDark: string;
  primaryColorLight?: string;
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
    primaryColorLight: (config as { primaryColorLight?: string }).primaryColorLight ?? '',
    landingHeroHeadline: config.landingHeroHeadline ?? '',
    landingHeroSubline: config.landingHeroSubline ?? '',
    testimonials: config.testimonials ?? [],
    gstNumber: config.gstNumber ?? '',
    panNumber: config.panNumber ?? '',
    termsAndConditions: config.termsAndConditions ?? '',
    features: { ...defaultFeatureFlags, ...config.features },
    theme: config.theme ?? { preset: 'saas', mode: 'light' },
    amenityDefinitions: config.amenityDefinitions ?? [],
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigFormData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newAmenity, setNewAmenity] = useState('');
  const [amenityError, setAmenityError] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Admin password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const isDirty =
    config !== null && initialSnapshot !== null
      ? JSON.stringify(config) !== initialSnapshot
      : false;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api
        .put('auth/password', {
          json: {
            currentPassword,
            newPassword,
          },
        })
        .json();

      setPasswordSuccess('Password updated successfully. Redirecting to sign in...');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully. Please log in again.');
      setTimeout(() => {
        useAuthStore.getState().logout();
        router.push('/login');
      }, 1500);
    } catch (err: unknown) {
      const parsed = await parseApiError(err);
      setPasswordError(parsed.message || 'Failed to update password');
      toast.error(parsed.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Tab persistence via URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabKey;
    if (hash && tabs.some((t) => t.key === hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = (key: TabKey) => {
    if (key === activeTab) return;
    if (isDirty && typeof window !== 'undefined') {
      const ok = window.confirm('You have unsaved changes. Switch tabs without saving?');
      if (!ok) return;
    }
    setActiveTab(key);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError('');
    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        const mapped = mapToForm(res.data);
        setConfig(mapped);
        setInitialSnapshot(JSON.stringify(mapped));
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, [reloadKey]);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError('');
    try {
      // Never POST raw form state: empty strings fail API Zod (phone/email optional
      // but '' is not undefined; blank testimonials fail name/quote min 1).
      const rawPayload = sanitizeSettingsPayload(
        config as unknown as Parameters<typeof sanitizeSettingsPayload>[0],
      ) as Record<string, unknown>;
      // Cleared pricing fields stay empty in form state and are omitted here so the
      // server keeps its saved values instead of persisting Rs 0.
      const pricing = config.roomPricing;
      const pricingIncomplete = [pricing.sharing2, pricing.sharing3, pricing.sharing4].some(
        (v) => v === '' || (typeof v === 'number' && Number.isNaN(v)),
      );
      if (pricingIncomplete) {
        delete rawPayload.roomPricing;
      }
      await api.put('app-config', { json: rawPayload }).json();
      setSaved(true);
      setInitialSnapshot(JSON.stringify(config));
      setTimeout(() => setSaved(false), 2000);
      // Trigger theme re-fetch so changes apply immediately
      if (typeof window !== 'undefined') {
        triggerThemeUpdate();
      }
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || 'Failed to save settings');
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

  const handlePricingChange = (field: 'sharing2' | 'sharing3' | 'sharing4', raw: string) => {
    const next: number | '' = raw === '' ? '' : Number(raw);
    const safe: number | '' = typeof next === 'number' && Number.isNaN(next) ? '' : next;
    updateNested('roomPricing', { [field]: safe } as Partial<ConfigFormData['roomPricing']>);
  };

  const handleFeatureToggle = (key: keyof IFeatureFlags, checked: boolean) => {
    if (
      CONFIRM_OFF_FLAGS.includes(key) &&
      config?.features[key] === true &&
      checked === false &&
      typeof window !== 'undefined'
    ) {
      const ok = window.confirm(
        `Turning off ${featureLabel(key)} will block its portal routes (403). Continue?`,
      );
      if (!ok) return;
    }
    updateNested('features', { [key]: checked } as Partial<IFeatureFlags>);
  };

  const addAmenity = () => {
    const trimmed = newAmenity.trim();
    if (!trimmed) return;
    const exists = (config?.amenities ?? []).some(
      (a) => a.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setAmenityError('This amenity already exists');
      return;
    }
    setAmenityError('');
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
      <div className="space-y-6" aria-label="Loading settings">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full max-w-sm space-y-2">
            <ShimmerBlock className="h-7 w-40" />
            <ShimmerBlock className="h-4 w-64" />
          </div>
          <ShimmerBlock className="h-11 w-44 rounded-[var(--radius-lg)]" />
        </div>
        <ShimmerBlock className="h-11 w-full rounded-xl" />
        <CardSkeleton lines={5} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormFieldSkeleton />
          <FormFieldSkeleton />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-6 text-center">
        <p className="text-lg font-display font-semibold text-[color:var(--color-danger-800)]">
          {error || 'Failed to load settings'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setReloadKey((k) => k + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  const logoUrlError = getUrlError(config.logoUrl);
  const heroUrlError = getUrlError(config.heroImageUrl);
  const logoPreview = isPreviewableUrl(config.logoUrl);
  const heroPreview = isPreviewableUrl(config.heroImageUrl);
  const primaryColorError = hexError(config.primaryColor);
  const primaryDarkError = hexError(config.primaryColorDark);
  const primaryLightError = hexError(config.primaryColorLight ?? '', true);
  const addressParts = [
    config.address.line1,
    config.address.city,
    config.address.state,
    config.address.pincode,
  ];
  const addressFilled = addressParts.filter((v) => v.trim() !== '').length;
  const showAddressWarning = addressFilled > 0 && addressFilled < 4;
  const upiError = getUpiError(config.upiId);
  const gstWarning = getGstWarning(config.gstNumber);
  const panWarning = getPanWarning(config.panNumber);

  const renderSection = (title: string, description: string, content: React.ReactNode) => (
    <section className="space-y-4 rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
      <div>
        <h3 className="text-lg font-display font-bold text-[color:var(--color-text-primary)]">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">{description}</p>
      </div>
      {content}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-[color:var(--color-text-primary)]">
            Settings
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Configure PG brand, pricing, and features
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="rounded-full border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-100)] px-2.5 py-1 text-xs font-bold text-[color:var(--color-warning-800)]">
              Unsaved changes
            </span>
          )}
          <Button onClick={handleSave} loading={isSaving} size="lg">
            <Save className="h-5 w-5" />
            Save All Settings
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-4 text-sm font-semibold text-[color:var(--color-danger-800)]">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-success-500)] bg-[color:var(--color-success-100)] p-4 text-sm font-semibold text-[color:var(--color-success-800)]">
          Settings saved successfully
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Settings categories"
        className="flex gap-1 overflow-x-auto rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-200)] p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-display font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-[color:var(--color-card-bg)] text-[color:var(--color-text-primary)] shadow-[var(--shadow-button)]'
                : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="space-y-6"
      >
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
              <div className="space-y-2">
                <Input
                  label="Logo URL"
                  value={config.logoUrl}
                  onChange={(e) => update({ logoUrl: e.target.value })}
                  placeholder="Cloudinary URL for logo"
                  error={logoUrlError}
                  helperText={
                    logoUrlError
                      ? undefined
                      : 'Full https:// URL, e.g. https://res.cloudinary.com/...'
                  }
                />
                {logoPreview && (
                  <div className="flex items-center gap-3">
                    <Image
                      key={config.logoUrl.trim()}
                      src={config.logoUrl.trim()}
                      alt="Logo preview"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] object-contain p-1"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      Live logo preview
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  label="Hero Image URL"
                  value={config.heroImageUrl}
                  onChange={(e) => update({ heroImageUrl: e.target.value })}
                  placeholder="Cloudinary URL for hero background"
                  error={heroUrlError}
                  helperText={
                    heroUrlError
                      ? undefined
                      : 'Full https:// URL, e.g. https://res.cloudinary.com/...'
                  }
                />
                {heroPreview && (
                  <div className="flex items-center gap-3">
                    <Image
                      key={config.heroImageUrl.trim()}
                      src={config.heroImageUrl.trim()}
                      alt="Hero preview"
                      width={112}
                      height={64}
                      unoptimized
                      className="h-16 w-28 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      Live hero preview
                    </span>
                  </div>
                )}
              </div>
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

              <h4 className="pt-2 text-sm font-display font-bold text-[color:var(--color-text-primary)]">
                Address
              </h4>
              <p className="-mt-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                Saved only when line 1, city, state, and pincode are all filled; a partial address
                is left unchanged.
              </p>
              {showAddressWarning && (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-2.5 text-xs font-semibold text-[color:var(--color-warning-800)]"
                >
                  Partial address will be left unchanged on save. Fill line 1, city, state and
                  pincode to update it.
                </p>
              )}
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

              <h4 className="pt-2 text-sm font-display font-bold text-[color:var(--color-text-primary)]">
                Social Links
              </h4>
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

              <h4 className="pt-2 text-sm font-display font-bold text-[color:var(--color-text-primary)]">
                Branding
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Primary Color (hex)"
                        value={config.primaryColor}
                        onChange={(e) => update({ primaryColor: e.target.value })}
                        placeholder="#f59e0b"
                        error={primaryColorError}
                        helperText={
                          primaryColorError ? undefined : '6-digit hex, e.g. #f59e0b'
                        }
                      />
                    </div>
                    <input
                      type="color"
                      aria-label="Pick primary color"
                      value={pickerValue(config.primaryColor, '#f59e0b')}
                      onChange={(e) => update({ primaryColor: e.target.value })}
                      className="mb-0.5 h-10 w-12 cursor-pointer rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                    style={{ backgroundColor: config.primaryColor }}
                  />
                </div>
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Primary Dark (hex)"
                        value={config.primaryColorDark}
                        onChange={(e) => update({ primaryColorDark: e.target.value })}
                        placeholder="#d97706"
                        error={primaryDarkError}
                        helperText={
                          primaryDarkError ? undefined : '6-digit hex, e.g. #d97706'
                        }
                      />
                    </div>
                    <input
                      type="color"
                      aria-label="Pick primary dark color"
                      value={pickerValue(config.primaryColorDark, '#d97706')}
                      onChange={(e) => update({ primaryColorDark: e.target.value })}
                      className="mb-0.5 h-10 w-12 cursor-pointer rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                    style={{ backgroundColor: config.primaryColorDark }}
                  />
                </div>
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Primary Light (hex, optional)"
                        value={config.primaryColorLight ?? ''}
                        onChange={(e) => update({ primaryColorLight: e.target.value })}
                        placeholder="#fef3c7"
                        error={primaryLightError}
                        helperText={
                          primaryLightError ? undefined : 'Optional 6-digit hex, e.g. #fef3c7'
                        }
                      />
                    </div>
                    <input
                      type="color"
                      aria-label="Pick primary light color"
                      value={pickerValue(config.primaryColorLight ?? '', '#ffffff')}
                      onChange={(e) => update({ primaryColorLight: e.target.value })}
                      className="mb-0.5 h-10 w-12 cursor-pointer rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                    style={{
                      backgroundColor:
                        config.primaryColorLight && config.primaryColorLight.trim() !== ''
                          ? config.primaryColorLight
                          : 'transparent',
                    }}
                  />
                </div>
              </div>

              <h4 className="pt-2 text-sm font-display font-bold text-[color:var(--color-text-primary)]">
                Landing Page
              </h4>
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
            'Default monthly rents for each sharing type. Clear a field to keep the saved value.',
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="2-Sharing (Rs)"
                type="number"
                value={config.roomPricing.sharing2}
                onChange={(e) => handlePricingChange('sharing2', e.target.value)}
                helperText="Empty keeps saved value"
              />
              <Input
                label="3-Sharing (Rs)"
                type="number"
                value={config.roomPricing.sharing3}
                onChange={(e) => handlePricingChange('sharing3', e.target.value)}
                helperText="Empty keeps saved value"
              />
              <Input
                label="4-Sharing (Rs)"
                type="number"
                value={config.roomPricing.sharing4}
                onChange={(e) => handlePricingChange('sharing4', e.target.value)}
                helperText="Empty keeps saved value"
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
                error={upiError}
                helperText={
                  upiError ? undefined : 'Format: something@bank, e.g. pgowner@okhdfcbank'
                }
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
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                Landing amenities are marketing strings shown on the public site. Amenity Types
                are operational definitions used by floors, rooms and complaints.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Add amenity (e.g. High-Speed WiFi)..."
                  value={newAmenity}
                  onChange={(e) => {
                    setNewAmenity(e.target.value);
                    if (amenityError) setAmenityError('');
                  }}
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
              {amenityError && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-[color:var(--color-danger-700)]"
                >
                  {amenityError}
                </p>
              )}
              {config.amenities.length === 0 ? (
                <p className="py-4 text-center text-sm text-[color:var(--color-text-muted)]">
                  No amenities added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {config.amenities.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-4 py-2"
                    >
                      <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                        {a}
                      </span>
                      <button
                        onClick={() => removeAmenity(i)}
                        className="rounded-md p-1 text-[color:var(--color-danger-500)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-danger-50)]"
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
                <p className="py-4 text-center text-sm text-[color:var(--color-text-muted)]">
                  No testimonials added yet
                </p>
              ) : (
                config.testimonials.map((t, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-display font-bold text-[color:var(--color-text-primary)]">
                        Testimonial #{i + 1}
                      </span>
                      <button
                        onClick={() => removeTestimonial(i)}
                        className="rounded-md p-1 text-[color:var(--color-danger-500)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-danger-50)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Name"
                        value={t.name}
                        onChange={(e) => updateTestimonial(i, { name: e.target.value })}
                        helperText="Min 1 character or this card is dropped on save"
                      />
                      <Input
                        label="Occupation"
                        value={t.occupation ?? ''}
                        onChange={(e) => updateTestimonial(i, { occupation: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-body font-semibold text-[color:var(--color-text-primary)]">
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
                      helperText="Min 1 character or this card is dropped on save"
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
            'Enable or disable optional modules. Disabling a module blocks its portal routes (403).',
            <div className="space-y-1">
              {(Object.keys(config.features) as (keyof IFeatureFlags)[]).map((key) => (
                <Switch
                  key={key}
                  label={featureLabel(key)}
                  description={FEATURE_DESCRIPTIONS[key]}
                  checked={config.features[key]}
                  onChange={(e) => handleFeatureToggle(key, e.target.checked)}
                />
              ))}
            </div>,
          )}

        {activeTab === 'appearance' && (
          <AppearanceTab
            theme={config.theme ?? { preset: 'saas', mode: 'light' }}
            onChange={(theme) => update({ theme })}
          />
        )}

        {activeTab === 'security' &&
          renderSection(
            'Admin Security & Password',
            'Update your administrator master password credentials',
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              {passwordError && (
                <div className="rounded-[var(--radius-md)] border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-3 text-sm font-medium text-[color:var(--color-danger-800)]">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-[var(--radius-md)] border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-sm font-medium text-[color:var(--color-success-800)]">
                  {passwordSuccess}
                </div>
              )}
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                autoComplete="current-password"
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                helperText={passwordStrengthHint(newPassword)}
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />
              <div className="pt-2">
                <Button type="submit" loading={isUpdatingPassword} disabled={isUpdatingPassword}>
                  <Lock className="h-4 w-4" />
                  Update Password
                </Button>
              </div>
            </form>,
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
                  error={gstWarning}
                  helperText={gstWarning ? undefined : '15-character GSTIN, e.g. 22AAAAA0000A1Z5'}
                />
                <Input
                  label="PAN Number"
                  value={config.panNumber}
                  onChange={(e) => update({ panNumber: e.target.value })}
                  placeholder="AAAAA0000A"
                  error={panWarning}
                  helperText={panWarning ? undefined : '10-character PAN, e.g. AAAAA0000A'}
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
        {isDirty && (
          <span className="rounded-full border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-100)] px-2.5 py-1 text-xs font-bold text-[color:var(--color-warning-800)]">
            Unsaved changes
          </span>
        )}
        <Button onClick={handleSave} loading={isSaving} size="lg">
          <Save className="h-5 w-5" />
          Save All Settings
        </Button>
        {saved && (
          <span className="text-sm font-display font-semibold text-[color:var(--color-success-600)]">
            Settings saved
          </span>
        )}
      </div>
    </div>
  );
}
