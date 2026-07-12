/**
 * Visitor lifecycle tests -- validates the transition state machine.
 * Tests the full lifecycle: expected -> arrived -> departed,
 * re-approval from cancelled, and timestamp tracking.
 * Mongoose 9 compatibility: after create(), re-fetch via findById() for typed access.
 */
import { describe, it, expect } from 'vitest';
import { Visitor } from '../models/visitor.js';

type AnyDoc = Record<string, unknown>;
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

describe('Visitor Lifecycle State Machine', () => {
  const baseVisitorData: AnyDoc = {
    tenantId: '000000000000000000000001',
    visitorName: 'Ravi Kumar',
    visitorPhone: '+919876543210',
    purpose: 'Family visit',
    expectedArrival: new Date('2026-07-15T10:00:00Z'),
    status: 'expected',
  };

  it('should transition expected -> arrived -> departed', async () => {
    const raw = await visitorCreate({ ...baseVisitorData });
    const visitor = await Visitor.findById(raw._id as string);
    expect(visitor).not.toBeNull();
    expect(visitor!.status).toBe('expected');

    // expected -> arrived
    visitor!.status = 'arrived';
    visitor!.actualArrival = new Date('2026-07-15T10:30:00Z');
    await visitor!.save();

    const arrived = await Visitor.findById(raw._id as string);
    expect(arrived!.status).toBe('arrived');
    expect(arrived!.actualArrival).not.toBeNull();

    // arrived -> departed
    arrived!.status = 'departed';
    arrived!.actualDeparture = new Date('2026-07-15T14:00:00Z');
    await arrived!.save();

    const departed = await Visitor.findById(raw._id as string);
    expect(departed!.status).toBe('departed');
    expect(departed!.actualDeparture).not.toBeNull();
  });

  it('should set actualArrival when arriving', async () => {
    const raw = await visitorCreate({ ...baseVisitorData });
    const arrivalTime = new Date('2026-07-15T11:00:00Z');

    await Visitor.findByIdAndUpdate(raw._id as string, {
      status: 'arrived',
      actualArrival: arrivalTime,
    });

    const found = await Visitor.findById(raw._id as string);
    expect(found!.status).toBe('arrived');
    expect(found!.actualArrival).toEqual(arrivalTime);
    expect(found!.actualDeparture).toBeNull();
  });

  it('should set actualDeparture when departing', async () => {
    const raw = await visitorCreate({
      ...baseVisitorData,
      status: 'arrived',
      actualArrival: new Date('2026-07-15T10:30:00Z'),
    });

    const departureTime = new Date('2026-07-15T15:00:00Z');
    await Visitor.findByIdAndUpdate(raw._id as string, {
      status: 'departed',
      actualDeparture: departureTime,
    });

    const found = await Visitor.findById(raw._id as string);
    expect(found!.status).toBe('departed');
    expect(found!.actualDeparture).toEqual(departureTime);
  });

  it('should allow re-approve: cancelled -> expected', async () => {
    const raw = await visitorCreate({
      ...baseVisitorData,
      status: 'cancelled',
    });

    const visitor = await Visitor.findById(raw._id as string);
    expect(visitor!.status).toBe('cancelled');

    // Re-approve: cancelled -> expected
    visitor!.status = 'expected';
    await visitor!.save();

    const reApproved = await Visitor.findById(raw._id as string);
    expect(reApproved!.status).toBe('expected');
  });

  it('should preserve actualArrival and actualDeparture through full lifecycle', async () => {
    const arrivalTime = new Date('2026-07-15T10:30:00Z');
    const departureTime = new Date('2026-07-15T14:00:00Z');

    const raw = await visitorCreate({ ...baseVisitorData });
    const visitor = await Visitor.findById(raw._id as string);

    // expected -> arrived
    visitor!.status = 'arrived';
    visitor!.actualArrival = arrivalTime;
    await visitor!.save();

    // arrived -> departed
    visitor!.status = 'departed';
    visitor!.actualDeparture = departureTime;
    await visitor!.save();

    const final = await Visitor.findById(raw._id as string);
    expect(final!.status).toBe('departed');
    expect(final!.actualArrival).toEqual(arrivalTime);
    expect(final!.actualDeparture).toEqual(departureTime);
  });
});