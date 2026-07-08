'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { removeCustomStylesFromDOM, applyColorScaleToDOM } from '@/lib/colorScale';
import type { ThemeSettings } from '@pg/types';

const DEFAULT_THEME: ThemeSettings = {
  preset: 'saas',
  mode: 'light',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const prevThemeRef = useRef<string | null>(null);

  // Bootstrap from localStorage immediately to prevent SSR flash
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tenet-theme');
      if (stored) {
        const settings = JSON.parse(stored) as ThemeSettings;
        const root = document.documentElement;
        root.setAttribute('data-theme', settings.preset);
        root.setAttribute('data-mode', settings.mode);
        if (settings.brandColor) {
          root.style.setProperty('--color-brand-500', settings.brandColor);
        }
        prevThemeRef.current = `${settings.preset}-${settings.mode}-${settings.brandColor ?? ''}`;
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const applyTheme = useCallback((settings: ThemeSettings) => {
    const root = document.documentElement;
    const themeKey = `${settings.preset}-${settings.mode}-${settings.brandColor ?? ''}`;
    // Skip if same as current
    if (prevThemeRef.current === themeKey) return;
    prevThemeRef.current = themeKey;

    // Set theme preset and mode — CSS cascade uses [data-theme=X][data-mode=Y]
    root.setAttribute('data-theme', settings.preset);
    root.setAttribute('data-mode', settings.mode);

    // Remove old custom token inline styles via shared utility
    removeCustomStylesFromDOM(root);

    // Apply custom brand color as full 11-step scale (via shared utility)
    if (settings.brandColor) {
      applyColorScaleToDOM(settings.brandColor, root);
    }

    // Apply custom font overrides
    if (settings.fonts?.display) {
      root.style.setProperty('--font-display', `'${settings.fonts.display}', sans-serif`);
    }
    if (settings.fonts?.body) {
      root.style.setProperty('--font-body', `'${settings.fonts.body}', sans-serif`);
    }
    if (settings.fonts?.mono) {
      root.style.setProperty('--font-mono', `'${settings.fonts.mono}', monospace`);
    }
  }, []);

  const loadTheme = useCallback(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: { theme?: ThemeSettings } }>()
      .then((res) => {
        const theme = res.data?.theme ?? DEFAULT_THEME;
        applyTheme(theme);
      })
      .catch(() => {
        applyTheme(DEFAULT_THEME);
      });
  }, [applyTheme]);

  useEffect(() => {
    setMounted(true);
    loadTheme();

    // Listen for theme fetch trigger (set after settings save)
    const handleThemeUpdate = () => {
      loadTheme();
    };
    window.addEventListener('theme-update', handleThemeUpdate);
    return () => window.removeEventListener('theme-update', handleThemeUpdate);
  }, [loadTheme]);

  return <>{children}</>;
}

/**
 * Call this from the settings page after saving theme to force ThemeProvider to re-fetch.
 */
export function triggerThemeUpdate() {
  window.dispatchEvent(new CustomEvent('theme-update'));
}
