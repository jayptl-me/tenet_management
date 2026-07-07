'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { ThemeSettings } from '@pg/types';

const DEFAULT_THEME: ThemeSettings = {
  preset: 'brutalist',
  mode: 'light',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const prevThemeRef = useRef<string | null>(null);

  const applyTheme = useCallback((settings: ThemeSettings) => {
    const root = document.documentElement;
    const themeKey = `${settings.preset}-${settings.mode}-${settings.brandColor ?? ''}`;
    // Skip if same as current
    if (prevThemeRef.current === themeKey) return;
    prevThemeRef.current = themeKey;

    // Set theme preset and mode — CSS cascade uses [data-theme=X][data-mode=Y]
    root.setAttribute('data-theme', settings.preset);
    root.setAttribute('data-mode', settings.mode);

    // Remove old custom token inline styles
    const oldStyle = root.getAttribute('style');
    if (oldStyle) {
      const kept = oldStyle
        .split(';')
        .filter((s) => !s.trim().startsWith('--color-brand-') && !s.trim().startsWith('--font-'))
        .join(';');
      root.setAttribute('style', kept);
    }

    // Apply custom brand color overrides as inline styles
    if (settings.brandColor) {
      root.style.setProperty('--color-brand-500', settings.brandColor);
    }

    // Apply custom font overrides
    if (settings.fonts?.display) {
      root.style.setProperty(
        '--font-display',
        `'${settings.fonts.display}', sans-serif`,
      );
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
