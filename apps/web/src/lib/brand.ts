import type { IBrandTokens } from '@pg/types/tokens';

/**
 * Applies brand color tokens from AppConfig to the document <html> element
 * as CSS custom properties. Call this after fetching /app-config on app startup.
 */
export function applyBrandTokens(tokens: IBrandTokens | null): void {
  if (!tokens || typeof document === 'undefined') return;

  const root = document.documentElement;

  // Apply brand color scale
  for (const [level, hex] of Object.entries(tokens.brandColorScale)) {
    root.style.setProperty(`--color-brand-${level}`, hex);
  }

  // Apply light surface color scale
  for (const [level, hex] of Object.entries(tokens.surfaceColorScale)) {
    root.style.setProperty(`--color-surface-${level}`, hex);
  }

  // App uses data-mode="dark"; also support .dark for compatibility
  const existing = document.getElementById('brand-dark-tokens');
  if (existing) existing.remove();

  const darkRules = Object.entries(tokens.surfaceColorScaleDark)
    .map(([level, hex]) => `  --color-surface-${level}: ${hex};`)
    .join('\n');

  const darkStyle = document.createElement('style');
  darkStyle.id = 'brand-dark-tokens';
  darkStyle.textContent = `[data-mode="dark"], .dark {\n${darkRules}\n}`;
  document.head.appendChild(darkStyle);
}

/**
 * Removes all dynamically applied brand tokens, resetting to CSS defaults.
 */
export function resetBrandTokens(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const levels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  for (const level of levels) {
    root.style.removeProperty(`--color-brand-${level}`);
    root.style.removeProperty(`--color-surface-${level}`);
  }

  document.getElementById('brand-dark-tokens')?.remove();
}
