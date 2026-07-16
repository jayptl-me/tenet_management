/**
 * P1 lifecycle integrity tests — drives REAL Hono routes (not re-implementations).
 * Covers Queue A+B: floor ServiceStatus seed, isPerFloor reject, notice targeting,
 * visitor PUT FSM, tenant delete guardian Users, active bed uniqueness.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Guardian } from '../models/guardian.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { NoticePost } from '../models/noticePost.js';
import { Visitor } from '../models/visitor.js';
import { Complaint } from '../models/complaint.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';

import floorRoutes from '../routes/floors.js';
import serviceRoutes from '../routes/services.js';
import noticeRoutes from '../routes/notices.js';
import visitorRoutes from '../routes/visitors.js';
import tenantRoutes from '../routes/tenants.js';
import complaintRoutes from '../routes/complaints.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

// Mongoose 9 create typing workaround (same as beds.test.ts / module-http-e2e)
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const guardianCreate = Guardian.create.bind(Guardian) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const noticeCreate = NoticePost.create.bind(NoticePost) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const complaintCreate = Complaint.create.bind(Complaint) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const configCreate = AppConfig.create.bind(AppConfig) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/floors', floorRoutes);
  api.route('/services', serviceRoutes);
  api.route('/notices', noticeRoutes);
  api.route('/visitors', visitorRoutes);
  api.route('/tenants', tenantRoutes);
  api.route('/complaints', complaintRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

async function ensureAppConfig() {
  const existing = await AppConfig.findOne().lean();
  if (existing) return existing;
  return configCreate({
    pgName: 'Test PG Lifecycle',
    address: {
      line1: '1 Test St',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
    },
    phone: '+919876543210',
    email: 'test@example.com',
    roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
    features: {
      noticeBoardEnabled: true,
      visitorManagementEnabled: true,
      guardianPortalEnabled: true,
      attendanceEnabled: true,
      laundryEnabled: true,
      messFeedbackEnabled: true,
    },
  });
}

async function makeAdminToken() {
  const admin = await userCreate({
    name: 'Admin LC',
    email: `admin-lc-${Date.now()}@test.com`,
    phone: `+9198${String(Date.now()).slice(-8)}`,
    passwordHash: 'hash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
  return { admin, token };
}

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
  const parsed = (await res.json()) as Json;
  return { status: res.status, body: parsed };
}

describe('P1 lifecycle integrity (shipped routes)', () => {
  // setup.ts clears collections afterEach — reseed AppConfig every test
  beforeEach(async () => {
    await ensureAppConfig();
  });

  it('FL-1/SV-2: floor create seeds ServiceStatus for isPerFloor amenity defs', async () => {
    const { token } = await makeAdminToken();
    const n = Date.now() % 100000;
    const res = await jsonReq('POST', '/api/v1/floors', token, {
      floorNumber: 700 + (n % 50),
      label: `LC Floor ${n}`,
      totalRooms: 4,
    });
    expect(res.status).toBe(201);
    const floor = res.body.data as { id?: string; _id?: string };
    const floorId = String(floor.id ?? floor._id);
    expect(floorId).toBeTruthy();

    const config = await AppConfig.findOne().select('amenityDefinitions').lean();
    const perFloorKeys = (config?.amenityDefinitions ?? [])
      .filter((d) => d.isPerFloor)
      .map((d) => d.key);
    expect(perFloorKeys.length).toBeGreaterThan(0);

    const statuses = await ServiceStatus.find({ floorId } as Record<string, unknown>).lean();
    const seededTypes = statuses.map((s) => s.serviceType).sort();
    expect(seededTypes).toEqual([...perFloorKeys].sort());
    // Room-only keys must not be seeded
    expect(seededTypes).not.toContain('fan');
    expect(seededTypes).not.toContain('bed');
  });

  it('SV-1: services POST rejects room-only amenity keys (isPerFloor=false)', async () => {
    const { token, admin } = await makeAdminToken();
    const floor = await floorCreate({
      floorNumber: 810 + (Date.now() % 40),
      label: `SV Reject ${Date.now()}`,
      totalRooms: 2,
    });

    const rejectRes = await jsonReq('POST', '/api/v1/services', token, {
      floorId: String(floor._id),
      serviceType: 'fan',
      status: 'operational',
    });
    expect(rejectRes.status).toBe(400);
    const err = rejectRes.body.error as { code?: string; message?: string };
    expect(err?.code === 'INVALID_SERVICE_TYPE' || String(err?.message ?? '').length > 0).toBe(
      true,
    );

    const okRes = await jsonReq('POST', '/api/v1/services', token, {
      floorId: String(floor._id),
      serviceType: 'wifi',
      status: 'operational',
    });
    // May 201 or 400 duplicate if seed ran — either proves path accepted type
    if (okRes.status === 201) {
      expect((okRes.body.data as { serviceType?: string })?.serviceType).toBe('wifi');
    } else {
      // Floor may already have wifi from a prior seed path; force-create clean floor without seed
      await ServiceStatus.deleteMany({ floorId: floor._id } as Record<string, unknown>);
      const retry = await jsonReq('POST', '/api/v1/services', token, {
        floorId: String(floor._id),
        serviceType: 'wifi',
        status: 'operational',
        note: `by ${String(admin._id)}`,
      });
      expect(retry.status).toBe(201);
    }
  });

  it('N1/N2: tenant notice feed includes floor and room targeted notices', async () => {
    const { admin } = await makeAdminToken();
    const floor = await floorCreate({
      floorNumber: 900 + (Date.now() % 30),
      label: `Notice Floor ${Date.now()}`,
      totalRooms: 1,
    });
    const room = await roomCreate({
      roomNumber: `N${String(Date.now()).slice(-5)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const tUser = await userCreate({
      name: 'Notice Tenant',
      email: `notice-t-${Date.now()}@test.com`,
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
    await User.findByIdAndUpdate(tUser._id, { tenantId: tenant._id });

    await noticeCreate({
      title: 'All residents notice xx',
      content: 'Broadcast content for everyone here',
      pinned: false,
      authorId: admin._id,
      targetType: 'all',
      targetIds: [],
    });
    await noticeCreate({
      title: 'Floor only notice here',
      content: 'Only for this floor residents now',
      pinned: false,
      authorId: admin._id,
      targetType: 'floor',
      targetIds: [String(floor._id)],
    });
    await noticeCreate({
      title: 'Room only notice here',
      content: 'Only for this room residents now',
      pinned: false,
      authorId: admin._id,
      targetType: 'room',
      targetIds: [String(room._id)],
    });
    await noticeCreate({
      title: 'Other floor notice xxx',
      content: 'Should not appear in tenant feed',
      pinned: false,
      authorId: admin._id,
      targetType: 'floor',
      targetIds: [new mongoose.Types.ObjectId().toString()],
    });

    const tenantToken = await signAccessToken({ sub: String(tUser._id), role: 'tenant' });
    const feed = await jsonReq('GET', '/api/v1/notices', tenantToken);
    expect(feed.status).toBe(200);
    const rows = (feed.body.data as Array<{ title?: string }>) ?? [];
    const titles = rows.map((r) => r.title);
    expect(titles).toContain('All residents notice xx');
    expect(titles).toContain('Floor only notice here');
    expect(titles).toContain('Room only notice here');
    expect(titles).not.toContain('Other floor notice xxx');
  });

  it('P1-V1: admin PUT cannot free-set visitor status (FSM only)', async () => {
    const { token } = await makeAdminToken();
    // Ensure feature flag allows visitors
    await AppConfig.findOneAndUpdate(
      {},
      { $set: { 'features.visitorManagementEnabled': true } },
      { upsert: false },
    );

    const floor = await floorCreate({
      floorNumber: 920 + (Date.now() % 20),
      label: `Vis Floor ${Date.now()}`,
      totalRooms: 1,
    });
    const room = await roomCreate({
      roomNumber: `V${String(Date.now()).slice(-5)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const tUser = await userCreate({
      name: 'Vis Tenant',
      email: `vis-t-${Date.now()}@test.com`,
      phone: `+9196${String(Date.now()).slice(-8)}`,
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
      visitorName: 'FSM Guest',
      visitorPhone: '+919812345678',
      purpose: 'Family visit',
      expectedArrival: new Date(),
      status: 'expected',
    });

    const putRes = await jsonReq('PUT', `/api/v1/visitors/${String(visitor._id)}`, token, {
      visitorName: 'FSM Guest Updated',
      status: 'departed',
    });
    // Zod strictObject rejects unknown status field with 400, or status is ignored
    if (putRes.status === 200) {
      const reloaded = await Visitor.findById(visitor._id).lean();
      expect(reloaded?.status).toBe('expected');
      expect(reloaded?.visitorName).toBe('FSM Guest Updated');
    } else {
      // strict schema may reject body containing status
      expect([400, 422]).toContain(putRes.status);
      const reloaded = await Visitor.findById(visitor._id).lean();
      expect(reloaded?.status).toBe('expected');
    }

    // Cancel via FSM endpoint (not PUT status)
    const cancel = await jsonReq('POST', `/api/v1/visitors/${String(visitor._id)}/cancel`, token);
    expect(cancel.status).toBe(200);
    const afterCancel = await Visitor.findById(visitor._id).lean();
    expect(afterCancel?.status).toBe('cancelled');

    // Re-approve then arrive
    const approve = await jsonReq(
      'POST',
      `/api/v1/visitors/${String(visitor._id)}/approve`,
      token,
    );
    expect(approve.status).toBe(200);
    const arrive = await jsonReq('POST', `/api/v1/visitors/${String(visitor._id)}/arrive`, token);
    expect(arrive.status).toBe(200);
    const afterArrive = await Visitor.findById(visitor._id).lean();
    expect(afterArrive?.status).toBe('arrived');

    // Cancel not allowed from arrived
    const cancelArrived = await jsonReq(
      'POST',
      `/api/v1/visitors/${String(visitor._id)}/cancel`,
      token,
    );
    expect(cancelArrived.status).toBe(409);
  });

  it('P1-T2/P1-G1: tenant DELETE deactivates linked guardian User accounts', async () => {
    const { token } = await makeAdminToken();
    const floor = await floorCreate({
      floorNumber: 940 + (Date.now() % 15),
      label: `Del Floor ${Date.now()}`,
      totalRooms: 1,
    });
    const room = await roomCreate({
      roomNumber: `D${String(Date.now()).slice(-5)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const tUser = await userCreate({
      name: 'Del Tenant',
      email: `del-t-${Date.now()}@test.com`,
      phone: `+9195${String(Date.now()).slice(-8)}`,
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
    // Mark bed occupied for cascade free
    const roomDoc = await Room.findById(room._id);
    if (roomDoc) {
      const bed = roomDoc.beds.find((b) => b.bedId === 'A');
      if (bed) {
        bed.isOccupied = true;
        bed.tenantId = tenant._id as unknown as typeof bed.tenantId;
        roomDoc.occupancyCount = 1;
        await roomDoc.save();
      }
    }

    const gUser = await userCreate({
      name: 'Guardian Link',
      email: `guard-${Date.now()}@test.com`,
      phone: `+9194${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'guardian',
      isActive: true,
    });
    await guardianCreate({
      userId: gUser._id,
      tenantId: tenant._id,
      name: 'Guardian Link',
      phone: gUser.phone,
      relation: 'father',
      isActive: true,
    });

    const del = await jsonReq('DELETE', `/api/v1/tenants/${String(tenant._id)}`, token);
    expect(del.status).toBe(200);

    const guardianDoc = await Guardian.findOne({
      tenantId: tenant._id,
    } as Record<string, unknown>).lean();
    expect(guardianDoc).toBeNull();

    const gUserAfter = await User.findById(gUser._id).lean();
    expect(gUserAfter).toBeTruthy();
    expect(gUserAfter?.isActive).toBe(false);
    expect(String(gUserAfter?.email ?? '')).toMatch(/^deleted-guardian:/);
  });

  it('CMP-authz: tenant cannot GET another tenant complaint by id', async () => {
    const floor = await floorCreate({
      floorNumber: 960 + (Date.now() % 12),
      label: `Cmp Floor ${Date.now()}`,
      totalRooms: 2,
    });
    const room1 = await roomCreate({
      roomNumber: `C1${String(Date.now()).slice(-4)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const room2 = await roomCreate({
      roomNumber: `C2${String(Date.now()).slice(-4)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });

    const u1 = await userCreate({
      name: 'Cmp T1',
      email: `cmp1-${Date.now()}@test.com`,
      phone: `+9193${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });
    const t1 = await tenantCreate({
      userId: u1._id,
      roomId: room1._id,
      bedId: 'A',
      moveInDate: new Date(),
      monthlyRent: 8000,
      isActive: true,
    });
    const u2 = await userCreate({
      name: 'Cmp T2',
      email: `cmp2-${Date.now()}@test.com`,
      phone: `+9192${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });
    await tenantCreate({
      userId: u2._id,
      roomId: room2._id,
      bedId: 'A',
      moveInDate: new Date(),
      monthlyRent: 8000,
      isActive: true,
    });

    const complaint = await complaintCreate({
      tenantId: t1._id,
      roomId: room1._id,
      category: 'wifi',
      title: 'Wifi not working enough',
      description: 'No connectivity since morning hours now',
      priority: 'medium',
      status: 'open',
    });

    const token2 = await signAccessToken({ sub: String(u2._id), role: 'tenant' });
    const denied = await jsonReq('GET', `/api/v1/complaints/${String(complaint._id)}`, token2);
    // Ownership denial surfaces as 404 (notFound) or 403
    expect([403, 404]).toContain(denied.status);

    const token1 = await signAccessToken({ sub: String(u1._id), role: 'tenant' });
    const allowed = await jsonReq('GET', `/api/v1/complaints/${String(complaint._id)}`, token1);
    expect(allowed.status).toBe(200);
  });

  it('P1-T1: unique active bed index rejects second active tenant on same bed', async () => {
    const floor = await floorCreate({
      floorNumber: 980 + (Date.now() % 10),
      label: `Bed Floor ${Date.now()}`,
      totalRooms: 1,
    });
    const room = await roomCreate({
      roomNumber: `B${String(Date.now()).slice(-5)}`,
      floorId: floor._id,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
      isActive: true,
    });
    const u1 = await userCreate({
      name: 'Bed T1',
      email: `bed1-${Date.now()}@test.com`,
      phone: `+9191${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });
    await tenantCreate({
      userId: u1._id,
      roomId: room._id,
      bedId: 'A',
      moveInDate: new Date(),
      monthlyRent: 8000,
      isActive: true,
    });
    const u2 = await userCreate({
      name: 'Bed T2',
      email: `bed2-${Date.now()}@test.com`,
      phone: `+9190${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });

    let duplicateError: unknown = null;
    try {
      await tenantCreate({
        userId: u2._id,
        roomId: room._id,
        bedId: 'A',
        moveInDate: new Date(),
        monthlyRent: 8000,
        isActive: true,
      });
    } catch (e) {
      duplicateError = e;
    }
    expect(duplicateError).toBeTruthy();
    expect((duplicateError as { code?: number }).code).toBe(11000);

    // Inactive historical occupant may share room+bed after checkout pattern
    const u3 = await userCreate({
      name: 'Bed T3 Inactive',
      email: `bed3-${Date.now()}@test.com`,
      phone: `+9189${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: false,
    });
    const inactiveOk = await tenantCreate({
      userId: u3._id,
      roomId: room._id,
      bedId: 'A',
      moveInDate: new Date('2020-01-01'),
      monthlyRent: 8000,
      isActive: false,
    });
    expect(inactiveOk).toBeTruthy();
  });
});
