/**
 * Visitor cancel FSM via shipped Hono routes.
 * Uses MongoMemoryServer (single node) with long launchTimeout so cancel does
 * not depend on the suite-wide ReplSet (transactions not required for cancel).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Visitor } from '../models/visitor.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import visitorRoutes from '../routes/visitors.js';

type Json = Record<string, unknown>;
// Mongoose 9 create typings are strict; test seeds use loose docs (same pattern as beds.test).
type AnyDoc = Record<string, unknown>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (
  doc: AnyDoc,
) => Promise<{ _id: unknown }>;
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (
  doc: AnyDoc,
) => Promise<{ _id: unknown }>;

let memory: MongoMemoryServer | null = null;
let app: Hono;

async function jsonReq(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const res = await app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Json;
  try {
    parsed = text ? (JSON.parse(text) as Json) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

describe('Visitor cancel FSM (shipped POST /visitors/:id/cancel)', () => {
  beforeAll(async () => {
    // Prefer shared connection if suite already connected; else own memory server
    if (mongoose.connection.readyState !== 1) {
      memory = await MongoMemoryServer.create({
        instance: { launchTimeout: 120_000 },
      });
      await mongoose.connect(memory.getUri(), {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 30_000,
      });
    }

    app = new Hono();
    app.onError(globalErrorHandler);
    const api = new Hono().basePath('/api/v1');
    api.route('/visitors', visitorRoutes);
    app.route('/', api);

    await AppConfig.findOneAndUpdate(
      {},
      {
        $setOnInsert: {
          pgName: 'Cancel Test PG',
          address: { line1: '1 St', city: 'Pune', state: 'MH', pincode: '411001' },
          phone: '+919876543210',
          email: 'cancel@test.com',
          roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
        },
        $set: { 'features.visitorManagementEnabled': true },
      },
      { upsert: true },
    );
  }, 180_000);

  afterEach(async () => {
    await Promise.all([
      Visitor.deleteMany({}),
      Tenant.deleteMany({}),
      Room.deleteMany({}),
      Floor.deleteMany({}),
      User.deleteMany({ role: { $ne: 'admin' } }),
    ]);
  });

  afterAll(async () => {
    if (memory) {
      await mongoose.disconnect();
      await memory.stop();
      memory = null;
    }
  });

  it('cancels expected visitor; rejects cancel when arrived; rejects PUT status', async () => {
    const admin = await userCreate({
      name: 'Admin Cancel',
      email: `admin-cancel-${Date.now()}@test.com`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
    });
    const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });

    const floor = await floorCreate({
      floorNumber: 501 + (Date.now() % 40),
      label: `Cancel Floor ${Date.now()}`,
      totalRooms: 1,
    });
    const room = await roomCreate({
      roomNumber: `C${String(Date.now()).slice(-5)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const tUser = await userCreate({
      name: 'Cancel Tenant',
      email: `cancel-t-${Date.now()}@test.com`,
      phone: `+9197${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });
    const tenant = await tenantCreate({
      userId: tUser._id,
      roomId: room._id,
      bedId: 'A',
      moveInDate: new Date(),
      monthlyRent: 8000,
      isActive: true,
    });
    const visitor = await visitorCreate({
      tenantId: tenant._id,
      visitorName: 'Cancel Guest',
      visitorPhone: '+919812345678',
      purpose: 'Visit',
      expectedArrival: new Date(),
      status: 'expected',
    });
    const id = String(visitor._id);

    // Free PUT status must not cancel
    const put = await jsonReq('PUT', `/api/v1/visitors/${id}`, token, {
      visitorName: 'Cancel Guest',
      status: 'cancelled',
    });
    expect([400, 422]).toContain(put.status);
    expect((await Visitor.findById(id).lean())?.status).toBe('expected');

    // Real cancel path
    const cancel = await jsonReq('POST', `/api/v1/visitors/${id}/cancel`, token);
    expect(cancel.status).toBe(200);
    expect((cancel.body.data as { status?: string })?.status).toBe('cancelled');
    expect((await Visitor.findById(id).lean())?.status).toBe('cancelled');

    // Re-approve then arrive then cancel must 409
    const approve = await jsonReq('POST', `/api/v1/visitors/${id}/approve`, token);
    expect(approve.status).toBe(200);
    const arrive = await jsonReq('POST', `/api/v1/visitors/${id}/arrive`, token);
    expect(arrive.status).toBe(200);
    const cancelArrived = await jsonReq('POST', `/api/v1/visitors/${id}/cancel`, token);
    expect(cancelArrived.status).toBe(409);
    expect((await Visitor.findById(id).lean())?.status).toBe('arrived');
  }, 90_000);
});
