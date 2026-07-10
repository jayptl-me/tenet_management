/**
 * Visitor CRUD tests — validates the full visitor lifecycle.
 * This was the P0 broken module; these tests ensure it stays fixed.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Visitor } from '../models/visitor.js';

describe('Visitor Model', () => {
  const validVisitorData = {
    tenantId: new mongoose.Types.ObjectId(),
    visitorName: 'Ravi Kumar',
    visitorPhone: '+919876543210',
    purpose: 'Family visit',
    expectedArrival: new Date('2026-07-15T10:00:00Z'),
    status: 'expected' as const,
  };

  it('should create a visitor with valid data', async () => {
    const visitor = await Visitor.create(validVisitorData);
    expect(visitor.visitorName).toBe('Ravi Kumar');
    expect(visitor.visitorPhone).toBe('+919876543210');
    expect(visitor.status).toBe('expected');
    expect(visitor.actualArrival).toBeNull();
    expect(visitor.actualDeparture).toBeNull();
  });

  it('should reject visitor without tenantId', async () => {
    const data = { ...validVisitorData, tenantId: undefined };
    await expect(Visitor.create(data)).rejects.toThrow();
  });

  it('should reject invalid phone number', async () => {
    const data = { ...validVisitorData, visitorPhone: '12345' };
    await expect(Visitor.create(data)).rejects.toThrow();
  });

  it('should reject invalid status enum', async () => {
    const data = { ...validVisitorData, status: 'invalid_status' };
    await expect(Visitor.create(data)).rejects.toThrow();
  });

  it('should allow arriving a visitor', async () => {
    const visitor = await Visitor.create(validVisitorData);
    visitor.status = 'arrived';
    visitor.actualArrival = new Date();
    await visitor.save();

    const found = await Visitor.findById(visitor._id);
    expect(found?.status).toBe('arrived');
    expect(found?.actualArrival).not.toBeNull();
  });

  it('should allow departing a visitor', async () => {
    const visitor = await Visitor.create({
      ...validVisitorData,
      actualArrival: new Date(),
      status: 'arrived',
    });
    visitor.status = 'departed';
    visitor.actualDeparture = new Date();
    await visitor.save();

    const found = await Visitor.findById(visitor._id);
    expect(found?.status).toBe('departed');
    expect(found?.actualDeparture).not.toBeNull();
  });

  it('should alias visitorName -> name in toJSON', () => {
    const visitor = new Visitor(validVisitorData);
    const json = visitor.toJSON() as Record<string, unknown>;
    expect(json.name).toBe('Ravi Kumar');
    expect(json.phone).toBe('+919876543210');
    expect(json.visitorName).toBeUndefined();
    expect(json.visitorPhone).toBeUndefined();
  });

  it('should delete a visitor', async () => {
    const visitor = await Visitor.create(validVisitorData);
    await Visitor.findByIdAndDelete(visitor._id);
    const found = await Visitor.findById(visitor._id);
    expect(found).toBeNull();
  });
});
