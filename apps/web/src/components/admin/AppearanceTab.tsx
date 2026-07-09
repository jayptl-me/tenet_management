'use client';

import { useState } from 'react';
import { PaintBucket, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  { value: 'custom', label: 'Custom', description: 'Full control via custom tokens' },
];

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

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    onChange({ ...theme, ...patch });
  };

  const updateFont = (key: 'display' | 'body' | 'mono', value: string) => {
    onChange({
      ...theme,
      fonts: { ...(theme.fonts ?? {}), [key]: value },
    });
  };

  const handleBrandColorChange = (hex: string) => {
    setCustomBrandColor(hex);
    updateTheme({ brandColor: hex });
  };

  // Generate full 11-step brand color scale
  const generateColorScale = (hex: string): string[] => {
    try {
      // Parse hex to HSL
      let r: number, g: number, b: number;
      if (hex.startsWith('#')) {
        const h = hex.replace('#', '');
        r = parseInt(h.substring(0, 2), 16) / 255;
        g = parseInt(h.substring(2, 4), 16) / 255;
        b = parseInt(h.substring(4, 6), 16) / 255;
      } else {
        return Array(11).fill(hex);
      }

      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      let h = 0;
      if (max === r) h = ((g - b) / (max - min)) * 60;
      else if (max === g) h = (2 + (b - r) / (max - min)) * 60;
      else h = (4 + (r - g) / (max - min)) * 60;
      if (h < 0) h += 360;

      // Generate scale: 50 (lightest) to 950 (darkest)
      const lightMap = [92, 85, 78, 68, 58, 48, 38, 30, 22, 16, 10];
      return lightMap.map((light) => {
        return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${light}%)`;
      });
    } catch {
      return Array(11).fill(hex);
    }
  };

  const colorScale = generateColorScale(customBrandColor);

  return (
    <div className="space-y-8">
      {/* Theme Preset Selector */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="text-surface-900 font-display text-lg font-bold">
            <PaintBucket className="mr-2 inline h-5 w-5" />
            Theme Preset
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">
            Choose the visual style for the entire admin panel
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => updateTheme({ preset: preset.value })}
              className={`rounded-[var(--radius-md)] border-[length:var(--bw-default)] p-4 text-left transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] ${
                theme.preset === preset.value
                  ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-button)]'
                  : 'border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] hover:border-[color:var(--color-brand-500)]'
              }`}
            >
              <div className="text-surface-900 font-display text-sm font-bold">
                {preset.label}
              </div>
              <div className="text-surface-500 mt-1 font-body text-xs">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Mode Toggle */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="text-surface-900 font-display text-lg font-bold">
            <Monitor className="mr-2 inline h-5 w-5" />
            Color Mode
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">Light or dark mode appearance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => updateTheme({ mode: 'light' })}
            className={`flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-5 py-3 font-display text-sm font-bold transition-all ${
              theme.mode === 'light'
                ? 'text-surface-900 border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-button)]'
                : 'text-surface-600 border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]'
            }`}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            onClick={() => updateTheme({ mode: 'dark' })}
            className={`flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-default)] px-5 py-3 font-display text-sm font-bold transition-all ${
              theme.mode === 'dark'
                ? 'text-surface-900 border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-button)]'
                : 'text-surface-600 border-[color:var(--border-color)] bg-[color:var(--color-card-bg)]'
            }`}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </section>

      {/* Custom Brand Color */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="text-surface-900 font-display text-lg font-bold">
            Custom Brand Color
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">
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
          />
          <div
            className="mt-6 h-12 w-12 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)]"
            style={{ backgroundColor: customBrandColor }}
          />
        </div>
        {/* 11-step scale preview */}
        <div className="mt-3 flex gap-1">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step, i) => {
            const alpha = 1 - Math.abs(5 - i) * 0.15;
            return (
              <div
                key={step}
                className="border-[color:var(--color-surface-200)] h-8 flex-1 rounded-sm border"
                style={{ backgroundColor: customBrandColor, opacity: alpha }}
                title={`brand-${step}`}
              />
            );
          })}
        </div>
        <p className="text-surface-400 text-xs">
          Preview of 11-step scale (50→950). Full palette generation on save.
        </p>
      </section>

      {/* Font Selectors */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="text-surface-900 font-display text-lg font-bold">
            Typography
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">
            Override theme fonts (leave empty for theme defaults)
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-surface-700 mb-1 block font-body text-sm font-semibold">
              Display Font
            </label>
            <select
              value={theme.fonts?.display ?? ''}
              onChange={(e) => updateFont('display', e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 font-[family:var(--font-body)] text-sm text-[color:var(--color-text-primary)] focus:border-[color:var(--border-color-focus)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
            >
              <option value="">Theme default</option>
              {fontOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-surface-700 mb-1 block font-body text-sm font-semibold">
              Body Font
            </label>
            <select
              value={theme.fonts?.body ?? ''}
              onChange={(e) => updateFont('body', e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 font-[family:var(--font-body)] text-sm text-[color:var(--color-text-primary)] focus:border-[color:var(--border-color-focus)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
            >
              <option value="">Theme default</option>
              {fontOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-surface-700 mb-1 block font-body text-sm font-semibold">
              Mono Font
            </label>
            <select
              value={theme.fonts?.mono ?? ''}
              onChange={(e) => updateFont('mono', e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 font-[family:var(--font-body)] text-sm text-[color:var(--color-text-primary)] focus:border-[color:var(--border-color-focus)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
            >
              <option value="">Theme default</option>
              {fontOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Live Preview Panel */}
      <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
        <div>
          <h3 className="text-surface-900 font-display text-lg font-bold">
            Live Preview
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">
            Preview how components look in the selected theme
          </p>
        </div>
        <div className="space-y-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-50)] p-4">
          {/* Button previews */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="bg-brand-500 hover:translate-[var(--hover-lift)] inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-5 py-2.5 font-display text-sm font-semibold text-white shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]"
            >
              Primary Button
            </button>
            <button
              type="button"
              className="text-surface-900 inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-5 py-2.5 font-display text-sm font-semibold shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]"
            >
              Secondary Button
            </button>
            <button
              type="button"
              className="text-surface-700 inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-transparent bg-transparent px-5 py-2.5 font-display text-sm font-semibold"
            >
              Ghost Button
            </button>
          </div>

          {/* Input preview */}
          <input
            type="text"
            readOnly
            value="Sample input field"
            className="focus:border-brand-500 w-full max-w-xs rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-4 py-2.5 font-body text-sm focus:outline-none"
          />

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border-[length:var(--bw-default)] border-[color:var(--color-success-300)] bg-[color:var(--color-success-100)] px-3 py-1 font-display text-xs font-bold text-[color:var(--color-success-800)]">
              Active
            </span>
            <span className="inline-flex items-center rounded-full border-[length:var(--bw-default)] border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-100)] px-3 py-1 font-display text-xs font-bold text-[color:var(--color-warning-800)]">
              Pending
            </span>
            <span className="inline-flex items-center rounded-full border-[length:var(--bw-default)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-100)] px-3 py-1 font-display text-xs font-bold text-[color:var(--color-danger-800)]">
              Overdue
            </span>
          </div>

          {/* Stat card preview */}
          <div className="max-w-[200px] rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-card)]">
            <div className="text-surface-500 font-display text-xs font-bold uppercase tracking-wider">
              Total Tenants
            </div>
            <div className="text-surface-900 mt-1 font-display text-2xl font-extrabold">
              42
            </div>
            <div className="text-success-600 mt-1 font-body text-xs font-semibold">
              +3 this month
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
