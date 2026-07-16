/**
 * Drives shipped parseApiError entry point with Response-shaped errors
 * (same contract as ky HTTPError). Proves tenant lifecycle code messages
 * used by checkout/reinstate/transfer UI.
 */
import { describe, expect, it } from 'bun:test';
import { parseApiError } from './errorParser';

function httpError(status: number, body: unknown): { response: Response } {
  return {
    response: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

describe('parseApiError (tenant / room lifecycle codes)', () => {
  it('maps UNPAID_INVOICES to actionable checkout message', async () => {
    const parsed = await parseApiError(
      httpError(409, {
        success: false,
        error: { code: 'UNPAID_INVOICES', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('UNPAID_INVOICES');
    expect(parsed.message).toContain('unpaid invoices');
  });

  it('maps UNRESOLVED_PAYMENTS for checkout block', async () => {
    const parsed = await parseApiError(
      httpError(409, {
        success: false,
        error: { code: 'UNRESOLVED_PAYMENTS', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('UNRESOLVED_PAYMENTS');
    expect(parsed.message.toLowerCase()).toContain('payment');
  });

  it('maps BED_OCCUPIED for reinstate / transfer', async () => {
    const parsed = await parseApiError(
      httpError(409, {
        success: false,
        error: { code: 'BED_OCCUPIED', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('BED_OCCUPIED');
    expect(parsed.message.toLowerCase()).toContain('bed');
  });

  it('maps BEDS_OCCUPIED_ON_DOWNSIZE for room sharing edit', async () => {
    const parsed = await parseApiError(
      httpError(409, {
        success: false,
        error: { code: 'BEDS_OCCUPIED_ON_DOWNSIZE', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('BEDS_OCCUPIED_ON_DOWNSIZE');
    expect(parsed.message.toLowerCase()).toContain('sharing');
  });

  it('maps ACTIVE_TENANTS for room deactivate', async () => {
    const parsed = await parseApiError(
      httpError(409, {
        success: false,
        error: { code: 'ACTIVE_TENANTS', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('ACTIVE_TENANTS');
    expect(parsed.message.toLowerCase()).toContain('tenant');
  });

  it('maps LEAVE_NOT_PENDING for non-pending delete', async () => {
    const parsed = await parseApiError(
      httpError(422, {
        success: false,
        error: { code: 'LEAVE_NOT_PENDING', message: 'server raw' },
      }),
    );
    expect(parsed.code).toBe('LEAVE_NOT_PENDING');
    expect(parsed.message.toLowerCase()).toContain('pending');
  });

  it('falls back to backend message when code is unknown', async () => {
    const parsed = await parseApiError(
      httpError(400, {
        success: false,
        error: { code: 'SOME_NEW_CODE', message: 'Custom backend detail' },
      }),
    );
    expect(parsed.code).toBe('SOME_NEW_CODE');
    expect(parsed.message).toBe('Custom backend detail');
  });

  it('handles network TypeError', async () => {
    const parsed = await parseApiError(new TypeError('Failed to fetch'));
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.message.toLowerCase()).toContain('connect');
  });
});
