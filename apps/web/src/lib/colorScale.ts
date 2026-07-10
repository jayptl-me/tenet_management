/**
 * Shared color scale generation utility.
 * Used by both ThemeProvider and useTheme to produce identical 11-step scales.
 */

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const LIGHT_LEVELS = [92, 85, 78, 68, 58, 48, 38, 30, 22, 16, 10];

/**
 * Generate an 11-step color scale from a single hex color.
 * Returns an array of HSL strings mapped to [50, 100, ..., 950].
 */
export function generateColorScale(hex: string): string[] {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    let hDeg = 0;
    if (max === r) hDeg = ((g - b) / (max - min)) * 60;
    else if (max === g) hDeg = (2 + (b - r) / (max - min)) * 60;
    else hDeg = (4 + (r - g) / (max - min)) * 60;
    if (hDeg < 0) hDeg += 360;

    return LIGHT_LEVELS.map(
      (light) => `hsl(${Math.round(hDeg)}, ${Math.round(s * 100)}%, ${light}%)`,
    );
  } catch {
    return Array(11).fill(hex);
  }
}

/**
 * Apply a full 11-step color scale to the document root as inline styles.
 * Also removes any previously set inline brand color steps.
 */
export function applyColorScaleToDOM(
  hex: string,
  root: HTMLElement = document.documentElement,
): void {
  // Remove old custom token inline styles first
  STEPS.forEach((step) => root.style.removeProperty(`--color-brand-${step}`));

  const scale = generateColorScale(hex);
  scale.forEach((color, i) => {
    const step = STEPS[i];
    if (step !== undefined) {
      root.style.setProperty(`--color-brand-${step}`, color);
    }
  });
}

/**
 * Remove all custom brand color and font inline styles from the document root.
 */
export function removeCustomStylesFromDOM(root: HTMLElement = document.documentElement): void {
  STEPS.forEach((step) => root.style.removeProperty(`--color-brand-${step}`));
  root.style.removeProperty('--font-display');
  root.style.removeProperty('--font-body');
  root.style.removeProperty('--font-mono');
}
