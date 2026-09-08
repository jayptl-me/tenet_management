/**
 * Shared helpers for the room photo-URL textareas (one URL per line).
 * Mirrors the API contract `photos: z.array(z.string().url())` so invalid
 * lines surface a line-numbered form error instead of a generic 400.
 */

/** Split pasted textarea value into non-empty trimmed URL lines. */
export function parsePhotoUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Returns the 1-based line number of the first non-http(s) URL, or -1 when all lines are valid.
 */
export function findInvalidPhotoLine(value: string | undefined): number {
  const lines = parsePhotoUrls(value);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    try {
      const url = new URL(line);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return i + 1;
    } catch {
      return i + 1;
    }
  }
  return -1;
}
