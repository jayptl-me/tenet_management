/**
 * Tenant model tests — validates tenant creation, bed consistency, and lifecycle.
 * Mongoose 9 compatibility: after create(), re-fetch via findById() for typed access.
 */
import { describe, it, expect } from 'vitest';
import { Tenant } from '../models/tenant.js';

type AnyDoc = Record<string, unknown>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

describe('Tenant Model', () => {
  const validTenantData: AnyDoc = {
    userId: '000000000000000000000010',
    roomId: '000000000000000000000020',
    bedId: 'A',
    moveInDate: new Date('2026-06-01'),
    monthlyRent: 8000,
    isActive: true,
  };

  it('should create a tenant with valid data', async () => {
    const raw = await tenantCreate({ ...validTenantData });
    const tenant = await Tenant.findById(raw._id as string);
    expect(tenant).not.toBeNull();
    expect(tenant?.bedId).toBe('A');
    expect(tenant?.monthlyRent).toBe(8000);
    expect(tenant?.isActive).toBe(true);
    expect(tenant?.depositPaid).toBe(0);
  });

  it('should reject tenant without userId', async () => {
    const data = { ...validTenantData, userId: undefined };
    await expect(tenantCreate(data)).rejects.toThrow();
  });

  it('should reject invalid bedId', async () => {
    const data = { ...validTenantData, bedId: 'E' };
    await expect(tenantCreate(data)).rejects.toThrow();
  });

  it('should reject rent below minimum', async () => {
    const data = { ...validTenantData, monthlyRent: 500 };
    await expect(tenantCreate(data)).rejects.toThrow();
  });

  it('should allow checking out a tenant', async () => {
    const raw = await tenantCreate({ ...validTenantData });
    const tenant = await Tenant.findById(raw._id as string);
    expect(tenant).not.toBeNull();
    if (tenant) {
      tenant.isActive = false;
      tenant.moveOutDate = new Date();
      await tenant.save();
    }

    const found = await Tenant.findById(raw._id as string).lean();
    expect(found?.isActive).toBe(false);
    expect(found?.moveOutDate).not.toBeNull();
  });

  it('should enforce unique userId constraint', async () => {
    const data = { ...validTenantData, userId: '000000000000000000000099' };
    await tenantCreate(data);
    await expect(tenantCreate(data)).rejects.toThrow();
  });
});
