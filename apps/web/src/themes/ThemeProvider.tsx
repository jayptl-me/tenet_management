'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ThemeSettings } from '@pg/types';

interface AppConfigData {
  theme?: ThemeSettings;
}

const DEFAULT_THEME: ThemeSettings = {
  preset: 'brutalist',
  mode: 'light',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((settings: ThemeSettings) => {
    const root = document.documentElement;

    // Set theme preset
    root.setAttribute('data-theme', settings.preset);

    // Set mode
    root.setAttribute('data-mode', settings.mode);

    // Apply custom brand color overrides (inline styles = highest CSS specificity)
    if (settings.customTokens) {
      for (const [key, value] of Object.entries(settings.customTokens)) {
        root.style.setProperty(key, value ?? null);
      }
    }
  }, []);

  const loadTheme = useCallback(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: AppConfigData }>()
      .then((res) => {
        const theme = res.data?.theme ?? DEFAULT_THEME;
        applyTheme(theme);
      })
      .catch(() => {
        applyTheme(DEFAULT_THEME);
      });
  }, [applyTheme]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setMounted(true);
        loadTheme();
      }
    });
    return () => {
      active = false;
    };
  }, [loadTheme]);

  // Prevent flash of unstyled content — render nothing until theme is applied
  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
