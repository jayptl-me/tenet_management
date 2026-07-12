/**
 * Normalize Indian mobile numbers to +91XXXXXXXXXX for API Zod schemas.
 * Accepts 10-digit local, 0-prefixed, 91-prefixed, or already +91 forms.
 */
export function normalizeInPhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('91')) {
    // rare garbage
    return `+${digits.slice(0, 12)}`;
  }
  if (input.trim().startsWith('+91') && digits.length >= 12) {
    return `+91${digits.slice(-10)}`;
  }
  return input.trim();
}

/** Zod-friendly refine: true when value is valid +91 mobile (after normalize). */
export function isValidInPhone(input: string | null | undefined): boolean {
  return /^\+91[6-9]\d{9}$/.test(normalizeInPhone(input));
}
