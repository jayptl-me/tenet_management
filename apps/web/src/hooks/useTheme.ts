'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { applyColorScaleToDOM, removeCustomStylesFromDOM } from '@/lib/colorScale';
import type { ThemeSettings, ThemePreset, ThemeMode } from '@pg/types';

const DEFAULT_THEME: ThemeSettings = {
  preset: 'saas',
  mode: 'light',
};

const THEME_STORAGE_KEY = 'tenet-theme';

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
    const currentMode = (root.getAttribute('data-mode') as ThemeMode) ?? 'light';
    const currentPreset = (root.getAttribute('data-theme') as ThemePreset) ?? 'saas';
    // Preserve any stored brandColor and fonts from localStorage
    const stored = loadStoredTheme();
    const updated: ThemeSettings = {
      preset: currentPreset,
      mode: currentMode === 'dark' ? 'light' : 'dark',
      brandColor: stored?.brandColor,
      fonts: stored?.fonts,
    };
    applyAndPersist(updated);
  }, [applyAndPersist]);

  const setPreset = useCallback(
    (preset: ThemePreset) => {
      const root = document.documentElement;
      const currentMode = (root.getAttribute('data-mode') as ThemeMode) ?? 'light';
      const stored = loadStoredTheme();
      const updated: ThemeSettings = {
        preset,
        mode: currentMode,
        brandColor: stored?.brandColor,
        fonts: stored?.fonts,
      };
      applyAndPersist(updated);
    },
    [applyAndPersist],
  );

  const setTheme = useCallback(
    (settings: ThemeSettings) => {
      applyAndPersist(settings);
    },
    [applyAndPersist],
  );

  return { theme, loading, setTheme, toggleMode, setPreset };
}

const MONO_FONT_FAMILIES: readonly string[] = ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'];

function getFontFallback(family: string): 'monospace' | 'sans-serif' {
  return MONO_FONT_FAMILIES.includes(family) ? 'monospace' : 'sans-serif';
}

export function applyThemeToDOM(settings: ThemeSettings) {
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.preset);
  root.setAttribute('data-mode', settings.mode);

  // Remove old custom token inline styles via shared utility
  removeCustomStylesFromDOM(root);

  // Apply custom brand color as full 11-step scale (matches ThemeProvider)
  if (settings.brandColor) {
    applyColorScaleToDOM(settings.brandColor, root);
  }

  // Apply custom fonts (mono families get monospace fallback, others sans-serif)
  if (settings.fonts?.display) {
    root.style.setProperty(
      '--font-display',
      `'${settings.fonts.display}', ${getFontFallback(settings.fonts.display)}`,
    );
  }
  if (settings.fonts?.body) {
    root.style.setProperty(
      '--font-body',
      `'${settings.fonts.body}', ${getFontFallback(settings.fonts.body)}`,
    );
  }
  if (settings.fonts?.mono) {
    root.style.setProperty(
      '--font-mono',
      `'${settings.fonts.mono}', ${getFontFallback(settings.fonts.mono)}`,
    );
  }
}
