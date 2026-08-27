import { describe, it, expect } from 'bun:test';
import { normalizeInPhone, isValidInPhone } from './phone.js';

describe('normalizeInPhone', () => {
  it('normalizes 10-digit number to +91', () => {
    expect(normalizeInPhone('9876543210')).toBe('+919876543210');
    expect(normalizeInPhone('8123456789')).toBe('+918123456789');
    expect(normalizeInPhone('7000000000')).toBe('+917000000000');
    expect(normalizeInPhone('6999999999')).toBe('+916999999999');
  });

  it('normalizes 0-prefixed 11-digit number', () => {
    expect(normalizeInPhone('09876543210')).toBe('+919876543210');
  });

  it('normalizes 91-prefixed 12-digit number', () => {
    expect(normalizeInPhone('919876543210')).toBe('+919876543210');
  });

  it('preserves valid +91 format', () => {
    expect(normalizeInPhone('+919876543210')).toBe('+919876543210');
  });

  it('handles formatted strings with spaces and dashes', () => {
    expect(normalizeInPhone('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeInPhone('98765 43210')).toBe('+919876543210');
  });

  it('handles null, undefined, or empty string gracefully', () => {
    expect(normalizeInPhone(null)).toBe('');
    expect(normalizeInPhone(undefined)).toBe('');
    expect(normalizeInPhone('')).toBe('');
  });
});

describe('isValidInPhone', () => {
  it('validates correct Indian phone numbers', () => {
    expect(isValidInPhone('9876543210')).toBe(true);
    expect(isValidInPhone('09876543210')).toBe(true);
    expect(isValidInPhone('919876543210')).toBe(true);
    expect(isValidInPhone('+919876543210')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidInPhone('1234567890')).toBe(false);
    expect(isValidInPhone('5876543210')).toBe(false);
    expect(isValidInPhone('98765')).toBe(false);
    expect(isValidInPhone(null)).toBe(false);
    expect(isValidInPhone('')).toBe(false);
  });
});
