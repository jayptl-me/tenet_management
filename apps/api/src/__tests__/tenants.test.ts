/**
 * Tenant model tests — validates tenant creation, bed consistency, and lifecycle.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Tenant } from '../models/tenant.js';

describe('Tenant Model', () => {
  const validTenantData = {
    userId: new mongoose.Types.ObjectId(),
    roomId: new mongoose.Types.ObjectId(),
    bedId: 'A' as const,
    moveInDate: new Date('2026-06-01'),
    monthlyRent: 8000,
    isActive: true,
  };

  it('should create a tenant with valid data', async () => {
    const tenant = await Tenant.create(validTenantData);
    expect(tenant.bedId).toBe('A');
    expect(tenant.monthlyRent).toBe(8000);
    expect(tenant.isActive).toBe(true);
    expect(tenant.depositPaid).toBe(0);
  });

  it('should reject tenant without userId', async () => {
    const data = { ...validTenantData, userId: undefined };
    await expect(Tenant.create(data)).rejects.toThrow();
  });

  it('should reject invalid bedId', async () => {
    const data = { ...validTenantData, bedId: 'E' };
    await expect(Tenant.create(data)).rejects.toThrow();
  });

  it('should reject rent below minimum', async () => {
    const data = { ...validTenantData, monthlyRent: 500 };
    await expect(Tenant.create(data)).rejects.toThrow();
  });

  it('should allow checking out a tenant', async () => {
    const tenant = await Tenant.create(validTenantData);
    tenant.isActive = false;
    tenant.moveOutDate = new Date();
    await tenant.save();

    const found = await Tenant.findById(tenant._id).lean();
    expect(found?.isActive).toBe(false);
    expect(found?.moveOutDate).not.toBeNull();
  });

  it('should enforce unique userId constraint', async () => {
    await Tenant.create(validTenantData);
    await expect(Tenant.create(validTenantData)).rejects.toThrow();
  });
});
