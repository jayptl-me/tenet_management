'use client';

import { useEffect, useState } from 'react';
import { PaintBucket, Monitor, Moon, Sun, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { applyThemeToDOM } from '@/hooks/useTheme';
import { generateColorScale } from '@/lib/colorScale';
import type { ThemeSettings } from '@pg/types';

const themePresets: { value: ThemeSettings['preset']; label: string; description: string }[] = [
  {
    value: 'brutalist',
    label: 'Brutalist',
    description: 'Bold borders, hard shadows, chunky typography',
  },
  {
    value: 'neumorphic',
    label: 'Neumorphic',
    description: 'Soft, tactile, extruded — duotone shadows',
  },
  {
    value: 'soft-ui',
    label: 'Glassmorphic',
    description: 'Frosted glass, luminous, multi-layer shadows',
  },
  {
    value: 'saas',
    label: 'SaaS / Enterprise',
    description: 'Clean, professional, minimal decoration',
  },
  { value: 'custom', label: 'Custom', description: 'Neutral canvas driven by your brand color' },
];

/** Static identity swatches per preset (brand / surface / ink). */
const PRESET_SWATCHES: Record<ThemeSettings['preset'], { dots: [string, string, string]; sampleShadow: string; sampleRadius: string }> = {
  brutalist: { dots: ['#f59e0b', '#fafaf9', '#1c1917'], sampleShadow: '2px 2px 0 #000', sampleRadius: '2px' },
  neumorphic: { dots: ['#5c6bff', '#e4e6ec', '#ffffff'], sampleShadow: '3px 3px 6px #c9ccd3, -3px -3px 6px #fff', sampleRadius: '12px' },
  'soft-ui': { dots: ['#06b6d4', '#f1f5f9', '#0f172a'], sampleShadow: '0 4px 16px rgba(0,0,0,0.10)', sampleRadius: '12px' },
  saas: { dots: ['#6366f1', '#f8f8fa', '#18181b'], sampleShadow: '0 1px 3px rgba(0,0,0,0.08)', sampleRadius: '8px' },
  custom: { dots: ['#14b8a6', '#fafafa', '#18181b'], sampleShadow: '0 1px 3px rgba(0,0,0,0.08)', sampleRadius: '8px' },
};

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const fontOptions = [
  { value: 'Syne', label: 'Syne' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
];

interface AppearanceTabProps {
  theme: ThemeSettings;
  onChange: (theme: ThemeSettings) => void;
}

export default function AppearanceTab({ theme, onChange }: AppearanceTabProps) {
  const [customBrandColor, setCustomBrandColor] = useState(theme.brandColor ?? '#f59e0b');
  const brandColorValid = /^#[0-9a-fA-F]{6}$/.test(customBrandColor);

  // Resync when the server-loaded theme arrives after first render.
  useEffect(() => {
    if (theme.brandColor) setCustomBrandColor(theme.brandColor);
  }, [theme.brandColor]);

  /** Update form state AND apply to the live DOM instantly (save persists to server). */
  const updateTheme = (patch: Partial<ThemeSettings>) => {
    const next = { ...theme, ...patch };
    onChange(next);
    applyThemeToDOM(next);
  };

  const updateFont = (key: 'display' | 'body' | 'mono', value: string) => {
    updateTheme({ fonts: { ...theme.fonts, [key]: value } });
  };

  const handleBrandColorChange = (hex: string) => {
    setCustomBrandColor(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) updateTheme({ brandColor: hex });
  };

  const liveScale = generateColorScale(
    /^#[0-9a-fA-F]{6}$/.test(customBrandColor) ? customBrandColor : '#f59e0b',
  );

  return (
    <div className="space-y-8">
      {/* Theme Preset Selector */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="font-display text-lg font-bold text-[color:var(--color-surface-900)]">
            <PaintBucket className="mr-2 inline h-5 w-5" />
            Theme Preset
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Applies instantly for preview — Save settings to keep it
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themePresets.map((preset) => {
            const swatch = PRESET_SWATCHES[preset.value];
            const active = theme.preset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => updateTheme({ preset: preset.value })}
                aria-pressed={active}
                className={`rounded-[var(--radius-md)] border-[length:var(--bw-default)] p-4 text-left transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] ${
                  active
                    ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-button)]'
                    : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] hover:border-[color:var(--color-brand-500)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-sm font-bold text-[color:var(--color-surface-900)]">
                    {preset.label}
                  </div>
                  {active && <Check className="h-4 w-4 text-[color:var(--color-brand-600)]" />}
                </div>
                {/* Identity swatches + idiom sample */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-8 w-12 border border-black/10"
                    style={{
                      background: `linear-gradient(135deg, ${swatch.dots[0]} 0 45%, ${swatch.dots[1]} 45% 75%, ${swatch.dots[2]} 75% 100%)`,
                      borderRadius: swatch.sampleRadius,
                      boxShadow: swatch.sampleShadow,
                    }}
                  />
                  <span className="flex gap-1">
                    {swatch.dots.map((c) => (
                      <span
                        key={c}
                        aria-hidden
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                </div>
                <div className="font-body mt-2 text-xs text-[color:var(--color-surface-500)]">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Mode Toggle */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="font-display text-lg font-bold text-[color:var(--color-surface-900)]">
            <Monitor className="mr-2 inline h-5 w-5" />
            Color Mode
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Applies instantly for preview — Save settings to keep it
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => updateTheme({ mode: 'light' })}
            aria-pressed={theme.mode === 'light'}
            className={`font-display flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-5 py-3 text-sm font-bold transition-all ${
              theme.mode === 'light'
                ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-surface-900)] shadow-[var(--shadow-button)]'
                : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-surface-600)]'
            }`}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => updateTheme({ mode: 'dark' })}
            aria-pressed={theme.mode === 'dark'}
            className={`font-display flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-5 py-3 text-sm font-bold transition-all ${
              theme.mode === 'dark'
                ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-surface-900)] shadow-[var(--shadow-button)]'
                : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] text-[color:var(--color-surface-600)]'
            }`}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </section>

      {/* Custom Brand Color */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="font-display text-lg font-bold text-[color:var(--color-surface-900)]">
            Custom Brand Color
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Override the theme&apos;s default brand color with your own
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            label="Brand Color (hex)"
            value={customBrandColor}
            onChange={(e) => handleBrandColorChange(e.target.value)}
            placeholder="#f59e0b"
            className="max-w-[200px]"
            error={brandColorValid ? undefined : 'Use #RRGGBB format (e.g. #f59e0b)'}
            helperText={brandColorValid ? '6-digit hex, e.g. #f59e0b' : undefined}
          />
          <input
            type="color"
            aria-label="Pick brand color"
            value={brandColorValid ? customBrandColor : '#f59e0b'}
            onChange={(e) => handleBrandColorChange(e.target.value)}
            className="mt-6 h-10 w-12 cursor-pointer rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-1"
          />
          <div
            className="mt-6 h-12 w-12 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)]"
            style={{ backgroundColor: customBrandColor }}
          />
        </div>
        {/* Real generated 11-step scale */}
        <div className="mt-3 flex gap-1">
          {SCALE_STEPS.map((step, i) => (
            <div
              key={step}
              className="h-8 flex-1 rounded-sm border border-[color:var(--color-surface-200)]"
              style={{ backgroundColor: liveScale[i] }}
              title={`brand-${step}`}
            />
          ))}
        </div>
        <p className="text-xs text-[color:var(--color-surface-400)]">
          Exact 11-step scale (50 to 950) generated live — this is what gets applied on save.
        </p>
      </section>

      {/* Font Selectors */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="font-display text-lg font-bold text-[color:var(--color-surface-900)]">
            Typography
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Override theme fonts (leave empty for theme defaults)
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Display Font"
            value={theme.fonts?.display ?? ''}
            onChange={(e) => updateFont('display', e.target.value)}
            options={[{ value: '', label: 'Theme default' }, ...fontOptions]}
          />
          <Select
            label="Body Font"
            value={theme.fonts?.body ?? ''}
            onChange={(e) => updateFont('body', e.target.value)}
            options={[{ value: '', label: 'Theme default' }, ...fontOptions]}
          />
          <Select
            label="Mono Font"
            value={theme.fonts?.mono ?? ''}
            onChange={(e) => updateFont('mono', e.target.value)}
            options={[{ value: '', label: 'Theme default' }, ...fontOptions]}
          />
        </div>
      </section>

      {/* Live Preview Panel — real components, live theme */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="font-display text-lg font-bold text-[color:var(--color-surface-900)]">
            Live Preview
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-surface-500)]">
            Real components rendered in the currently applied theme
          </p>
        </div>
        <div className="space-y-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-50)] p-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary">
              Primary Button
            </Button>
            <Button type="button" variant="outline">
              Secondary Button
            </Button>
          </div>

          <Input label="Sample input" defaultValue="Sample input field" readOnly />

          <div className="flex flex-wrap gap-2">
            <StatusBadge variant="success" label="Active" />
            <StatusBadge variant="warning" label="Pending" />
            <StatusBadge variant="danger" label="Overdue" />
          </div>

          <div className="max-w-[220px]">
            <StatCard title="Total Tenants" value={42} variant="brand" />
          </div>
        </div>
      </section>
    </div>
  );
}
