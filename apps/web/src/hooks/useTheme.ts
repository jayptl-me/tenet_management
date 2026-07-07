'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { triggerThemeUpdate } from '@/themes/ThemeProvider';
import type { ThemeSettings, ThemePreset, ThemeMode } from '@pg/types';

const DEFAULT_THEME: ThemeSettings = {
  preset: 'brutalist',
  mode: 'light',
};

const THEME_STORAGE_KEY = 'tenet-theme';

function getSystemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadStoredTheme(): ThemeSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ThemeSettings;
  } catch {
    // ignore
  }
  return null;
}

function storeTheme(theme: ThemeSettings) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // ignore
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  const applyThemeConfig = useCallback(async () => {
    // Priority: localStorage → AppConfig API → system preference → default
    const stored = loadStoredTheme();
    if (stored) {
      setThemeState(stored);
      applyThemeToDOM(stored);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('app-config').json<{ success: boolean; data: { theme?: ThemeSettings } }>();
      const configTheme = res.data?.theme;
      if (configTheme) {
        // If mode is not explicitly set by user, use system preference
        if (!configTheme.mode || configTheme.mode === 'light') {
          configTheme.mode = getSystemMode();
        }
        setThemeState(configTheme);
        applyThemeToDOM(configTheme);
        storeTheme(configTheme);
      } else {
        const sysMode = getSystemMode();
        const t = { ...DEFAULT_THEME, mode: sysMode };
        setThemeState(t);
        applyThemeToDOM(t);
      }
    } catch {
      const sysMode = getSystemMode();
      const t = { ...DEFAULT_THEME, mode: sysMode };
      setThemeState(t);
      applyThemeToDOM(t);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    applyThemeConfig();

    // Listen for system color scheme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setThemeState((prev) => {
        const updated: ThemeSettings = { ...prev, mode: e.matches ? 'dark' : 'light' };
        applyThemeToDOM(updated);
        storeTheme(updated);
        return updated;
      });
    };
    mq.addEventListener('change', handler);

    // Listen for theme update from settings
    const handleUpdate = () => {
      applyThemeConfig();
    };
    window.addEventListener('theme-update', handleUpdate);

    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('theme-update', handleUpdate);
    };
  }, [applyThemeConfig]);

  const setTheme = useCallback((settings: ThemeSettings) => {
    applyThemeToDOM(settings);
    storeTheme(settings);
    setThemeState(settings);
    // Also persist to AppConfig API
    api.put('app-config', { json: { theme: settings } }).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => {
      const newMode: ThemeMode = prev.mode === 'dark' ? 'light' : 'dark';
      const updated: ThemeSettings = { ...prev, mode: newMode };
      applyThemeToDOM(updated);
      storeTheme(updated);
      api.put('app-config', { json: { theme: updated } }).catch(() => {});
      return updated;
    });
  }, []);

  const setPreset = useCallback((preset: ThemePreset) => {
    setThemeState((prev) => {
      const updated: ThemeSettings = { ...prev, preset };
      applyThemeToDOM(updated);
      storeTheme(updated);
      api.put('app-config', { json: { theme: updated } }).catch(() => {});
      return updated;
    });
  }, []);

  return { theme, loading, setTheme, toggleMode, setPreset };
}

export function applyThemeToDOM(settings: ThemeSettings) {
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.preset);
  root.setAttribute('data-mode', settings.mode);

  // Remove old custom token inline styles
  const oldStyle = root.getAttribute('style');
  if (oldStyle) {
    const kept = oldStyle
      .split(';')
      .filter((s) => !s.trim().startsWith('--color-brand-') && !s.trim().startsWith('--font-'))
      .join(';');
    if (kept) {
      root.setAttribute('style', kept);
    } else {
      root.removeAttribute('style');
    }
  }

  // Apply custom brand color
  if (settings.brandColor) {
    root.style.setProperty('--color-brand-500', settings.brandColor);
  }

  // Apply custom fonts
  if (settings.fonts?.display) {
    root.style.setProperty('--font-display', `'${settings.fonts.display}', sans-serif`);
  }
  if (settings.fonts?.body) {
    root.style.setProperty('--font-body', `'${settings.fonts.body}', sans-serif`);
  }
  if (settings.fonts?.mono) {
    root.style.setProperty('--font-mono', `'${settings.fonts.mono}', monospace`);
  }
}
