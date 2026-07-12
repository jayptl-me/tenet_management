/**
 * Visitor CRUD tests — validates the full visitor lifecycle.
 * Mongoose 9 compatibility: after create(), re-fetch via findById() for typed access.
 */
import { describe, it, expect } from 'vitest';
import { Visitor } from '../models/visitor.js';

type AnyDoc = Record<string, unknown>;
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

describe('Visitor Model', () => {
  const validVisitorData: AnyDoc = {
    tenantId: '000000000000000000000001',
    visitorName: 'Ravi Kumar',
    visitorPhone: '+919876543210',
    purpose: 'Family visit',
    expectedArrival: new Date('2026-07-15T10:00:00Z'),
    status: 'expected',
  };

  it('should create a visitor with valid data', async () => {
    const raw = await visitorCreate({ ...validVisitorData });
    const visitor = await Visitor.findById(raw._id as string);
    expect(visitor).not.toBeNull();
    expect(visitor!.visitorName).toBe('Ravi Kumar');
    expect(visitor!.visitorPhone).toBe('+919876543210');
    expect(visitor!.status).toBe('expected');
    expect(visitor!.actualArrival).toBeNull();
    expect(visitor!.actualDeparture).toBeNull();
  });

  it('should reject visitor without tenantId', async () => {
    const data = { ...validVisitorData, tenantId: undefined };
    await expect(visitorCreate(data)).rejects.toThrow();
  });

  it('should reject invalid phone number', async () => {
    const data = { ...validVisitorData, visitorPhone: '12345' };
    await expect(visitorCreate(data)).rejects.toThrow();
  });

  it('should reject invalid status enum', async () => {
    const data = { ...validVisitorData, status: 'invalid_status' };
    await expect(visitorCreate(data)).rejects.toThrow();
  });

  it('should allow arriving a visitor', async () => {
    const raw = await visitorCreate({ ...validVisitorData });
    const visitor = await Visitor.findById(raw._id as string);
    expect(visitor).not.toBeNull();
    if (visitor) {
      visitor.status = 'arrived';
      visitor.actualArrival = new Date();
      await visitor.save();
    }

    const found = await Visitor.findById(raw._id as string);
    expect(found?.status).toBe('arrived');
    expect(found?.actualArrival).not.toBeNull();
  });

  it('should allow departing a visitor', async () => {
    const raw = await visitorCreate({
      ...validVisitorData,
      actualArrival: new Date(),
      status: 'arrived',
    });
    const visitor = await Visitor.findById(raw._id as string);
    expect(visitor).not.toBeNull();
    if (visitor) {
      visitor.status = 'departed';
      visitor.actualDeparture = new Date();
      await visitor.save();
    }

    const found = await Visitor.findById(raw._id as string);
    expect(found?.status).toBe('departed');
    expect(found?.actualDeparture).not.toBeNull();
  });

  it('should alias visitorName -> name in toJSON', () => {
    const visitor = new Visitor(validVisitorData as Record<string, unknown>);
    const json = visitor.toJSON() as unknown as Record<string, unknown>;
    expect(json.name).toBe('Ravi Kumar');
    expect(json.phone).toBe('+919876543210');
    expect(json.visitorName).toBeUndefined();
    expect(json.visitorPhone).toBeUndefined();
  });

  it('should delete a visitor', async () => {
    const raw = await visitorCreate({ ...validVisitorData });
    await Visitor.findByIdAndDelete(raw._id as string);
    const found = await Visitor.findById(raw._id as string);
    expect(found).toBeNull();
  });
});
