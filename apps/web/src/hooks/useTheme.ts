'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { triggerThemeUpdate } from '@/themes/ThemeProvider';
import type { ThemeSettings, ThemePreset, ThemeMode } from '@pg/types';

const DEFAULT_THEME: ThemeSettings = {
  preset: 'saas',
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

function readThemeFromDOM(): ThemeSettings {
  const root = document.documentElement;
  const preset = (root.getAttribute('data-theme') as ThemePreset) ?? 'saas';
  const mode = (root.getAttribute('data-mode') as ThemeMode) ?? 'light';
  return { preset, mode };
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  // Bootstrap: read initial state from DOM (set by ThemeProvider before hydration)
  useEffect(() => {
    const initial = readThemeFromDOM();
    setThemeState(initial);
    setLoading(false);
  }, []);

  // Listen for theme-update events fired by ThemeProvider after settings save
  useEffect(() => {
    const handleUpdate = () => {
      const updated = readThemeFromDOM();
      setThemeState(updated);
    };
    window.addEventListener('theme-update', handleUpdate);
    return () => window.removeEventListener('theme-update', handleUpdate);
  }, []);

  const applyAndPersist = useCallback((settings: ThemeSettings) => {
    applyThemeToDOM(settings);
    storeTheme(settings);
    setThemeState(settings);
    api.put('app-config', { json: { theme: settings } }).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    const root = document.documentElement;
    const currentMode = root.getAttribute('data-mode') as ThemeMode ?? 'light';
    const currentPreset = root.getAttribute('data-theme') as ThemePreset ?? 'saas';
    const updated: ThemeSettings = { preset: currentPreset, mode: currentMode === 'dark' ? 'light' : 'dark' };
    applyAndPersist(updated);
  }, [applyAndPersist]);

  const setPreset = useCallback((preset: ThemePreset) => {
    const root = document.documentElement;
    const currentMode = root.getAttribute('data-mode') as ThemeMode ?? 'light';
    const updated: ThemeSettings = { preset, mode: currentMode };
    applyAndPersist(updated);
  }, [applyAndPersist]);

  const setTheme = useCallback((settings: ThemeSettings) => {
    applyAndPersist(settings);
  }, [applyAndPersist]);

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
