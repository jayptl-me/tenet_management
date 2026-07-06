import chroma from 'chroma-js';
import { env } from './env.js';

const scaleCache = new Map<string, Record<string, string>>();

export function generateColorScale(hex: string): Record<string, string> {
  const cached = scaleCache.get(hex);
  if (cached) return cached;

  try {
    const scale: Record<string, string> = {};
    const levels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    const baseColor = chroma(hex);
    const white = chroma('#FFFFFF');
    const black = chroma('#000000');

    for (const level of levels) {
      if (level < 500) {
        const ratio = (500 - level) / 450;
        scale[String(level)] = chroma.mix(baseColor, white, ratio, 'lab').hex();
      } else if (level === 500) {
        scale[String(level)] = hex;
      } else {
        const ratio = (level - 500) / 450;
        scale[String(level)] = chroma.mix(baseColor, black, ratio, 'lab').hex();
      }
    }

    scaleCache.set(hex, scale);
    setTimeout(() => scaleCache.delete(hex), env.CHROMA_CACHE_TTL * 1000);

    return scale;
  } catch {
    const fallback: Record<string, string> = {};
    for (const level of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      fallback[String(level)] = hex;
    }
    return fallback;
  }
}
